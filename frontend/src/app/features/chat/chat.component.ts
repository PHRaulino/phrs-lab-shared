import {
  Component,
  DestroyRef,
  ElementRef,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from "@angular/core";
import { DatePipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { IconComponent } from "../../core/layout/icon.component";
import { ChatStore } from "./state/chat.store";
@Component({
  selector: "app-chat",
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, IconComponent],
  templateUrl: "./chat.component.html",
  styleUrl: "./chat.component.css",
})
export class ChatComponent {
  readonly store = inject(ChatStore);
  private readonly destroyRef = inject(DestroyRef);
  @ViewChild("thread") thread?: ElementRef<HTMLElement>;
  @ViewChild("composer") composer?: ElementRef<HTMLTextAreaElement>;
  readonly historyOpen = signal(false);
  readonly query = signal("");
  readonly copied = signal("");
  readonly copyError = signal("");
  readonly conversations = computed(() =>
    this.store
      .conversations()
      .filter((c) =>
        c.title.toLocaleLowerCase().includes(this.query().toLocaleLowerCase()),
      ),
  );
  readonly mode = computed(() => this.store.active()?.mode ?? "provider");
  readonly canSend = computed(() => this.store.completion.canSend(this.mode()));
  readonly suggestions = [
    "Ajude-me a estruturar uma pergunta para avaliar um atendimento.",
    "Quais critérios posso usar para avaliar a qualidade de um atendimento?",
    "Ajude-me a resumir um texto de forma clara e objetiva.",
  ];
  constructor() {
    effect(() => {
      this.store.active()?.messages.length;
      this.store.record().activeId;
      this.store.sending();
      setTimeout(() => {
        const element = this.thread?.nativeElement;
        if (element) element.scrollTop = element.scrollHeight;
      }, 0);
    });
    this.destroyRef.onDestroy(() => this.store.cancel());
  }
  choose(id: string): void {
    this.store.select(id);
    this.historyOpen.set(false);
  }
  newConversation(): void {
    this.store.newConversation();
    this.historyOpen.set(false);
    this.composer?.nativeElement.focus();
  }
  suggest(text: string): void {
    this.store.setDraft(text);
    this.composer?.nativeElement.focus();
  }
  keydown(event: KeyboardEvent): void {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      if (this.canSend() && !this.store.pending()) void this.store.send();
    }
  }
  async copy(id: string, content: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(content);
      this.copied.set(id);
      this.copyError.set("");
    } catch {
      this.copyError.set(
        "Não foi possível copiar. Selecione o texto da mensagem para copiá-lo.",
      );
    }
  }
}
