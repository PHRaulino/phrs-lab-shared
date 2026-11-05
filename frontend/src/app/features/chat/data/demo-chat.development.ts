import { ChatCompletionRequest, ChatCompletionResponse } from "../chat.models";
export const CHAT_DEMO_AVAILABLE = true;
export async function requestDemoCompletion(
  request: ChatCompletionRequest,
  signal: AbortSignal,
): Promise<ChatCompletionResponse> {
  const response = await fetch("/demo-api/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });
  if (!response.ok)
    throw new Error("A demonstração não respondeu. Tente novamente.");
  return response.json();
}
