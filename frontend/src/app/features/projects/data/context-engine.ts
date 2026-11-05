import {
  AnalysisResult,
  AnalysisRun,
  ContextSelection,
  Feature,
  Material,
  PreparedContext,
  Project,
  Requirement,
} from "../models/projects.models";
export function availableMaterials(
  materials: Material[],
  projectId: string,
  featureId?: string,
): Material[] {
  return materials.filter(
    (m) =>
      m.projectId === projectId &&
      (featureId ? !m.featureId || m.featureId === featureId : !m.featureId),
  );
}
export function prepareContext(
  project: Project | undefined,
  feature: Feature | undefined,
  materials: Material[],
  requirements: Requirement[],
  selection: ContextSelection,
  linkedFeatures: Feature[] = [],
): PreparedContext {
  if (
    project &&
    feature &&
    !(project.featureIds ?? []).includes(feature.id) &&
    feature.projectId !== project.id
  )
    throw new Error("A feature não pertence ao projeto selecionado.");
  const candidates = feature
    ? [feature]
    : linkedFeatures.filter((f) => project?.featureIds?.includes(f.id));
  const questionIds = selection.featureIds ?? [];
  const questions = candidates.filter((f) => questionIds.includes(f.id));
  if (questions.length !== new Set(questionIds).size)
    throw new Error("Uma pergunta selecionada não pertence a este contexto.");
  const allowed =
    project?.knowledgeIds || feature?.knowledgeIds
      ? new Set([
          ...(project?.knowledgeIds ?? []),
          ...(feature
            ? (feature.knowledgeIds ?? [])
            : linkedFeatures
                .filter((f) => project?.featureIds?.includes(f.id))
                .flatMap((f) => f.knowledgeIds ?? [])),
        ])
      : new Set(
          availableMaterials(materials, project?.id ?? "", feature?.id).map(
            (m) => m.id,
          ),
        );
  const selected = materials.filter(
    (m) => allowed.has(m.id) && selection.materialIds.includes(m.id),
  );
  if (selected.length !== new Set(selection.materialIds).size)
    throw new Error("Um material selecionado não pertence ao contexto atual.");
  const selectedRequirements = requirements.filter(
    (req) =>
      (feature
        ? req.featureId === feature.id ||
          (!!project && req.projectId === project.id && !req.featureId)
        : req.projectId === project?.id) &&
      (feature
        ? !req.featureId || req.featureId === feature.id
        : !req.featureId) &&
      selection.requirementIds.includes(req.id),
  );
  if (selectedRequirements.length !== new Set(selection.requirementIds).size)
    throw new Error("Um requisito selecionado não pertence ao contexto atual.");
  if (
    (selection.includeProject && !project) ||
    (selection.includeFeature && !feature)
  )
    throw new Error("Contexto selecionado não está disponível.");
  if (
    !selection.includeProject &&
    !selection.includeFeature &&
    !selected.length &&
    !selectedRequirements.length &&
    !selection.transcript?.trim() &&
    !questions.length
  )
    throw new Error("Selecione pelo menos uma informação para o contexto.");
  const pick = (value: Project | Feature) => ({
    name: value.name,
    description: value.description,
    objective: value.objective,
    context: value.context,
  });
  return structuredClone({
    projectId: project?.id ?? "",
    ...(feature ? { featureId: feature.id } : {}),
    ...(selection.includeProject && project ? { project: pick(project) } : {}),
    ...(selection.includeFeature && feature ? { feature: pick(feature) } : {}),
    ...(selection.transcript !== undefined
      ? { transcript: selection.transcript.trim() }
      : {}),
    ...(selection.featureIds !== undefined
      ? {
          evaluationQuestions: questions.map((f) => ({
            featureId: f.id,
            name: f.name,
            question: f.question ?? "",
            criteria: f.objective,
            instructions: f.context,
            knowledgeIds: (f.knowledgeIds ?? []).filter((id) =>
              selection.materialIds.includes(id),
            ),
          })),
        }
      : {}),
    materials: selected,
    requirements: selectedRequirements,
  });
}
export function validateAnalysisResult(
  value: unknown,
  materialIds: string[],
  contextSources: string[] = [],
): AnalysisResult {
  if (!value || typeof value !== "object")
    throw new Error("Resultado de IA inválido.");
  const result = value as AnalysisResult;
  if (
    typeof result.summary !== "string" ||
    !Array.isArray(result.sections) ||
    !Array.isArray(result.openQuestions) ||
    result.openQuestions.some((q) => typeof q !== "string")
  )
    throw new Error("A resposta não segue o contrato de análise.");
  const ids = new Set<string>();
  for (const section of result.sections) {
    if (
      !section ||
      typeof section.id !== "string" ||
      ids.has(section.id) ||
      typeof section.title !== "string" ||
      !Array.isArray(section.items)
    )
      throw new Error("Seção de análise inválida.");
    ids.add(section.id);
    for (const item of section.items)
      if (
        !item ||
        typeof item.text !== "string" ||
        !["provided", "hypothesis", "suggestion"].includes(item.origin) ||
        !Array.isArray(item.sourceMaterialIds) ||
        item.sourceMaterialIds.some((id) => !materialIds.includes(id)) ||
        (item.sourceContext !== undefined &&
          !contextSources.includes(item.sourceContext)) ||
        (item.origin === "provided" &&
          !item.sourceMaterialIds.length &&
          !item.sourceContext)
      )
        throw new Error(
          "O resultado deve distinguir fatos com fontes, hipóteses e sugestões.",
        );
  }
  return structuredClone(result);
}
export function analysisMarkdown(run: AnalysisRun): string {
  const origin = {
    provided: "Informação fornecida",
    hypothesis: "Hipótese",
    suggestion: "Sugestão",
  };
  return `# Análise · ${run.type} · v${run.version}\n\n${run.result.summary}\n\n${(run.result.evaluations ?? []).map((e) => `## ${run.context.evaluationQuestions?.find((q) => q.featureId === e.featureId)?.question ?? e.featureId}\n\n${e.answer}\n\n${e.evidence.map((quote) => `> ${quote}`).join("\n")}`).join("\n\n")}\n\n${run.result.sections.map((s) => `## ${s.title}\n\n${s.items.map((item) => `- **${origin[item.origin]}:** ${item.text}${item.sourceMaterialIds.length ? ` (fontes: ${item.sourceMaterialIds.join(", ")})` : ""}`).join("\n")}`).join("\n\n")}\n\n## Questões em aberto\n\n${run.result.openQuestions.map((q) => `- ${q}`).join("\n")}\n\n---\nExecutada em ${run.createdAt} · ${run.providerId} / ${run.model}\nMateriais: ${run.context.materials.map((m) => m.title).join(", ") || "Nenhum"}\n`;
}
export function compareAnalyses(a: AnalysisRun, b: AnalysisRun) {
  if (
    a.projectId !== b.projectId ||
    a.featureId !== b.featureId ||
    a.type !== b.type
  )
    throw new Error("Compare análises do mesmo projeto, feature e tipo.");
  const lines = (run: AnalysisRun) => [
    run.result.summary,
    ...run.result.sections.flatMap((s) =>
      s.items.map((item) => `[${item.origin}] ${item.text}`),
    ),
    ...(run.result.evaluations ?? []).flatMap((e) => [
      e.featureId,
      e.answer,
      ...e.evidence,
    ]),
    ...run.result.openQuestions,
  ];
  const before = lines(a),
    after = lines(b);
  return {
    added: after.filter((line) => !before.includes(line)),
    removed: before.filter((line) => !after.includes(line)),
    unchanged: after.filter((line) => before.includes(line)),
  };
}

export function validateAttendanceContext(context: PreparedContext): void {
  if (
    typeof context.transcript !== "string" ||
    !context.transcript.trim() ||
    context.transcript.length > 200000
  )
    throw new Error(
      "Informe a transcrição do atendimento (até 200 mil caracteres).",
    );
  if (
    !Array.isArray(context.evaluationQuestions) ||
    !context.evaluationQuestions.length
  )
    throw new Error(
      "Selecione pelo menos uma feature com a pergunta a avaliar.",
    );
  const ids = new Set<string>();
  for (const item of context.evaluationQuestions) {
    if (
      !item ||
      typeof item.featureId !== "string" ||
      !item.featureId ||
      ids.has(item.featureId) ||
      typeof item.name !== "string" ||
      typeof item.question !== "string" ||
      !item.question.trim() ||
      item.question.length > 20000 ||
      !Array.isArray(item.knowledgeIds) ||
      item.knowledgeIds.some(
        (id) => !context.materials.some((m) => m.id === id),
      )
    )
      throw new Error(
        "Configure a pergunta de cada feature selecionada antes de avaliar.",
      );
    ids.add(item.featureId);
  }
}
export function validateAttendanceResult(
  result: AnalysisResult,
  context: PreparedContext,
): void {
  validateAttendanceContext(context);
  const ids = new Set<string>();
  if (
    !Array.isArray(result.evaluations) ||
    result.evaluations.length !== context.evaluationQuestions!.length
  )
    throw new Error(
      "A análise precisa responder a todas as perguntas selecionadas.",
    );
  for (const item of result.evaluations) {
    if (
      !item ||
      !context.evaluationQuestions!.some(
        (q) => q.featureId === item.featureId,
      ) ||
      ids.has(item.featureId) ||
      typeof item.answer !== "string" ||
      !item.answer.trim() ||
      !Array.isArray(item.evidence) ||
      item.evidence.some(
        (quote) =>
          typeof quote !== "string" ||
          !quote.trim() ||
          !context.transcript!.includes(quote),
      )
    )
      throw new Error(
        "Resposta inválida: as evidências devem ser trechos presentes na transcrição.",
      );
    ids.add(item.featureId);
  }
}
