import { isCredentialParameter } from "../models/ai-settings.utils";
import {
  ANALYSIS_TYPES,
  AISettings,
  DEFAULT_AI_SETTINGS,
  FEATURE_STATUSES,
  MATERIAL_TYPES,
  PROJECT_STATUSES,
  ProjectsRecord,
} from "../models/projects.models";
import {
  validateAnalysisResult,
  validateAttendanceContext,
  validateAttendanceResult,
} from "./context-engine";
const string = (v: unknown, max = 200000) =>
  typeof v === "string" && v.length <= max;
const date = (v: unknown) =>
  string(v, 40) && Number.isFinite(Date.parse(v as string));
const id = (v: unknown) =>
  typeof v === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(v);
function validSettings(value: unknown): value is AISettings {
  if (!value || typeof value !== "object") return false;
  const settings = value as AISettings;
  return (
    settings.schemaVersion === 1 &&
    string(settings.providerId, 100) &&
    string(settings.model, 200) &&
    ANALYSIS_TYPES.some((t) => t.id === settings.defaultType) &&
    string(settings.customInstructions, 20000) &&
    !!settings.parameters &&
    typeof settings.parameters === "object" &&
    !Array.isArray(settings.parameters) &&
    Object.entries(settings.parameters).every(
      ([key, value]) =>
        !isCredentialParameter(key) &&
        ["string", "number", "boolean"].includes(typeof value) &&
        (typeof value !== "number" || Number.isFinite(value)),
    )
  );
}
function validateLegacyRecord(value: unknown): ProjectsRecord {
  if (!value || typeof value !== "object")
    throw new Error("Arquivo de projetos inválido.");
  const record = value as ProjectsRecord;
  if (
    record.schemaVersion !== 1 ||
    !string(record.ownerId, 100) ||
    !Array.isArray(record.projects) ||
    !Array.isArray(record.features) ||
    !Array.isArray(record.materials) ||
    !Array.isArray(record.requirements) ||
    !Array.isArray(record.analyses)
  )
    throw new Error("Versão ou estrutura de projetos incompatível.");
  if (
    record.projects.length > 200 ||
    record.features.length > 2000 ||
    record.materials.length > 3000 ||
    record.analyses.length > 1000 ||
    record.requirements.length > 5000
  )
    throw new Error("O arquivo excede os limites do workspace local.");
  const allIds = new Set<string>();
  const checkId = (value: string) => {
    if (!id(value) || allIds.has(value))
      throw new Error("Identificador inválido ou duplicado.");
    allIds.add(value);
  };
  for (const project of record.projects) {
    checkId(project.id);
    if (
      project.id === "ai-settings" ||
      !string(project.name, 160) ||
      !project.name.trim() ||
      !string(project.description) ||
      !string(project.objective) ||
      !string(project.context) ||
      !PROJECT_STATUSES.some((s) => s.id === project.status) ||
      !date(project.createdAt) ||
      !date(project.updatedAt)
    )
      throw new Error("Projeto inválido.");
  }
  const projectIds = new Set(record.projects.map((p) => p.id)),
    features = new Map(record.features.map((f) => [f.id, f]));
  for (const feature of record.features) {
    checkId(feature.id);
    if (
      !projectIds.has(feature.projectId ?? "") ||
      !string(feature.name, 160) ||
      !feature.name.trim() ||
      !string(feature.description) ||
      !string(feature.context) ||
      !string(feature.objective) ||
      !FEATURE_STATUSES.some((s) => s.id === feature.status) ||
      !date(feature.createdAt) ||
      !date(feature.updatedAt)
    )
      throw new Error("Feature inválida.");
  }
  const scope = (projectId: string | undefined, featureId?: string) =>
    projectIds.has(projectId ?? "") &&
    (!featureId || features.get(featureId)?.projectId === projectId);
  for (const material of record.materials) {
    checkId(material.id);
    if (
      !scope(material.projectId, material.featureId) ||
      !MATERIAL_TYPES.some((t) => t.id === material.type) ||
      !string(material.title, 160) ||
      !material.title.trim() ||
      !string(material.content) ||
      !material.content.trim() ||
      !date(material.createdAt)
    )
      throw new Error("Material inválido.");
  }
  for (const requirement of record.requirements) {
    checkId(requirement.id);
    if (
      !scope(requirement.projectId, requirement.featureId) ||
      !string(requirement.title, 160) ||
      !requirement.title.trim() ||
      !string(requirement.description) ||
      !["draft", "approved"].includes(requirement.status) ||
      !date(requirement.createdAt)
    )
      throw new Error("Requisito inválido.");
  }
  for (const run of record.analyses) {
    checkId(run.id);
    if (
      !validSettings(run.settings) ||
      !scope(run.projectId, run.featureId) ||
      !ANALYSIS_TYPES.some((t) => t.id === run.type) ||
      !date(run.createdAt) ||
      !Number.isInteger(run.version) ||
      run.version < 1 ||
      !string(run.instruction) ||
      !string(run.providerId, 100) ||
      !string(run.model, 200) ||
      run.context?.projectId !== run.projectId ||
      run.context.featureId !== run.featureId ||
      !Array.isArray(run.context.materials) ||
      !Array.isArray(run.context.requirements)
    )
      throw new Error("Histórico de análise inválido.");
    for (const material of run.context.materials)
      if (
        !scope(material.projectId, material.featureId) ||
        material.projectId !== run.projectId ||
        (material.featureId && material.featureId !== run.featureId) ||
        !string(material.content) ||
        !string(material.title, 160)
      )
        throw new Error("Contexto da análise pertence a outro escopo.");
    for (const requirement of run.context.requirements)
      if (
        requirement.projectId !== run.projectId ||
        (requirement.featureId && requirement.featureId !== run.featureId) ||
        !string(requirement.title, 160) ||
        !string(requirement.description)
      )
        throw new Error("Requisito fora do contexto.");
    validateAnalysisResult(
      run.result,
      run.context.materials.map((m) => m.id),
      [
        ...(run.context.transcript ? ["transcript"] : []),
        ...(run.context.project ? ["project"] : []),
        ...(run.context.feature ? ["feature"] : []),
        ...(run.context.requirements.length ? ["requirements"] : []),
      ],
    );
  }
  for (const run of record.analyses) {
    if (run.type === "attendance")
      validateAttendanceResult(run.result, run.context);
    if (run.parentId) {
      const parent = record.analyses.find((p) => p.id === run.parentId);
      if (
        !parent ||
        parent.projectId !== run.projectId ||
        parent.featureId !== run.featureId ||
        parent.type !== run.type ||
        parent.version >= run.version
      )
        throw new Error("Referência de refinamento inválida.");
    }
  }
  const settings = record.settings ?? DEFAULT_AI_SETTINGS;
  if (!validSettings(settings))
    throw new Error("Configurações de IA inválidas.");
  return structuredClone({ ...record, settings });
}
export function migrateProjectsRecord(value: unknown): ProjectsRecord {
  if (!value || typeof value !== "object") throw new Error("Arquivo inválido.");
  if ((value as ProjectsRecord).schemaVersion === 2)
    return validateProjectsRecord(value);
  const record = validateLegacyRecord(value);
  for (const project of record.projects) {
    project.featureIds = record.features
      .filter((f) => f.projectId === project.id)
      .map((f) => f.id);
    project.knowledgeIds = record.materials
      .filter((m) => m.projectId === project.id && !m.featureId)
      .map((m) => m.id);
  }
  for (const feature of record.features) {
    feature.knowledgeIds = record.materials
      .filter((m) => m.featureId === feature.id)
      .map((m) => m.id);
    delete feature.projectId;
  }
  for (const material of record.materials) {
    delete material.projectId;
    delete material.featureId;
  }
  // Feature decisions and analyses follow the independent feature, including their snapshots.
  for (const req of record.requirements) if (req.featureId) req.projectId = "";
  for (const run of record.analyses)
    if (run.featureId) {
      run.projectId = "";
      run.context.projectId = "";
    }
  record.schemaVersion = 2;
  return validateProjectsRecord(record);
}
export function validateProjectsRecord(value: unknown): ProjectsRecord {
  if ((value as ProjectsRecord)?.schemaVersion === 1)
    return migrateProjectsRecord(value);
  if (!value || typeof value !== "object") throw new Error("Arquivo inválido.");
  const record = structuredClone(value) as ProjectsRecord;
  if (
    record.schemaVersion !== 2 ||
    !string(record.ownerId, 100) ||
    ![
      record.projects,
      record.features,
      record.materials,
      record.requirements,
      record.analyses,
    ].every(Array.isArray)
  )
    throw new Error("Versão ou estrutura de projetos incompatível.");
  if (
    record.projects.length > 200 ||
    record.features.length > 2000 ||
    record.materials.length > 3000 ||
    record.requirements.length > 5000 ||
    record.analyses.length > 1000
  )
    throw new Error("O arquivo excede os limites do workspace local.");
  const ids = new Set<string>();
  for (const item of [
    ...record.projects,
    ...record.features,
    ...record.materials,
    ...record.requirements,
    ...record.analyses,
  ]) {
    if (!item || !id(item.id) || ids.has(item.id))
      throw new Error("Identificador inválido ou duplicado.");
    ids.add(item.id);
  }
  const features = new Set(record.features.map((f) => f.id));
  const knowledges = new Set(record.materials.map((m) => m.id));
  const projects = new Set(record.projects.map((p) => p.id));
  const links = (values: unknown, available: Set<string>) =>
    Array.isArray(values) &&
    new Set(values).size === values.length &&
    values.every((v) => available.has(v));
  for (const p of record.projects) {
    if (
      ["ai-settings", "features"].includes(p.id) ||
      !string(p.name, 160) ||
      !p.name.trim() ||
      !string(p.description) ||
      !string(p.objective) ||
      !string(p.context) ||
      !date(p.createdAt) ||
      !date(p.updatedAt) ||
      !PROJECT_STATUSES.some((s) => s.id === p.status) ||
      !links(p.featureIds, features) ||
      !links(p.knowledgeIds, knowledges)
    )
      throw new Error("Projeto ou vínculos inválidos.");
  }
  for (const f of record.features) {
    if (
      (f.question !== undefined && !string(f.question, 20000)) ||
      !string(f.name, 160) ||
      !f.name.trim() ||
      !string(f.description) ||
      !string(f.objective) ||
      !string(f.context) ||
      !date(f.createdAt) ||
      !date(f.updatedAt) ||
      !FEATURE_STATUSES.some((s) => s.id === f.status) ||
      !links(f.knowledgeIds, knowledges)
    )
      throw new Error("Feature ou vínculos inválidos.");
  }
  for (const m of record.materials) {
    if (
      !string(m.title, 160) ||
      !m.title.trim() ||
      !string(m.content) ||
      !m.content.trim() ||
      !date(m.createdAt) ||
      !MATERIAL_TYPES.some((t) => t.id === m.type)
    )
      throw new Error("Knowledge inválido.");
  }
  const scope = (p: string, f?: string) =>
    (p ? projects.has(p) : !!f) && (!f || features.has(f));
  for (const r of record.requirements) {
    if (
      !scope(r.projectId, r.featureId) ||
      !string(r.title, 160) ||
      !r.title.trim() ||
      !string(r.description) ||
      !date(r.createdAt) ||
      !["draft", "approved"].includes(r.status)
    )
      throw new Error("Requisito inválido.");
  }
  for (const run of record.analyses) {
    if (
      !scope(run.projectId, run.featureId) ||
      !validSettings(run.settings) ||
      !ANALYSIS_TYPES.some((t) => t.id === run.type) ||
      !date(run.createdAt) ||
      !Number.isInteger(run.version) ||
      run.version < 1 ||
      !string(run.instruction) ||
      !string(run.providerId, 100) ||
      !string(run.model, 200) ||
      run.context?.projectId !== run.projectId ||
      run.context.featureId !== run.featureId ||
      !Array.isArray(run.context.materials) ||
      !Array.isArray(run.context.requirements)
    )
      throw new Error("Histórico de análise inválido.");
    // Snapshots remain valid when a source is unlinked or its original text changes.
    for (const m of run.context.materials)
      if (!id(m.id) || !string(m.title, 160) || !string(m.content))
        throw new Error("Fonte histórica inválida.");
    for (const r of run.context.requirements)
      if (!id(r.id) || !string(r.title, 160) || !string(r.description))
        throw new Error("Requisito histórico inválido.");
    validateAnalysisResult(
      run.result,
      run.context.materials.map((m) => m.id),
      [
        ...(run.context.transcript ? ["transcript"] : []),
        ...(run.context.project ? ["project"] : []),
        ...(run.context.feature ? ["feature"] : []),
        ...(run.context.requirements.length ? ["requirements"] : []),
      ],
    );
    if (run.type === "attendance")
      validateAttendanceResult(run.result, run.context);
    if (run.parentId) {
      const parent = record.analyses.find((a) => a.id === run.parentId);
      if (
        !parent ||
        parent.projectId !== run.projectId ||
        parent.featureId !== run.featureId ||
        parent.type !== run.type ||
        parent.version >= run.version
      )
        throw new Error("Referência de refinamento inválida.");
    }
  }
  record.settings ??= structuredClone(DEFAULT_AI_SETTINGS);
  if (!validSettings(record.settings))
    throw new Error("Configurações de IA inválidas.");
  return record;
}
