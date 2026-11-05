import { Injectable, computed, inject } from "@angular/core";
import { ProjectsStore } from "../../projects/state/projects.store";
import { validateAISettings } from "../../projects/data/ai-provider";
import {
  ChatConversation,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatMode,
} from "../chat.models";
import { CHAT_DEMO_AVAILABLE, requestDemoCompletion } from "./demo-chat";
@Injectable({ providedIn: "root" })
export class ChatCompletionService {
  readonly ai = inject(ProjectsStore);
  readonly backend = this.ai.backend;
  readonly usesApplicationBackend = this.ai.provider.usesApplicationBackend;
  readonly demoAvailable = CHAT_DEMO_AVAILABLE;
  readonly ready = computed(
    () =>
      !this.ai.loading() &&
      this.ai.ready() &&
      !!this.ai.provider.completeChat &&
      !!this.ai.record().settings.model.trim() &&
      this.ai.record().settings.providerId === this.ai.provider.id,
  );
  readonly model = computed(
    () => this.ai.record().settings.model || "Modelo não configurado",
  );
  readonly reason = computed(() => {
    if (this.ai.loading()) return "Carregando as preferências de IA…";
    if (!this.ai.ready()) return this.ai.aiReason();
    if (!this.ai.provider.completeChat)
      return "O provedor atual ainda não oferece chat. Registre um provedor com suporte a conversas.";
    if (!this.ready())
      return "Configure o modelo e o provedor para começar a conversar.";
    return "Conectado ao provedor de IA.";
  });
  canSend(mode: ChatMode): boolean {
    return mode === "demo" ? this.demoAvailable : this.ready();
  }
  async complete(
    conversation: ChatConversation,
    signal: AbortSignal,
  ): Promise<ChatCompletionResponse> {
    if (!this.canSend(conversation.mode)) throw new Error(this.reason());
    const settings = structuredClone(this.ai.record().settings);
    const request: ChatCompletionRequest = {
      messages: conversation.messages.map(({ role, content }) => ({
        role,
        content,
      })),
      model: conversation.mode === "demo" ? "demo-chat" : settings.model,
      instructions:
        "Você é um assistente de IA. Responda em português com clareza e considere o histórico da conversa.",
      parameters: conversation.mode === "demo" ? {} : settings.parameters,
    };
    if (conversation.mode === "demo")
      return requestDemoCompletion(request, signal);
    validateAISettings(settings, this.ai.provider);
    return this.ai.provider.completeChat!(request, signal);
  }
}
