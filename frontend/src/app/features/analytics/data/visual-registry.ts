import { FilterDefinition, VisualDefinition } from "../models/analytics.models";
import {
  BarVisual,
  DonutVisual,
  KpiVisual,
  LineVisual,
  TableVisual,
} from "../visuals/visual-components";
const units = ["Comercial", "Financeiro", "Operações"];
function filters(
  datasetId: string,
  table: string,
  date: string,
  status = false,
): FilterDefinition[] {
  return [
    {
      semanticId: "period.start",
      label: "Data inicial",
      type: "date",
      operators: ["gte"],
      mapping: { datasetId, table, field: date },
    },
    {
      semanticId: "period.end",
      label: "Data final",
      type: "date",
      operators: ["lte"],
      mapping: { datasetId, table, field: date },
    },
    {
      semanticId: "business_unit",
      label: "Unidade de negócio",
      type: "string",
      operators: ["eq"],
      options: units,
      mapping: { datasetId, table, field: "business_unit" },
    },
    ...(status
      ? [
          {
            semanticId: "execution.status",
            label: "Status",
            type: "string" as const,
            operators: ["eq" as const],
            options: ["completed", "error", "running", "waiting"],
            mapping: { datasetId, table, field: "status" },
          },
        ]
      : []),
  ];
}
const ops = filters("operations", "executions", "execution_date", true),
  opsNoStatus = filters("operations", "executions", "execution_date"),
  fin = filters("finance", "results", "date");
function definition(
  id: string,
  name: string,
  kind: VisualDefinition["query"]["kind"],
  datasetId: string,
  metric: string,
  aggregate: VisualDefinition["query"]["aggregate"],
  groupBy?: string,
  unit?: string,
  noStatus = false,
): VisualDefinition {
  const component =
    kind === "kpi"
      ? KpiVisual
      : kind === "bar"
        ? BarVisual
        : kind === "line"
          ? LineVisual
          : kind === "donut"
            ? DonutVisual
            : TableVisual;
  return {
    id,
    version: 1,
    name,
    description: `${name}, calculado sobre o dataset local ${datasetId}.`,
    category:
      kind === "kpi"
        ? "Indicadores"
        : kind === "table"
          ? "Tabelas"
          : "Gráficos",
    tags:
      datasetId === "operations"
        ? ["operações", "pipelines"]
        : ["financeiro", "negócio"],
    component,
    datasets: [datasetId],
    filters: datasetId === "finance" ? fin : noStatus ? opsNoStatus : ops,
    layout: {
      minW: kind === "kpi" ? 3 : 4,
      minH: kind === "kpi" ? 2 : 3,
      defaultW: kind === "kpi" ? 4 : 6,
      defaultH: kind === "kpi" ? 2 : 4,
    },
    query: {
      datasetId,
      table: datasetId === "operations" ? "executions" : "results",
      kind,
      metric,
      aggregate,
      groupBy,
      unit,
      ...(kind === "table"
        ? {
            join: {
              table: "units",
              localKey: "unit_id",
              foreignKey: "id",
              prefix: "unit",
            },
          }
        : {}),
    },
  };
}
export const VISUALS: VisualDefinition[] = [
  definition(
    "execution-count",
    "Total de execuções",
    "kpi",
    "operations",
    "execution_id",
    "count",
  ),
  definition(
    "processed-rows",
    "Linhas processadas",
    "kpi",
    "operations",
    "rows_processed",
    "sum",
  ),
  definition(
    "average-duration",
    "Duração média",
    "kpi",
    "operations",
    "duration_minutes",
    "avg",
    undefined,
    "min",
  ),
  definition(
    "status-distribution",
    "Tasks por status",
    "bar",
    "operations",
    "execution_id",
    "count",
    "status",
  ),
  definition(
    "daily-executions",
    "Execuções por dia",
    "line",
    "operations",
    "execution_id",
    "count",
    "execution_date",
    undefined,
    true,
  ),
  definition(
    "layer-share",
    "Distribuição por camada",
    "donut",
    "operations",
    "execution_id",
    "count",
    "layer",
  ),
  definition(
    "executions-table",
    "Tabela de execuções",
    "table",
    "operations",
    "execution_id",
    "count",
  ),
  definition(
    "revenue-total",
    "Receita total",
    "kpi",
    "finance",
    "revenue",
    "sum",
    undefined,
    "R$",
  ),
  definition(
    "cost-total",
    "Custo total",
    "kpi",
    "finance",
    "cost",
    "sum",
    undefined,
    "R$",
  ),
  definition(
    "finance-count",
    "Registros financeiros",
    "kpi",
    "finance",
    "id",
    "count",
  ),
  definition(
    "revenue-by-channel",
    "Receita por canal",
    "bar",
    "finance",
    "revenue",
    "sum",
    "channel",
    "R$",
  ),
  definition(
    "revenue-daily",
    "Receita por dia",
    "line",
    "finance",
    "revenue",
    "sum",
    "date",
    "R$",
  ),
];
