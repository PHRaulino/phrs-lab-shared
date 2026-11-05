import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import { http, HttpResponse } from "msw";
import { server } from "../src/mocks/server";
import { overviewFixture } from "../src/mocks/fixtures/overview";

before(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
after(() => server.close());

test("GET /api/overview entrega os dados do workspace", async () => {
  const response = await fetch("http://localhost/api/overview");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), overviewFixture);
});

test("permite simular falhas sem alterar os handlers padrão", async () => {
  server.use(
    http.get("*/api/overview", () => new HttpResponse(null, { status: 503 })),
  );
  const response = await fetch("http://localhost/api/overview");
  assert.equal(response.status, 503);
});

test("cenário de observabilidade usa o endpoint de exemplo e identifica a demonstração", async () => {
  const response = await fetch(
    "http://localhost/api/overview?observability=large",
  );
  const body = await response.json();
  assert.equal(body.observability.source, "demo");
  assert.equal(body.observability.tasks.length, 240);
  assert.equal(body.observability.workflows.length, 2);
});

test("chat de demonstração recebe múltiplos turnos e se identifica como simulado", async () => {
  const response = await fetch("http://localhost/demo-api/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [
        { role: "user", content: "Olá" },
        { role: "assistant", content: "Olá!" },
        { role: "user", content: "Continue" },
      ],
    }),
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.match(result.content, /demonstração/);
  assert.match(result.content, /mensagem 2/);
  const invalid = await fetch("http://localhost/demo-api/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [] }),
  });
  assert.equal(invalid.status, 400);
});
