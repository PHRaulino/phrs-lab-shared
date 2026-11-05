import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
} from "../../chat/chat.models";
import { isCredentialParameter } from "../models/ai-settings.utils";
import { Injectable, InjectionToken } from "@angular/core";
import {
  AISettings,
  AnalysisRequest,
  AnalysisResult,
} from "../models/projects.models";
export interface AIProvider {
  id: string;
  name: string;
  available: boolean;
  transport: "none" | "secure-proxy" | "browser-local";
  usesApplicationBackend: boolean;
  supportedParameters: Record<string, "string" | "number" | "boolean">;
  completeChat?(
    request: ChatCompletionRequest,
    signal: AbortSignal,
  ): Promise<ChatCompletionResponse>;
  analyze(
    request: AnalysisRequest,
    signal: AbortSignal,
  ): Promise<AnalysisResult>;
}
@Injectable({ providedIn: "root" })
export class UnavailableAIProvider implements AIProvider {
  readonly id = "unconfigured";
  readonly name = "Nenhum provedor configurado";
  readonly available = false;
  readonly transport = "none" as const;
  readonly usesApplicationBackend = false;
  readonly supportedParameters = {};
  async analyze(
    _request: AnalysisRequest,
    _signal: AbortSignal,
  ): Promise<AnalysisResult> {
    throw new Error(
      "A análise com IA requer um provedor disponível e um acesso seguro configurado.",
    );
  }
}
export const AI_PROVIDER = new InjectionToken<AIProvider>("ProjectAIProvider", {
  providedIn: "root",
  factory: () => new UnavailableAIProvider(),
});
export function validateAISettings(
  settings: AISettings,
  provider: AIProvider,
): void {
  if (provider.available && !settings.model.trim())
    throw new Error("Configure o modelo antes de executar uma análise.");
  if (settings.providerId !== provider.id)
    throw new Error("Selecione um provedor registrado.");
  for (const [key, value] of Object.entries(settings.parameters))
    if (
      !(key in provider.supportedParameters) ||
      typeof value !== provider.supportedParameters[key] ||
      isCredentialParameter(key)
    )
      throw new Error(
        `Parâmetro não suportado: ${key}. Não informe credenciais no frontend.`,
      );
}
