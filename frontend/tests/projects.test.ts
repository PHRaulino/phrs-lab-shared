import { createEnvironmentInjector } from "@angular/core";
import { ProjectsStore } from "../src/app/features/projects/state/projects.store";
import { ProjectsRepository } from "../src/app/features/projects/data/projects.repository";
import {
  AI_PROVIDER,
  UnavailableAIProvider,
} from "../src/app/features/projects/data/ai-provider";
import { BackendModeService } from "../src/app/core/backend/backend-mode.service";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  prepareContext,
  validateAttendanceContext,
  validateAttendanceResult,
  availableMaterials,
  validateAnalysisResult,
  analysisMarkdown,
  compareAnalyses,
} from "../src/app/features/projects/data/context-engine";
import {
  validateProjectsRecord,
  migrateProjectsRecord,
} from "../src/app/features/projects/data/projects-validation";
import { DEFAULT_AI_SETTINGS } from "../src/app/features/projects/models/projects.models";
import type {
  AnalysisRun,
  Feature,
  Material,
  Project,
  ProjectsRecord,
} from "../src/app/features/projects/models/projects.models";
const timestamp = "2026-11-03T12:00:00-03:00";
const project: Project = {
  id: "project-a",
  name: "Projeto A",
  description: "Descrição original",
  objective: "Objetivo",
  context: "Contexto",
  status: "planning",
  createdAt: timestamp,
  updatedAt: timestamp,
};
const feature: Feature = {
  ...project,
  id: "feature-a",
  projectId: project.id,
  status: "idea",
};
const materials: Material[] = [
  {
    id: "material-project",
    projectId: project.id,
    type: "text",
    title: "Projeto",
    content: "Texto original do projeto",
    createdAt: timestamp,
  },
  {
    id: "material-feature",
    projectId: project.id,
    featureId: feature.id,
    type: "transcript",
    title: "Reunião",
    content: "Transcrição original",
    createdAt: timestamp,
  },
  {
    id: "material-other-feature",
    projectId: project.id,
    featureId: "feature-other",
    type: "text",
    title: "Outra feature",
    content: "Não enviar",
    createdAt: timestamp,
  },
  {
    id: "material-other-project",
    projectId: "project-b",
    type: "text",
    title: "Outro projeto",
    content: "Não enviar",
    createdAt: timestamp,
  },
];
const context = prepareContext(project, feature, materials, [], {
  includeProject: true,
  includeFeature: true,
  materialIds: ["material-feature"],
  requirementIds: [],
});
const result = {
  summary: "Resumo",
  sections: [
    {
      id: "needs",
      title: "Necessidade",
      items: [
        {
          text: "Necessidade fornecida",
          origin: "provided" as const,
          sourceMaterialIds: ["material-feature"],
        },
        {
          text: "Possibilidade a validar",
          origin: "hypothesis" as const,
          sourceMaterialIds: [],
        },
      ],
    },
  ],
  openQuestions: ["Qual é o volume esperado?"],
};
const run: AnalysisRun = {
  id: "analysis-1",
  projectId: project.id,
  featureId: feature.id,
  type: "idea",
  createdAt: timestamp,
  version: 1,
  instruction: "Analisar contexto",
  context,
  settings: structuredClone(DEFAULT_AI_SETTINGS),
  providerId: "secure-adapter",
  model: "example",
  result,
};
const record = (): ProjectsRecord => ({
  schemaVersion: 1,
  ownerId: "browser-profile",
  projects: [structuredClone(project)],
  features: [structuredClone(feature)],
  materials: structuredClone(materials.slice(0, 2)),
  requirements: [],
  analyses: [structuredClone(run)],
  settings: structuredClone(DEFAULT_AI_SETTINGS),
});

test("a seleção de contexto exclui outros projetos e outras features", () => {
  assert.deepEqual(
    availableMaterials(materials, project.id, feature.id).map((m) => m.id),
    ["material-project", "material-feature"],
  );
  assert.deepEqual(
    context.materials.map((m) => m.id),
    ["material-feature"],
  );
  assert.throws(
    () =>
      prepareContext(project, feature, materials, [], {
        includeProject: false,
        includeFeature: false,
        materialIds: ["material-other-project"],
        requirementIds: [],
      }),
    /contexto/,
  );
  assert.throws(
    () =>
      prepareContext(
        project,
        { ...feature, projectId: "project-b" },
        materials,
        [],
        {
          includeProject: true,
          includeFeature: true,
          materialIds: [],
          requirementIds: [],
        },
      ),
    /pertence/,
  );
});
test("o contexto é um snapshot e não altera os materiais originais", () => {
  const snapshot = prepareContext(project, feature, materials, [], {
    includeProject: false,
    includeFeature: false,
    materialIds: ["material-feature"],
    requirementIds: [],
  });
  snapshot.materials[0].content = "Alterado na cópia";
  assert.equal(materials[1].content, "Transcrição original");
  assert.equal(snapshot.project, undefined);
  assert.throws(
    () =>
      prepareContext(project, undefined, materials, [], {
        includeProject: false,
        includeFeature: false,
        materialIds: [],
        requirementIds: [],
      }),
    /Selecione/,
  );
});
test("resultados distinguem fornecido, hipótese e sugestão e validam as fontes", () => {
  assert.deepEqual(
    validateAnalysisResult(result, ["material-feature"]),
    result,
  );
  const wrong = structuredClone(result);
  wrong.sections[0].items[0].sourceMaterialIds = ["other"];
  assert.throws(
    () => validateAnalysisResult(wrong, ["material-feature"]),
    /fontes/,
  );
  assert.throws(
    () =>
      validateAnalysisResult(
        {
          ...result,
          sections: [
            {
              id: "x",
              title: "X",
              items: [
                {
                  text: "Suposição",
                  origin: "confirmed",
                  sourceMaterialIds: [],
                },
              ],
            },
          ],
        },
        [],
      ),
    /distinguir/,
  );
});
test("o backup mantém análises, instruções e material original sem compartilhar referências", () => {
  const source = record(),
    restored = validateProjectsRecord(JSON.parse(JSON.stringify(source)));
  assert.deepEqual(restored, migrateProjectsRecord(source));
  assert.equal(source.schemaVersion, 1);
  restored.analyses[0].context.materials[0].content = "Outra cópia";
  assert.equal(
    source.analyses[0].context.materials[0].content,
    "Transcrição original",
  );
});
test("importação rejeita versões futuras, órfãos, IDs repetidos e parâmetros sigilosos", () => {
  assert.throws(
    () => migrateProjectsRecord({ ...record(), schemaVersion: 3 }),
    /Versão/,
  );
  const orphan = record();
  orphan.features[0].projectId = "missing";
  assert.throws(() => validateProjectsRecord(orphan), /Feature/);
  const duplicate = record();
  duplicate.materials[1].id = duplicate.materials[0].id;
  assert.throws(() => validateProjectsRecord(duplicate), /duplicado/);
  const secret = record();
  secret.settings.parameters = { apiKey: "secret" };
  assert.throws(() => validateProjectsRecord(secret), /Configurações/);
  const history = record();
  history.analyses[0].settings.parameters = { token: "secret" };
  assert.throws(() => validateProjectsRecord(history), /Histórico/);
});
test("o histórico não aceita refinamentos de outro escopo ou versões anteriores", () => {
  const source = record();
  source.analyses.push({
    ...structuredClone(run),
    id: "analysis-2",
    parentId: run.id,
    version: 1,
  });
  assert.throws(() => validateProjectsRecord(source), /refinamento/);
  source.analyses[1].version = 2;
  assert.equal(validateProjectsRecord(source).analyses.length, 2);
});
test("comparação e Markdown preservam a origem das afirmações", () => {
  const newer = { ...structuredClone(run), id: "analysis-2", version: 2 };
  newer.result.sections[0].items.push({
    text: "Nova hipótese",
    origin: "hypothesis",
    sourceMaterialIds: [],
  });
  assert.equal(compareAnalyses(run, newer).added.length, 1);
  assert.ok(analysisMarkdown(run).includes("**Hipótese:**"));
  assert.ok(analysisMarkdown(run).includes("material-feature"));
  assert.ok(analysisMarkdown(run).includes(String.fromCharCode(10)));
  assert.throws(
    () => compareAnalyses(run, { ...newer, projectId: "project-b" }),
    /mesmo projeto/,
  );
});

test("execução por adapter independente preserva fontes e requisitos aprovados sem backend", async () => {
  const backend = new BackendModeService();
  backend.setEnabled(false);
  const source = record();
  source.analyses = [];
  source.settings = {
    ...source.settings,
    providerId: "test-provider",
    model: "test-model",
  };
  source.requirements = [
    {
      id: "req-approved",
      projectId: project.id,
      featureId: feature.id,
      title: "Decisão aprovada",
      description: "Não substituir",
      status: "approved",
      createdAt: timestamp,
    },
  ];
  const provider = {
    id: "test-provider",
    name: "Adapter restrito ao teste",
    available: true,
    transport: "secure-proxy",
    usesApplicationBackend: false,
    supportedParameters: {},
    analyze: async () => structuredClone(result),
  };
  const injector = createEnvironmentInjector(
    [
      {
        provide: ProjectsRepository,
        useValue: {
          load: async () => structuredClone(source),
          save: async () => undefined,
        },
      },
      { provide: AI_PROVIDER, useValue: provider },
      { provide: BackendModeService, useValue: backend },
      { provide: ProjectsStore, useFactory: () => new ProjectsStore() },
    ],
    null as never,
  );
  try {
    const store = injector.get(ProjectsStore);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(store.ready(), true);
    const analysis = await store.analyze(
      project.id,
      feature.id,
      "idea",
      "Instruções",
      {
        includeProject: false,
        includeFeature: false,
        materialIds: ["material-feature"],
        requirementIds: ["req-approved"],
      },
    );
    assert.ok(analysis);
    assert.equal(store.record().analyses.length, 1);
    assert.equal(JSON.parse(store.exportBackup()).schemaVersion, 2);
    assert.equal(
      JSON.parse(store.exportProject(project.id)).projects.length,
      1,
    );
    assert.equal(store.record().materials[1].content, "Transcrição original");
    assert.equal(store.record().requirements[0].status, "approved");
    assert.equal(store.record().requirements[0].description, "Não substituir");
    const standalone = await store.analyze(
      "",
      feature.id,
      "idea",
      "Sem projeto",
      {
        includeProject: false,
        includeFeature: true,
        materialIds: ["material-feature"],
        requirementIds: ["req-approved"],
      },
    );
    assert.ok(standalone);
    assert.equal(standalone.projectId, "");
    assert.equal(standalone.context.project, undefined);
    assert.ok(
      store.saveKnowledge(
        {
          title: "Reunião atualizada",
          content: "Novo texto",
          type: "transcript",
        },
        "material-feature",
      ),
    );
    assert.equal(
      store.record().analyses[1].context.materials[0].content,
      "Transcrição original",
    );
    assert.equal(store.record().requirements[0].status, "approved");
  } finally {
    injector.destroy();
  }
});

test("adapter associado ao backend descarta uma resposta tardia após desativação", async () => {
  const backend = new BackendModeService();
  backend.setEnabled(true);
  const source = record();
  source.analyses = [];
  source.settings = {
    ...source.settings,
    providerId: "test-provider",
    model: "test-model",
  };
  let resolveResult!: (value: typeof result) => void;
  const provider = {
    id: "test-provider",
    name: "Adapter restrito ao teste",
    available: true,
    transport: "secure-proxy",
    usesApplicationBackend: true,
    supportedParameters: {},
    analyze: () =>
      new Promise<typeof result>((resolve) => (resolveResult = resolve)),
  };
  const injector = createEnvironmentInjector(
    [
      {
        provide: ProjectsRepository,
        useValue: {
          load: async () => structuredClone(source),
          save: async () => undefined,
        },
      },
      { provide: AI_PROVIDER, useValue: provider },
      { provide: BackendModeService, useValue: backend },
      { provide: ProjectsStore, useFactory: () => new ProjectsStore() },
    ],
    null as never,
  );
  try {
    const store = injector.get(ProjectsStore);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const pending = store.analyze(project.id, feature.id, "idea", "", {
      includeProject: false,
      includeFeature: false,
      materialIds: ["material-feature"],
      requirementIds: [],
    });
    backend.setEnabled(false);
    resolveResult(structuredClone(result));
    assert.equal(await pending, null);
    assert.equal(store.record().analyses.length, 0);
    assert.equal(store.analyzing(), false);
  } finally {
    injector.destroy();
  }
});

test("limites de tokens suportados são aceitos sem permitir credenciais no parâmetro", async () => {
  const { validateAISettings } = await import(
    "../src/app/features/projects/data/ai-provider"
  );
  const provider = {
    id: "test-provider",
    name: "Teste",
    available: true,
    transport: "secure-proxy" as const,
    usesApplicationBackend: false,
    supportedParameters: { max_output_tokens: "number" as const },
    analyze: async () => structuredClone(result),
  };
  const settings = {
    ...structuredClone(DEFAULT_AI_SETTINGS),
    providerId: "test-provider",
    model: "test-model",
    parameters: { max_output_tokens: 2048 },
  };
  assert.doesNotThrow(() => validateAISettings(settings, provider));
  const backup = record();
  backup.settings.parameters = { max_output_tokens: 2048 };
  assert.doesNotThrow(() => validateProjectsRecord(backup));
  assert.throws(
    () =>
      validateAISettings(
        { ...settings, parameters: { apiKey: "secret" } },
        provider,
      ),
    /Parâmetro/,
  );
});

test("informações fornecidas podem referenciar o contexto explicitamente selecionado", () => {
  const fromProject = {
    summary: "Resumo",
    sections: [
      {
        id: "goal",
        title: "Objetivo",
        items: [
          {
            text: "Objetivo registrado no projeto",
            origin: "provided",
            sourceMaterialIds: [],
            sourceContext: "project",
          },
        ],
      },
    ],
    openQuestions: [],
  };
  assert.doesNotThrow(() =>
    validateAnalysisResult(fromProject, [], ["project"]),
  );
  assert.throws(
    () => validateAnalysisResult(fromProject, [], []),
    /distinguir/,
  );
});

test("migração separa os cadastros e preserva fontes, vínculos e histórico", () => {
  const legacy = record();
  const before = structuredClone(legacy);
  const migrated = migrateProjectsRecord(legacy);
  assert.equal(migrated.schemaVersion, 2);
  assert.deepEqual(migrated.projects[0].featureIds, [feature.id]);
  assert.deepEqual(migrated.projects[0].knowledgeIds, ["material-project"]);
  assert.deepEqual(migrated.features[0].knowledgeIds, ["material-feature"]);
  assert.equal(migrated.features[0].projectId, undefined);
  assert.equal(migrated.materials[1].featureId, undefined);
  assert.equal(migrated.materials[1].content, before.materials[1].content);
  assert.equal(migrated.analyses[0].projectId, "");
  assert.deepEqual(migrated.analyses[0].result, before.analyses[0].result);
  assert.deepEqual(
    migrated.analyses[0].context.materials,
    before.analyses[0].context.materials,
  );
  assert.deepEqual(legacy, before);
  assert.deepEqual(migrateProjectsRecord(migrated), migrated);
});

test("knowledge e feature independentes podem ser reutilizados sem exclusão em cascata", async () => {
  const injector = createEnvironmentInjector(
    [
      {
        provide: ProjectsRepository,
        useValue: { load: async () => null, save: async () => undefined },
      },
      { provide: AI_PROVIDER, useValue: new UnavailableAIProvider() },
      {
        provide: BackendModeService,
        useFactory: () => new BackendModeService(),
      },
      { provide: ProjectsStore, useFactory: () => new ProjectsStore() },
    ],
    null as never,
  );
  try {
    const store = injector.get(ProjectsStore);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const k1 = store.saveKnowledge({
      title: "Referência compartilhada",
      content: "Original",
      type: "text",
    })!;
    const k2 = store.saveKnowledge({
      title: "Referência direta",
      content: "Apenas projeto",
      type: "idea",
    })!;
    const f = store.saveFeature("", {
      name: "Feature independente",
      description: "",
      objective: "",
      context: "",
      status: "idea",
    })!;
    assert.ok(f);
    assert.equal(store.record().projects.length, 0);
    assert.ok(store.setLinks("feature", f, "knowledgeIds", [k1, k2]));
    const standalone = store.context("", f, {
      includeProject: false,
      includeFeature: true,
      materialIds: [k1],
      requirementIds: [],
    });
    assert.equal(standalone.project, undefined);
    assert.equal(standalone.materials[0].id, k1);
    const form = {
      name: "Projeto A",
      description: "Agrupamento",
      objective: "",
      context: "",
      status: "planning" as const,
    };
    const a = store.saveProject(form)!,
      b = store.saveProject({ ...form, name: "Projeto B" })!;
    assert.ok(store.setLinks("project", a, "featureIds", [f]));
    assert.ok(store.setLinks("project", b, "featureIds", [f]));
    assert.ok(store.setLinks("project", a, "knowledgeIds", [k2]));
    assert.equal(store.features(a)[0].id, store.features(b)[0].id);
    assert.equal(store.materials(a).length, 2); // De-duplicates direct and inherited knowledge.
    assert.equal(
      store.context(a, undefined, {
        includeProject: true,
        includeFeature: false,
        materialIds: [k1, k2],
        requirementIds: [],
      }).materials.length,
      2,
    );
    const invalid = store.exportBackup();
    assert.equal(
      store.setLinks("feature", f, "knowledgeIds", ["missing"]),
      false,
    );
    assert.equal(store.exportBackup(), invalid);
    const backup = JSON.parse(store.exportProject(a));
    assert.equal(backup.features.length, 1);
    assert.equal(backup.materials.length, 2);
    assert.ok(store.setLinks("project", a, "featureIds", []));
    assert.deepEqual(store.project(a)?.knowledgeIds, [k2]);
    assert.equal(store.materials(a).length, 1);
    store.deleteProject(a);
    assert.ok(store.feature(f));
    assert.equal(store.record().materials.length, 2);
    store.deleteFeature(f);
    assert.deepEqual(store.project(b)?.featureIds, []);
    assert.equal(store.record().materials.length, 2);
  } finally {
    injector.destroy();
  }
});

test("atendimento prepara transcrição, perguntas e referências sem reclassificar knowledge", () => {
  const source = migrateProjectsRecord(record());
  const f = source.features[0];
  f.question = "O atendente confirmou a resolução?";
  f.objective = "Verificar confirmação explícita do cliente.";
  const selection = {
    includeProject: false,
    includeFeature: false,
    materialIds: ["material-feature"],
    requirementIds: [],
    featureIds: [f.id],
    transcript: "Atendente: Resolveu?\nCliente: Sim, obrigado.",
  };
  const context = prepareContext(
    source.projects[0],
    undefined,
    source.materials,
    [],
    selection,
    source.features,
  );
  validateAttendanceContext(context);
  assert.equal(context.transcript, selection.transcript);
  assert.equal(context.evaluationQuestions?.[0].question, f.question);
  assert.equal(context.evaluationQuestions?.[0].criteria, f.objective);
  assert.deepEqual(context.evaluationQuestions?.[0].knowledgeIds, [
    "material-feature",
  ]);
  assert.equal(context.materials[0].content, "Transcrição original");
  f.question = "Outra pergunta";
  source.materials[1].content = "Outro conteúdo";
  assert.equal(
    context.evaluationQuestions?.[0].question,
    "O atendente confirmou a resolução?",
  );
  assert.equal(context.materials[0].content, "Transcrição original");
  assert.throws(
    () =>
      prepareContext(
        source.projects[0],
        undefined,
        source.materials,
        [],
        { ...selection, featureIds: ["unlinked"] },
        source.features,
      ),
    /pergunta selecionada/,
  );
  assert.throws(
    () => validateAttendanceContext({ ...context, transcript: " " }),
    /transcrição/,
  );
  assert.throws(
    () => validateAttendanceContext({ ...context, evaluationQuestions: [] }),
    /pergunta/,
  );
  assert.throws(
    () =>
      validateAttendanceContext({
        ...context,
        evaluationQuestions: [
          { ...context.evaluationQuestions![0], question: "" },
        ],
      }),
    /Configure a pergunta/,
  );
});

test("respostas de atendimento cobrem cada pergunta e citam somente a conversa", () => {
  const context = {
    projectId: "project-a",
    transcript: "Cliente: Sim, foi resolvido.",
    materials: [],
    requirements: [],
    evaluationQuestions: [
      {
        featureId: "question-a",
        name: "Resolução",
        question: "A solicitação foi resolvida?",
        knowledgeIds: [],
      },
    ],
  };
  const response = {
    summary: "Avaliação",
    sections: [],
    openQuestions: [],
    evaluations: [
      {
        featureId: "question-a",
        answer: "Sim, o cliente confirmou.",
        evidence: ["Sim, foi resolvido."],
      },
    ],
  };
  validateAttendanceResult(response, context);
  assert.throws(
    () => validateAttendanceResult({ ...response, evaluations: [] }, context),
    /todas as perguntas/,
  );
  assert.throws(
    () =>
      validateAttendanceResult(
        {
          ...response,
          evaluations: [
            {
              ...response.evaluations[0],
              evidence: ["O atendente foi excelente."],
            },
          ],
        },
        context,
      ),
    /evidências/,
  );
  assert.throws(
    () =>
      validateAttendanceResult(
        {
          ...response,
          evaluations: [{ ...response.evaluations[0], featureId: "other" }],
        },
        context,
      ),
    /Resposta inválida/,
  );
  validateAnalysisResult(
    {
      summary: "Avaliação",
      sections: [
        {
          id: "facts",
          title: "Fatos",
          items: [
            {
              text: "O cliente confirmou",
              origin: "provided",
              sourceMaterialIds: [],
              sourceContext: "transcript",
            },
          ],
        },
      ],
      openQuestions: [],
    },
    [],
    ["transcript"],
  );
});

test("adapter recebe a pergunta configurada e a transcrição separada das referências", async () => {
  const source = migrateProjectsRecord(record());
  source.analyses = [];
  source.features[0].question = "O cliente confirmou a resolução?";
  source.settings = {
    ...source.settings,
    providerId: "attendance-test",
    model: "test",
  };
  const transcript = "Cliente: Sim, foi resolvido.";
  let calls = 0;
  const injector = createEnvironmentInjector(
    [
      {
        provide: ProjectsRepository,
        useValue: { load: async () => source, save: async () => undefined },
      },
      {
        provide: BackendModeService,
        useFactory: () => new BackendModeService(),
      },
      {
        provide: AI_PROVIDER,
        useValue: {
          id: "attendance-test",
          name: "Teste",
          available: true,
          transport: "browser-local",
          usesApplicationBackend: false,
          supportedParameters: {},
          analyze: async (request: any) => {
            calls++;
            assert.equal(request.context.transcript, transcript);
            assert.equal(
              request.context.evaluationQuestions[0].question,
              source.features[0].question,
            );
            assert.equal(
              request.context.materials[0].content,
              "Transcrição original",
            );
            return {
              summary: "Avaliado",
              sections: [],
              openQuestions: [],
              evaluations: [
                {
                  featureId: feature.id,
                  answer: "Sim, houve confirmação.",
                  evidence: ["Sim, foi resolvido."],
                },
              ],
            };
          },
        },
      },
      { provide: ProjectsStore, useFactory: () => new ProjectsStore() },
    ],
    null as never,
  );
  try {
    const store = injector.get(ProjectsStore);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const selection = {
      includeProject: false,
      includeFeature: false,
      materialIds: ["material-feature"],
      requirementIds: [],
      featureIds: [feature.id],
      transcript,
    };
    assert.equal(
      await store.analyze("", feature.id, "attendance", "", {
        ...selection,
        transcript: "",
      }),
      null,
    );
    assert.equal(calls, 0);
    const analysis = await store.analyze(
      "",
      feature.id,
      "attendance",
      "",
      selection,
    );
    assert.ok(analysis);
    assert.equal(calls, 1);
    assert.equal(analysis.result.evaluations?.length, 1);
    assert.ok(
      analysisMarkdown(analysis).includes(source.features[0].question!),
    );
    assert.equal(
      validateProjectsRecord(JSON.parse(store.exportBackup())).analyses[0]
        .context.transcript,
      transcript,
    );
    const bad = JSON.parse(store.exportBackup());
    bad.analyses[0].result.evaluations[0].evidence = ["Fala inventada"];
    assert.throws(() => validateProjectsRecord(bad), /evidências/);
  } finally {
    injector.destroy();
  }
});
