import {
  DatasetData,
  DatasetDefinition,
  Row,
  VisualDefinition,
  VisualView,
} from "../models/analytics.models";
export function validateDataset(
  value: unknown,
  schema: DatasetDefinition,
): DatasetData {
  if (!value || typeof value !== "object" || !("tables" in value))
    throw new Error("Dataset inválido.");
  const data = value as DatasetData;
  for (const table of schema.tables) {
    const rows = data.tables?.[table.name];
    if (!Array.isArray(rows))
      throw new Error(`Tabela ${table.name} não fornecida.`);
    const keys = new Set<unknown>();
    for (const row of rows) {
      if (!row || typeof row !== "object") throw new Error("Linha inválida.");
      if (keys.has(row[table.primaryKey]))
        throw new Error(`Chave duplicada em ${table.name}.`);
      keys.add(row[table.primaryKey]);
      for (const field of table.fields) {
        const v = row[field.name];
        if (v === null) continue;
        if (
          field.type === "date"
            ? typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)
            : typeof v !== field.type
        )
          throw new Error(`Campo inválido: ${field.name}.`);
      }
    }
  }
  return data;
}
export function joinRows(
  data: DatasetData,
  schema: DatasetDefinition,
  visual: VisualDefinition,
): Row[] {
  const query = visual.query;
  const rows = data.tables[query.table] ?? [];
  if (!query.join) return rows;
  const join = query.join;
  if (
    !schema.relationships.some(
      (r) =>
        r.fromTable === query.table &&
        r.fromField === join.localKey &&
        r.toTable === join.table &&
        r.toField === join.foreignKey,
    )
  )
    throw new Error("Relacionamento não declarado no schema.");
  const index = new Map(
    (data.tables[join.table] ?? []).map((row) => [row[join.foreignKey], row]),
  );
  return rows.map((row) => ({
    ...row,
    ...Object.fromEntries(
      Object.entries(index.get(row[join.localKey]) ?? {}).map(
        ([key, value]) => [`${join.prefix}.${key}`, value],
      ),
    ),
  }));
}
export function aggregate(
  rows: Row[],
  visual: VisualDefinition,
  title: string,
): VisualView {
  const q = visual.query;
  const metric = (items: Row[]) =>
    q.aggregate === "count"
      ? items.length
      : items.reduce(
          (sum, row) =>
            sum +
            (typeof row[q.metric] === "number" ? Number(row[q.metric]) : 0),
          0,
        ) / (q.aggregate === "avg" ? Math.max(1, items.length) : 1);
  const groups = new Map<string, Row[]>();
  if (q.groupBy)
    for (const row of rows) {
      const key = String(row[q.groupBy] ?? "Não informado");
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
  const keys = [...groups.keys()].sort();
  return {
    title,
    kind: q.kind,
    value: metric(rows),
    unit: q.unit,
    labels: keys,
    values: keys.map((key) => metric(groups.get(key)!)),
    rows: [...rows]
      .sort((a, b) =>
        String(b["execution_date"] ?? b["date"] ?? "").localeCompare(
          String(a["execution_date"] ?? a["date"] ?? ""),
        ),
      )
      .slice(0, 30),
    fields:
      q.kind === "table"
        ? ["execution_id", "execution_date", "unit.name", "status", "layer"]
        : [],
    note: `${rows.length} registros · dados demonstrativos locais`,
  };
}
