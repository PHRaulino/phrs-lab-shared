import {
  DestroyRef,
  Injectable,
  computed,
  inject,
  signal,
} from "@angular/core";
import {
  ChatConversation,
  ChatMode,
  ChatRecord,
  validateChatRecord,
} from "../chat.models";
import { ChatRepository } from "../data/chat.repository";
import { ChatCompletionService } from "../data/chat-completion.service";
const now = () => new Date().toISOString(),
  id = () => crypto.randomUUID();
@Injectable({ providedIn: "root" })
export class ChatStore {
  readonly completion = inject(ChatCompletionService);
  private readonly repository = inject(ChatRepository);
  private readonly destroyRef = inject(DestroyRef);
  readonly record = signal<ChatRecord>({
    schemaVersion: 1,
    ownerId: "browser-profile",
    activeId: null,
    conversations: [],
  });
  readonly active = computed(() =>
    this.record().conversations.find((c) => c.id === this.record().activeId),
  );
  readonly conversations = computed(() =>
    [...this.record().conversations].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    ),
  );
  readonly draft = computed(() => this.active()?.draft ?? "");
  readonly pending = computed(
    () => this.active()?.messages.at(-1)?.role === "user",
  );
  readonly loading = signal(true);
  readonly sending = signal(false);
  readonly error = signal("");
  readonly saving = signal("");
  private blocked = false;
  private controller?: AbortController;
  private epoch = 0;
  private revision = 0;
  private saveTimer?: ReturnType<typeof setTimeout>;
  constructor() {
    void this.load();
    const subscription = this.completion.backend.changes.subscribe(
      (enabled) => {
        if (
          !enabled &&
          this.completion.usesApplicationBackend &&
          this.active()?.mode === "provider"
        )
          this.cancel();
      },
    );
    this.destroyRef.onDestroy(() => {
      subscription.unsubscribe();
      this.cancel();
      if (this.saveTimer) {
        clearTimeout(this.saveTimer);
        void this.persist();
      }
    });
  }
  private async load(): Promise<void> {
    try {
      const stored = await this.repository.load("browser-profile");
      if (stored) this.record.set(validateChatRecord(stored));
    } catch (error) {
      this.blocked = true;
      this.error.set(this.message(error));
      this.saving.set(
        "Histórico anterior preservado. Alterações apenas nesta sessão.",
      );
    } finally {
      this.loading.set(false);
    }
  }
  newConversation(
    mode: ChatMode = this.active()?.mode ?? "provider",
  ): string | null {
    if (this.loading()) return null;
    if (mode === "demo" && !this.completion.demoAvailable) {
      this.error.set("Demonstração indisponível neste ambiente.");
      return null;
    }
    if (this.record().conversations.length >= 100) {
      this.error.set("Limite local de 100 conversas atingido.");
      return null;
    }
    this.cancel();
    this.error.set("");
    const conversation: ChatConversation = {
      id: id(),
      title: "Nova conversa",
      mode,
      messages: [],
      draft: "",
      createdAt: now(),
      updatedAt: now(),
    };
    this.record.update((r) => ({
      ...r,
      activeId: conversation.id,
      conversations: [...r.conversations, conversation],
    }));
    void this.persist();
    return conversation.id;
  }
  select(conversationId: string): void {
    if (
      this.record().activeId === conversationId ||
      !this.record().conversations.some((c) => c.id === conversationId)
    )
      return;
    this.cancel();
    this.error.set("");
    this.record.update((r) => ({ ...r, activeId: conversationId }));
    void this.persist();
  }
  setDraft(value: string): void {
    if (this.loading()) return;
    if (!this.active() && !this.newConversation()) return;
    this.update((c) => {
      c.draft = value.slice(0, 20000);
    }, false);
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = undefined;
      void this.persist();
    }, 300);
  }
  private update(
    change: (conversation: ChatConversation) => void,
    persist = true,
  ): void {
    const record = structuredClone(this.record());
    const conversation = record.conversations.find(
      (c) => c.id === record.activeId,
    );
    if (!conversation) return;
    change(conversation);
    this.record.set(record);
    if (persist) void this.persist();
  }
  async persist(): Promise<void> {
    if (this.blocked) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = undefined;
    const revision = ++this.revision;
    try {
      await this.repository.save(validateChatRecord(this.record()));
      if (revision === this.revision) this.saving.set("Salvo neste navegador");
    } catch (error) {
      if (revision === this.revision) {
        this.saving.set(
          "Não foi possível salvar. Histórico disponível apenas nesta sessão.",
        );
        this.error.set(this.message(error));
      }
    }
  }
  async send(retry = false): Promise<void> {
    const active = this.active();
    if (this.loading() || this.sending() || !active) return;
    if (!this.completion.canSend(active.mode)) {
      this.error.set(this.completion.reason());
      return;
    }
    if (retry ? !this.pending() : this.pending() || !active.draft.trim())
      return;
    if (active.messages.length + (retry ? 1 : 2) > 500) {
      this.error.set(
        "Esta conversa atingiu o limite local. Inicie uma nova conversa.",
      );
      return;
    }
    this.error.set("");
    if (!retry)
      this.update((c) => {
        const content = c.draft.trim();
        c.messages.push({ id: id(), role: "user", content, createdAt: now() });
        c.draft = "";
        c.updatedAt = now();
        if (c.messages.length === 1)
          c.title = content.replace(/\s+/g, " ").slice(0, 70);
      });
    const conversation = structuredClone(this.active()!),
      controller = new AbortController();
    this.controller = controller;
    const epoch = ++this.epoch;
    this.sending.set(true);
    try {
      const response = await this.completion.complete(
        conversation,
        controller.signal,
      );
      if (
        controller.signal.aborted ||
        epoch !== this.epoch ||
        this.active()?.id !== conversation.id
      )
        return;
      if (
        !response ||
        typeof response.content !== "string" ||
        !response.content.trim() ||
        response.content.length > 100000
      )
        throw new Error(
          "O provedor retornou uma resposta inválida. Tente novamente.",
        );
      this.update((c) => {
        c.messages.push({
          id: id(),
          role: "assistant",
          content: response.content,
          createdAt: now(),
        });
        c.updatedAt = now();
      });
    } catch (error) {
      if (epoch === this.epoch && !controller.signal.aborted)
        this.error.set(this.message(error));
    } finally {
      if (epoch === this.epoch) {
        this.sending.set(false);
        this.controller = undefined;
      }
    }
  }
  cancel(): void {
    this.epoch++;
    this.controller?.abort();
    this.controller = undefined;
    this.sending.set(false);
  }
  editPending(): void {
    this.cancel();
    if (!this.pending()) return;
    this.update((c) => {
      c.draft = c.messages.pop()!.content;
      c.updatedAt = now();
    });
    this.error.set("");
  }
  private message(error: unknown): string {
    return error instanceof Error
      ? error.message
      : "Não foi possível concluir a operação.";
  }
}
