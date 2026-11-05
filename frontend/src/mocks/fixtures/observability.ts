import type {
  ObservationSnapshot,
  Task,
  TaskStatus,
} from "../../app/features/observability/models/observability.models";

const start = Date.parse("2026-11-03T12:00:00-03:00");
const iso = (offset: number) => new Date(start + offset).toISOString();
/** Dados inteiramente fictícios; ondas e relações explícitas, nunca calculadas pelo frontend. */
export function observationFixture(
  large = false,
  tick = 0,
): ObservationSnapshot {
  const tasks: Task[] = [];
  const groups = large ? 20 : 2;
  for (let group = 0; group < groups; group++) {
    const workflowId = group % 2 === 0 ? "commerce" : "finance";
    const businessUnit = group % 2 === 0 ? "Comercial" : "Financeiro";
    const prefix = `${workflowId}-${group}`;
    const definitions: [string, string, number, number[], TaskStatus][] = [
      ["clientes", "SOR", 1, [], "completed"],
      ["pedidos", "SOR", 1, [], "completed"],
      ["produtos", "SOR", 1, [], "completed"],
      ["clientes_limpos", "SOT", 2, [0], "completed"],
      ["pedidos_validados", "SOT", 2, [0, 1], "error"],
      ["catalogo", "SOT", 2, [2], "completed"],
      ["dim_clientes", "SOT", 3, [3], "completed"],
      ["fato_pedidos", "SOT", 3, [4, 5], "waiting"],
      ["estoque", "SOT", 3, [5], tick === 0 ? "running" : "completed"],
      ["receita_diaria", "SPEC", 4, [6, 7], "waiting"],
      [
        "disponibilidade",
        "SPEC",
        4,
        [8],
        tick === 0 ? "pending" : tick === 1 ? "running" : "completed",
      ],
      [
        "painel_executivo",
        "SPEC",
        5,
        [9, 10],
        group === 1 ? "cancelled" : "pending",
      ],
    ];
    if (group === 1) definitions[6][4] = "skipped";
    definitions.forEach(([name, layer, wave, dependencies, status], index) => {
      const finished = ["completed", "error", "skipped", "cancelled"].includes(
        status,
      );
      const active = ["completed", "error", "running"].includes(status);
      const startedAt = active ? iso((wave - 1) * 120000) : undefined;
      const runDuration = index === 10 ? 30000 : 90000;
      const finishedAt =
        finished && active ? iso((wave - 1) * 120000 + runDuration) : undefined;
      tasks.push({
        id: `${prefix}-${index}`,
        name: `${name}${group > 1 ? `_${group}` : ""}`,
        businessUnit,
        layer,
        table: `${businessUnit.toLowerCase()}.${name}${group > 1 ? `_${group}` : ""}`,
        targetTable: `${layer}.${name}`,
        yamlFile: `${businessUnit.toLowerCase()}/${layer}/${name}/task.yaml`,
        workflowId,
        wave,
        dependencies: dependencies.map((dep) => `${prefix}-${dep}`),
        status,
        configuration: {
          processing_type: "incremental",
          filter_period: "daily",
          partition_by: ["data_referencia"],
          write_strategy: index === 4 ? "merge" : "append",
          ...(index === 4
            ? {
                merge: { keys: ["id_pedido"], when_matched: "update" },
                delete_sql:
                  "DELETE FROM SOT.pedidos_validados WHERE data_referencia = :data_referencia",
              }
            : {}),
          source: { format: "parquet", path: `demo/${name}` },
        },
        execution: {
          startedAt,
          finishedAt,
          durationMs: active
            ? finished
              ? runDuration
              : 360000 - (wave - 1) * 120000 + tick * 15000
            : undefined,
          ...(status === "error"
            ? {
                error:
                  "Falha de qualidade: 18 registros sem id_cliente. A execução foi interrompida na validação de integridade.",
              }
            : {}),
          metadata: {
            ...(active ? { rows_read: 12480 + index * 170, attempt: 1 } : {}),
            run_id: "demo-run-001",
          },
        },
      });
    });
  }
  return {
    source: "demo",
    observedAt: iso(360000 + tick * 15000),
    tasks,
    workflows: [
      {
        id: "commerce",
        name: "Pipeline comercial",
        status: "error",
        startedAt: iso(0),
        waves: [1, 2, 3, 4, 5].map((number) => ({
          number,
          label: `Onda ${number}`,
        })),
      },
      {
        id: "finance",
        name: "Pipeline financeiro",
        status: "error",
        startedAt: iso(0),
        waves: [1, 2, 3, 4, 5].map((number) => ({
          number,
          label: `Onda ${number}`,
        })),
      },
    ],
  };
}
