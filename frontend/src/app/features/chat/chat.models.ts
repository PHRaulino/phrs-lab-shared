export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}
export type ChatMode = "provider" | "demo";
export interface ChatConversation {
  id: string;
  title: string;
  mode: ChatMode;
  messages: ChatMessage[];
  draft: string;
  createdAt: string;
  updatedAt: string;
}
export interface ChatRecord {
  schemaVersion: 1;
  ownerId: "browser-profile";
  activeId: string | null;
  conversations: ChatConversation[];
}
export interface ChatCompletionRequest {
  messages: Pick<ChatMessage, "role" | "content">[];
  model: string;
  instructions: string;
  parameters: Record<string, string | number | boolean>;
}
export interface ChatCompletionResponse {
  content: string;
}
export function validateChatRecord(value: unknown): ChatRecord {
  const record = value as ChatRecord;
  if (
    !record ||
    record.schemaVersion !== 1 ||
    record.ownerId !== "browser-profile" ||
    !Array.isArray(record.conversations) ||
    record.conversations.length > 100
  )
    throw new Error(
      "Histórico de chat incompatível. Os dados existentes foram preservados.",
    );
  const ids = new Set<string>();
  const validId = (id: unknown) =>
    typeof id === "string" &&
    /^[a-zA-Z0-9_-]{1,100}$/.test(id) &&
    !ids.has(id) &&
    !!ids.add(id);
  const validDate = (v: unknown) =>
    typeof v === "string" && Number.isFinite(Date.parse(v));
  let characters = 0;
  for (const c of record.conversations) {
    if (
      !c ||
      !validId(c.id) ||
      typeof c.title !== "string" ||
      !c.title.trim() ||
      c.title.length > 100 ||
      !["provider", "demo"].includes(c.mode) ||
      typeof c.draft !== "string" ||
      c.draft.length > 20000 ||
      !validDate(c.createdAt) ||
      !validDate(c.updatedAt) ||
      !Array.isArray(c.messages) ||
      c.messages.length > 500
    )
      throw new Error("Conversa inválida no histórico local.");
    characters += c.draft.length;
    for (const [index, m] of c.messages.entries()) {
      if (
        !m ||
        !validId(m.id) ||
        !["user", "assistant"].includes(m.role) ||
        m.role !== (index % 2 === 0 ? "user" : "assistant") ||
        typeof m.content !== "string" ||
        !m.content.trim() ||
        m.content.length > 100000 ||
        !validDate(m.createdAt)
      )
        throw new Error("Mensagem inválida no histórico local.");
      characters += m.content.length;
      if (characters > 5000000)
        throw new Error("O histórico excede o limite local de texto.");
    }
  }
  if (
    record.activeId !== null &&
    !record.conversations.some((c) => c.id === record.activeId)
  )
    throw new Error("Conversa selecionada não encontrada.");
  return structuredClone(record);
}
