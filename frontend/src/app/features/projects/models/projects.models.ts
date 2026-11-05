export const PROJECT_STATUSES = [
  { id: "planning", label: "Planejamento" },
  { id: "active", label: "Em andamento" },
  { id: "paused", label: "Pausado" },
  { id: "completed", label: "Concluído" },
] as const;
export const FEATURE_STATUSES = [
  { id: "idea", label: "Em configuração" },
  { id: "analysis", label: "Em validação" },
  { id: "defined", label: "Pronta para avaliar" },
  { id: "development", label: "Em revisão" },
  { id: "completed", label: "Validada" },
  { id: "archived", label: "Arquivada" },
] as const;
export const MATERIAL_TYPES = [
  { id: "text", label: "Texto livre" },
  { id: "idea", label: "Ideia" },
  { id: "requirements", label: "Requisitos informais" },
  { id: "transcript", label: "Transcrição" },
  { id: "document", label: "Documento textual" },
] as const;
export const ANALYSIS_TYPES = [
  { id: "attendance", label: "Avaliação de atendimento" },
  { id: "idea", label: "Análise de ideia" },
  { id: "requirements", label: "Análise de requisitos" },
  { id: "technical", label: "Análise técnica" },
  { id: "consolidation", label: "Consolidação de informações" },
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]["id"];
export type FeatureStatus = (typeof FEATURE_STATUSES)[number]["id"];
export type MaterialType = (typeof MATERIAL_TYPES)[number]["id"];
export type AnalysisType = (typeof ANALYSIS_TYPES)[number]["id"];
export interface Project {
  featureIds?: string[];
  knowledgeIds?: string[];
  id: string;
  name: string;
  description: string;
  objective: string;
  context: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}
export interface Feature {
  question?: string;
  knowledgeIds?: string[];
  id: string;
  /** Legacy ownership, accepted only while migrating version 1. */
  projectId?: string;
  name: string;
  description: string;
  objective: string;
  context: string;
  status: FeatureStatus;
  createdAt: string;
  updatedAt: string;
}
export interface Knowledge {
  id: string;
  /** Legacy ownership, accepted only while migrating version 1. */
  projectId?: string;
  featureId?: string;
  type: MaterialType;
  title: string;
  content: string;
  createdAt: string;
}
/** Analysis snapshots retain the original material contract. */
export type Material = Knowledge;
export interface Requirement {
  id: string;
  projectId: string;
  featureId?: string;
  title: string;
  description: string;
  status: "draft" | "approved";
  createdAt: string;
}
export interface ContextSelection {
  transcript?: string;
  featureIds?: string[];
  includeProject: boolean;
  includeFeature: boolean;
  materialIds: string[];
  requirementIds: string[];
}
export interface EvaluationQuestion {
  criteria?: string;
  instructions?: string;
  featureId: string;
  name: string;
  question: string;
  knowledgeIds: string[];
}
export interface PreparedContext {
  transcript?: string;
  evaluationQuestions?: EvaluationQuestion[];
  projectId: string;
  featureId?: string;
  project?: Pick<Project, "name" | "description" | "objective" | "context">;
  feature?: Pick<Feature, "name" | "description" | "objective" | "context">;
  materials: Material[];
  requirements: Requirement[];
}
export interface AnalysisItem {
  text: string;
  origin: "provided" | "hypothesis" | "suggestion";
  sourceMaterialIds: string[];
  sourceContext?: "project" | "feature" | "requirements" | "transcript";
}
export interface AnalysisSection {
  id: string;
  title: string;
  items: AnalysisItem[];
}
export interface FeatureEvaluation {
  featureId: string;
  answer: string;
  evidence: string[];
}
export interface AnalysisResult {
  evaluations?: FeatureEvaluation[];
  summary: string;
  sections: AnalysisSection[];
  openQuestions: string[];
}
export interface AISettings {
  schemaVersion: 1;
  providerId: string;
  model: string;
  defaultType: AnalysisType;
  customInstructions: string;
  parameters: Record<string, string | number | boolean>;
}
export interface AnalysisRequest {
  type: AnalysisType;
  instruction: string;
  context: PreparedContext;
  settings: AISettings;
  previous?: { id: string; version: number; result: AnalysisResult };
}
export interface AnalysisRun {
  id: string;
  projectId: string;
  featureId?: string;
  type: AnalysisType;
  createdAt: string;
  version: number;
  parentId?: string;
  instruction: string;
  context: PreparedContext;
  settings: AISettings;
  result: AnalysisResult;
  providerId: string;
  model: string;
}
export interface ProjectsRecord {
  schemaVersion: 1 | 2;
  ownerId: string;
  projects: Project[];
  features: Feature[];
  materials: Material[];
  requirements: Requirement[];
  analyses: AnalysisRun[];
  settings: AISettings;
}
export const DEFAULT_AI_SETTINGS: AISettings = {
  schemaVersion: 1,
  providerId: "unconfigured",
  model: "",
  defaultType: "attendance",
  customInstructions:
    "Avalie cada pergunta com base na transcrição do atendimento. Use os knowledges apenas como referência. Cite trechos da conversa como evidência e informe quando não houver informação suficiente para responder. Não invente falas ou conclusões.",
  parameters: {},
};
