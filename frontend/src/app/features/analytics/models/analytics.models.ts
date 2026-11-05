import { Type } from "@angular/core";
export type ValueType = "string" | "number" | "boolean" | "date";
export type Row = Record<string, string | number | boolean | null>;
export interface Field {
  name: string;
  type: ValueType;
  filterable?: boolean;
}
export interface DatasetDefinition {
  id: string;
  version: number;
  url: string;
  tables: { name: string; primaryKey: string; fields: Field[] }[];
  relationships: {
    fromTable: string;
    fromField: string;
    toTable: string;
    toField: string;
  }[];
  dimensions: string[];
  metrics: string[];
}
export interface DatasetData {
  tables: Record<string, Row[]>;
}
export type FilterOperator = "eq" | "in" | "gte" | "lte";
export interface FilterDefinition {
  semanticId: string;
  label: string;
  type: ValueType;
  operators: FilterOperator[];
  options?: string[];
  defaultValue?: string;
  mapping: { datasetId: string; table: string; field: string };
}
export interface FilterValue {
  value: string;
  operator: FilterOperator;
}
export interface BoundFilter {
  id: string;
  definition: FilterDefinition;
  moduleIds: string[];
  bindings: Record<string, FilterDefinition>;
}
export interface GridPosition {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface ModuleInstance {
  id: string;
  visualId: string;
  configuration: Record<string, string | number | boolean | undefined>;
  layout: GridPosition;
}
export interface DashboardSection {
  id: string;
  title: string;
  order: number;
  collapsed?: boolean;
  layout: { columns: 12; gap: number };
  modules: ModuleInstance[];
}
export interface Dashboard {
  schemaVersion: 1;
  id: string;
  name: string;
  description: string;
  tags: string[];
  visibility: "official" | "personal";
  ownerId?: string;
  published: boolean;
  sections: DashboardSection[];
  updatedAt: string;
}
export interface VisualView {
  title: string;
  kind: "kpi" | "bar" | "line" | "donut" | "table";
  value?: number;
  unit?: string;
  labels: string[];
  values: number[];
  rows: Row[];
  fields: string[];
  note: string;
}
export interface VisualComponent {
  view: VisualView;
}
export interface VisualDefinition {
  id: string;
  version: number;
  name: string;
  description: string;
  category: string;
  tags: string[];
  component: Type<VisualComponent>;
  datasets: string[];
  filters: FilterDefinition[];
  layout: { minW: number; minH: number; defaultW: number; defaultH: number };
  private?: boolean;
  query: {
    datasetId: string;
    table: string;
    kind: VisualView["kind"];
    metric: string;
    aggregate: "sum" | "count" | "avg";
    groupBy?: string;
    unit?: string;
    join?: {
      table: string;
      localKey: string;
      foreignKey: string;
      prefix: string;
    };
  };
}
export interface AnalyticsRecord {
  schemaVersion: 1;
  ownerId: string;
  dashboards: Dashboard[];
  filters: Record<string, Record<string, FilterValue>>;
  officialDrafts: Dashboard[];
}
