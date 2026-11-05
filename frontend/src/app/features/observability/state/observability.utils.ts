import {
  EMPTY_FILTERS,
  ObservationSnapshot,
  Task,
  TaskFilters,
  TaskStatus,
} from "../models/observability.models";
export function filterTasks(tasks: Task[], filters: TaskFilters): Task[] {
  const query = filters.search.trim().toLocaleLowerCase("pt-BR");
  return tasks.filter(
    (t) =>
      (!filters.businessUnit || t.businessUnit === filters.businessUnit) &&
      (!filters.layer || t.layer === filters.layer) &&
      (!filters.workflowId || t.workflowId === filters.workflowId) &&
      (!filters.status || t.status === filters.status) &&
      (!query ||
        `${t.name} ${t.table}`.toLocaleLowerCase("pt-BR").includes(query)),
  );
}
export function summary(tasks: Task[]) {
  return {
    total: tasks.length,
    completed: tasks.filter((t) => t.status === "completed").length,
    running: tasks.filter((t) => t.status === "running").length,
    pending: tasks.filter(
      (t) => t.status === "pending" || t.status === "waiting",
    ).length,
    error: tasks.filter((t) => t.status === "error").length,
    other: tasks.filter(
      (t) => t.status === "skipped" || t.status === "cancelled",
    ).length,
    waves: new Set(tasks.map((t) => `${t.workflowId}:${t.wave}`)).size,
  };
}
/** Duração do intervalo observado das tasks filtradas, sem somar tarefas paralelas. */
export function elapsed(tasks: Task[], observedAt: string): number | undefined {
  const starts = tasks
    .flatMap((t) =>
      t.execution?.startedAt ? [Date.parse(t.execution.startedAt)] : [],
    )
    .filter(Number.isFinite);
  if (!starts.length) return undefined;
  const open = tasks.some(
    (t) => t.status === "running" && t.execution?.startedAt,
  );
  const ends = tasks
    .flatMap((t) =>
      t.execution?.finishedAt ? [Date.parse(t.execution.finishedAt)] : [],
    )
    .filter(Number.isFinite);
  if (open) ends.push(Date.parse(observedAt));
  return ends.length
    ? Math.max(0, Math.max(...ends) - Math.min(...starts))
    : undefined;
}
export function waveSummaries(
  snapshot: ObservationSnapshot | null,
  tasks: Task[],
) {
  return (snapshot?.workflows ?? [])
    .flatMap((w) =>
      w.waves.map((wave) => {
        const members = tasks.filter(
          (t) => t.workflowId === w.id && t.wave === wave.number,
        );
        const errors = members.filter((t) => t.status === "error").length;
        const status: TaskStatus = errors
          ? "error"
          : members.some((t) => t.status === "running")
            ? "running"
            : members.every((t) =>
                  ["completed", "skipped", "cancelled"].includes(t.status),
                )
              ? members.some((t) => t.status === "cancelled")
                ? "cancelled"
                : members.every((t) => t.status === "skipped")
                  ? "skipped"
                  : "completed"
              : "pending";
        return {
          key: `${w.id}:${wave.number}`,
          workflow: w.name,
          label: wave.label,
          members,
          errors,
          status,
          completed: members.filter((t) =>
            ["completed", "skipped", "cancelled"].includes(t.status),
          ).length,
        };
      }),
    )
    .filter((w) => w.members.length > 0);
}
export { EMPTY_FILTERS };
