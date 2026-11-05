import assert from "node:assert/strict";
import { test } from "node:test";
import { createEnvironmentInjector, signal } from "@angular/core";
import { BehaviorSubject } from "rxjs";
import { ChatStore } from "../src/app/features/chat/state/chat.store";
import { ChatRepository } from "../src/app/features/chat/data/chat.repository";
import { ChatCompletionService } from "../src/app/features/chat/data/chat-completion.service";
import { ProjectsStore } from "../src/app/features/projects/state/projects.store";
import { DEFAULT_AI_SETTINGS } from "../src/app/features/projects/models/projects.models";
import { validateChatRecord } from "../src/app/features/chat/chat.models";
import type {
  ChatConversation,
  ChatRecord,
} from "../src/app/features/chat/chat.models";
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
function setup(
  complete: (
    conversation: ChatConversation,
    signal: AbortSignal,
  ) => Promise<{ content: string }>,
  stored: unknown = null,
  associated = false,
) {
  const saved: ChatRecord[] = [],
    backend = { changes: new BehaviorSubject(true) };
  const gateway = {
    backend,
    usesApplicationBackend: associated,
    demoAvailable: true,
    canSend: () => true,
    reason: () => "",
    complete,
  };
  const injector = createEnvironmentInjector(
    [
      {
        provide: ChatRepository,
        useValue: {
          load: async () => structuredClone(stored),
          save: async (value: ChatRecord) => {
            saved.push(structuredClone(value));
          },
        },
      },
      { provide: ChatCompletionService, useValue: gateway },
      { provide: ChatStore, useFactory: () => new ChatStore() },
    ],
    null as never,
  );
  return { store: injector.get(ChatStore), injector, saved, backend };
}
test("chat preserva sequência, histórico completo, rascunhos e conversas independentes", async () => {
  const requests: ChatConversation[] = [];
  const { store, injector, saved } = setup(async (conversation) => {
    requests.push(conversation);
    return { content: "Resposta" };
  });
  try {
    await tick();
    const first = store.newConversation()!;
    store.setDraft("  Primeira pergunta  ");
    await store.send();
    store.setDraft("Segunda pergunta");
    await store.send();
    assert.equal(store.active()?.title, "Primeira pergunta");
    assert.equal(requests[1].messages.length, 3);
    assert.deepEqual(
      requests[1].messages.map((m) => m.role),
      ["user", "assistant", "user"],
    );
    const second = store.newConversation()!;
    store.setDraft("Rascunho preservado");
    store.select(first);
    assert.equal(store.active()?.messages.length, 4);
    store.select(second);
    assert.equal(store.draft(), "Rascunho preservado");
    await store.persist();
    const restored = validateChatRecord(saved.at(-1));
    assert.equal(restored.conversations.length, 2);
    restored.conversations[0].messages[0].content = "Outra cópia";
    assert.equal(
      store.record().conversations[0].messages[0].content,
      "Primeira pergunta",
    );
  } finally {
    injector.destroy();
  }
});
test("trocar conversa aborta a solicitação e descarta respostas tardias", async () => {
  let resolve!: (value: { content: string }) => void;
  let requestSignal!: AbortSignal;
  const { store, injector } = setup(async (_c, signal) => {
    requestSignal = signal;
    return new Promise((r) => (resolve = r));
  });
  try {
    await tick();
    const first = store.newConversation()!;
    store.setDraft("Pergunta");
    const pending = store.send();
    const second = store.newConversation()!;
    assert.equal(requestSignal.aborted, true);
    resolve({ content: "Resposta antiga" });
    await pending;
    assert.equal(store.active()?.id, second);
    assert.equal(store.active()?.messages.length, 0);
    store.select(first);
    assert.equal(store.pending(), true);
    assert.equal(store.active()?.messages.length, 1);
  } finally {
    injector.destroy();
  }
});
test("falha e repetição não duplicam a mensagem; cancelamento permite editar", async () => {
  let calls = 0;
  const { store, injector } = setup(async () => {
    if (++calls === 1) throw new Error("Falha do provedor");
    return { content: "Resposta recuperada" };
  });
  try {
    await tick();
    store.newConversation();
    store.setDraft("Minha pergunta");
    await store.send();
    assert.match(store.error(), /Falha/);
    assert.equal(store.pending(), true);
    await store.send(true);
    assert.equal(store.active()?.messages.length, 2);
    assert.equal(store.active()?.messages[1].content, "Resposta recuperada");
    store.setDraft("Nova pergunta");
    store.completion.complete = async () => ({ content: "" });
    await store.send();
    assert.match(store.error(), /inválida/);
    store.editPending();
    assert.equal(store.draft(), "Nova pergunta");
    assert.equal(store.active()?.messages.length, 2);
  } finally {
    injector.destroy();
  }
});
test("desativar backend cancela apenas o provedor associado", async () => {
  for (const mode of ["provider", "demo"] as const) {
    let resolve!: (value: { content: string }) => void;
    let requestSignal!: AbortSignal;
    const { store, injector, backend } = setup(
      async (_c, signal) => {
        requestSignal = signal;
        return new Promise((r) => (resolve = r));
      },
      null,
      true,
    );
    try {
      await tick();
      store.newConversation(mode);
      store.setDraft("Pergunta");
      const pending = store.send();
      backend.changes.next(false);
      assert.equal(requestSignal.aborted, mode === "provider");
      resolve({ content: "Resposta" });
      await pending;
      assert.equal(
        store.active()?.messages.length,
        mode === "provider" ? 1 : 2,
      );
    } finally {
      injector.destroy();
    }
  }
});
test("registro desconhecido é preservado; IDs e alternância das mensagens são validados", async () => {
  const { store, injector, saved } = setup(
    async () => ({ content: "Resposta" }),
    { schemaVersion: 9 },
  );
  try {
    await tick();
    assert.ok(store.error());
    store.newConversation();
    store.setDraft("Rascunho");
    await store.persist();
    assert.equal(saved.length, 0);
    const record = structuredClone(store.record());
    record.conversations[0].messages = [
      {
        id: "message-1",
        role: "assistant",
        content: "Órfã",
        createdAt: new Date().toISOString(),
      },
    ];
    assert.throws(() => validateChatRecord(record), /Mensagem inválida/);
  } finally {
    injector.destroy();
  }
});
test("gateway usa capability de chat e entrega uma cópia apenas das mensagens da conversa", async () => {
  let received: any;
  const enabled = signal(true),
    settings = {
      ...DEFAULT_AI_SETTINGS,
      providerId: "test-chat",
      model: "modelo-test",
    };
  const ai = {
    loading: signal(false),
    ready: enabled,
    record: signal({ settings }),
    aiReason: () => "Indisponível",
    backend: { changes: new BehaviorSubject(true) },
    provider: {
      id: "test-chat",
      usesApplicationBackend: false,
      supportedParameters: {},
      available: true,
      completeChat: async (request: any) => {
        received = request;
        request.messages[0].content = "Alterado pelo adapter";
        return { content: "Olá" };
      },
    },
  };
  const injector = createEnvironmentInjector(
    [
      { provide: ProjectsStore, useValue: ai },
      {
        provide: ChatCompletionService,
        useFactory: () => new ChatCompletionService(),
      },
    ],
    null as never,
  );
  try {
    const gateway = injector.get(ChatCompletionService);
    assert.equal(gateway.ready(), true);
    const conversation: ChatConversation = {
      id: "c1",
      title: "Oi",
      mode: "provider",
      draft: "Não enviar",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [
        {
          id: "m1",
          role: "user",
          content: "Olá",
          createdAt: new Date().toISOString(),
        },
      ],
    };
    await gateway.complete(conversation, new AbortController().signal);
    assert.equal(received.model, "modelo-test");
    assert.equal(received.messages.length, 1);
    assert.equal(conversation.messages[0].content, "Olá");
    assert.equal("draft" in received, false);
    enabled.set(false);
    await assert.rejects(
      () => gateway.complete(conversation, new AbortController().signal),
      /Indisponível/,
    );
    assert.equal(gateway.demoAvailable, false);
  } finally {
    injector.destroy();
  }
});
