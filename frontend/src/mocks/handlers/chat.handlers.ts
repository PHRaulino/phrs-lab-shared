import { delay, http, HttpResponse } from "msw";
export const chatHandlers = [
  http.post("*/demo-api/chat/completions", async ({ request }) => {
    const body = (await request.json()) as {
      messages?: { role: string; content: string }[];
    };
    if (
      !Array.isArray(body?.messages) ||
      !body.messages.length ||
      body.messages.length > 500 ||
      body.messages.some(
        (m) =>
          !m ||
          !["user", "assistant"].includes(m.role) ||
          typeof m.content !== "string" ||
          !m.content.trim() ||
          m.content.length > 100000,
      ) ||
      body.messages.at(-1)?.role !== "user"
    )
      return HttpResponse.json(
        { error: "Mensagens inválidas." },
        { status: 400 },
      );
    await delay(650);
    const turns = body.messages.filter((m) => m.role === "user").length;
    return HttpResponse.json({
      content: `Esta é uma resposta de demonstração, sem execução de um modelo de IA.\n\nRecebi sua ${turns === 1 ? "primeira mensagem" : `mensagem ${turns}`} e o histórico desta conversa. Em uma integração real, o modelo usará essas mensagens para responder ao que você pediu.\n\nVocê pode enviar outra mensagem para experimentar a continuidade do chat ou iniciar uma nova conversa.`,
    });
  }),
];
