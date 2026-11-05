import { ChatCompletionRequest, ChatCompletionResponse } from "../chat.models";
export const CHAT_DEMO_AVAILABLE = false;
export async function requestDemoCompletion(
  _request: ChatCompletionRequest,
  _signal: AbortSignal,
): Promise<ChatCompletionResponse> {
  throw new Error(
    "A demonstração está disponível apenas no ambiente de desenvolvimento.",
  );
}
