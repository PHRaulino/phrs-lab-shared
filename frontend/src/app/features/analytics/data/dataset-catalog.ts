import { DatasetDefinition } from "../models/analytics.models";
export const DATASETS: DatasetDefinition[] = [
  {
    id: "operations",
    version: 1,
    url: "assets/analytics/datasets/operations.json",
    tables: [
      {
        name: "executions",
        primaryKey: "execution_id",
        fields: [
          { name: "execution_id", type: "string" },
          { name: "execution_date", type: "date", filterable: true },
          { name: "business_unit", type: "string", filterable: true },
          { name: "unit_id", type: "string" },
          { name: "status", type: "string", filterable: true },
          { name: "layer", type: "string", filterable: true },
          { name: "duration_minutes", type: "number" },
          { name: "rows_processed", type: "number" },
        ],
      },
      {
        name: "units",
        primaryKey: "id",
        fields: [
          { name: "id", type: "string" },
          { name: "name", type: "string" },
        ],
      },
    ],
    relationships: [
      {
        fromTable: "executions",
        fromField: "unit_id",
        toTable: "units",
        toField: "id",
      },
    ],
    dimensions: ["execution_date", "business_unit", "status", "layer"],
    metrics: ["rows_processed", "duration_minutes"],
  },
  {
    id: "finance",
    version: 1,
    url: "assets/analytics/datasets/finance.json",
    tables: [
      {
        name: "results",
        primaryKey: "id",
        fields: [
          { name: "id", type: "string" },
          { name: "date", type: "date", filterable: true },
          { name: "business_unit", type: "string", filterable: true },
          { name: "revenue", type: "number" },
          { name: "cost", type: "number" },
          { name: "channel", type: "string", filterable: true },
        ],
      },
    ],
    relationships: [],
    dimensions: ["date", "business_unit", "channel"],
    metrics: ["revenue", "cost"],
  },
];
