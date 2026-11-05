export type TaskStatus =
  | "pending"
  | "waiting"
  | "running"
  | "completed"
  | "error"
  | "skipped"
  | "cancelled";
export const STATUS: Record<TaskStatus, { label: string; icon: string }> = {
  pending: { label: "Pendente", icon: "○" },
  waiting: { label: "Aguardando dependências", icon: "◷" },
  running: { label: "Em execução", icon: "↻" },
  completed: { label: "Concluída", icon: "✓" },
  error: { label: "Erro", icon: "!" },
  skipped: { label: "Ignorada", icon: "↷" },
  cancelled: { label: "Cancelada", icon: "×" },
};
export interface Task {
  id: string;
  name: string;
  businessUnit: string;
  layer: string;
  table: string;
  targetTable?: string;
  yamlFile?: string;
  workflowId: string;
  wave: number;
  dependencies: string[];
  status: TaskStatus;
  configuration: Record<string, unknown>;
  execution?: {
    startedAt?: string;
    finishedAt?: string;
    durationMs?: number;
    error?: string;
    metadata?: Record<string, unknown>;
  };
}
export interface Workflow {
  id: string;
  name: string;
  status: TaskStatus;
  startedAt?: string;
  finishedAt?: string;
  waves: { number: number; label: string }[];
}
/** Contrato de apresentação local. Ainda não representa uma API do orquestrador. */
export interface ObservationSnapshot {
  source: "demo";
  observedAt: string;
  workflows: Workflow[];
  tasks: Task[];
}
export interface TaskFilters {
  businessUnit: string;
  layer: string;
  workflowId: string;
  status: string;
  search: string;
}
export const EMPTY_FILTERS: TaskFilters = {
  businessUnit: "",
  layer: "",
  workflowId: "",
  status: "",
  search: "",
};
export function duration(ms?: number): string {
  if (ms === undefined || !Number.isFinite(ms)) return "—";
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return seconds >= 3600
    ? `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}min`
    : `${Math.floor(seconds / 60)}min ${String(seconds % 60).padStart(2, "0")}s`;
}
