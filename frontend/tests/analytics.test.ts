import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  consolidateFilters,
  applyFilters,
  resolveFilterValues,
} from "../src/app/features/analytics/state/filter-engine";
import {
  arrangeGrid,
  overlaps,
} from "../src/app/features/analytics/state/grid-layout";
import {
  validateDashboard,
  publishedVisualIds,
} from "../src/app/features/analytics/data/dashboard-validation";
import {
  validateDataset,
  joinRows,
  aggregate,
} from "../src/app/features/analytics/data/query-engine";
import { DATASETS } from "../src/app/features/analytics/data/dataset-catalog";
import type {
  Dashboard,
  FilterDefinition,
  ModuleInstance,
  VisualDefinition,
  VisualView,
  GridPosition,
} from "../src/app/features/analytics/models/analytics.models";
const component = class {
  view!: VisualView;
};
const filter: FilterDefinition = {
  semanticId: "unit",
  label: "Unidade",
  type: "string",
  operators: ["eq"],
  options: ["Comercial"],
  mapping: {
    datasetId: "operations",
    table: "executions",
    field: "business_unit",
  },
};
const visual = (
  id: string,
  filters: FilterDefinition[] = [],
): VisualDefinition => ({
  id,
  version: 1,
  name: id,
  description: id,
  category: "Teste",
  tags: [],
  component,
  datasets: ["operations"],
  filters,
  layout: { minW: 3, minH: 2, defaultW: 6, defaultH: 3 },
  query: {
    datasetId: "operations",
    table: "executions",
    kind: "kpi",
    metric: "execution_id",
    aggregate: "count",
  },
});
const module = (
  id: string,
  visualId = id,
  x = 0,
  y = 0,
  w = 6,
  h = 3,
): ModuleInstance => ({
  id,
  visualId,
  configuration: { title: id },
  layout: { x, y, w, h },
});
const official = JSON.parse(
  readFileSync("src/assets/analytics/official-dashboards.json", "utf8"),
) as Dashboard[];
const registry = [
  ...new Set(
    official.flatMap((d) =>
      d.sections.flatMap((s) => s.modules.map((m) => m.visualId)),
    ),
  ),
].map((id) => visual(id));
const allowed = publishedVisualIds(official, registry);

test("filtros equivalentes consolidam opções e mapeamentos entre datasets", () => {
  const other = {
    ...filter,
    options: ["Financeiro"],
    mapping: { datasetId: "finance", table: "results", field: "business_unit" },
  };
  const result = consolidateFilters(
    [module("a"), module("b")],
    [visual("a", [filter]), visual("b", [other])],
  );
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].moduleIds, ["a", "b"]);
  assert.deepEqual(result[0].definition.options, ["Comercial", "Financeiro"]);
  assert.equal(result[0].bindings["b"].mapping.datasetId, "finance");
});
test("mesmo nome não consolida critérios semânticos, tipos ou operadores incompatíveis", () => {
  const definitions = [
    filter,
    { ...filter, semanticId: "other" },
    { ...filter, type: "number" as const },
    { ...filter, operators: ["in" as const] },
  ];
  const result = consolidateFilters(
    definitions.map((_, i) => module(String(i))),
    definitions.map((f, i) => visual(String(i), [f])),
  );
  assert.equal(result.length, 4);
});
test("cada filtro alcança apenas os módulos que o declaram", () => {
  const modules = [module("a"), module("b")];
  const filters = consolidateFilters(modules, [
    visual("a", [filter]),
    visual("b", []),
  ]);
  const rows = [
    { business_unit: "Comercial", value: 1 },
    { business_unit: "Financeiro", value: 2 },
  ];
  const values = {
    [filters[0].id]: { value: "Comercial", operator: "eq" as const },
  };
  assert.deepEqual(applyFilters(rows, "a", filters, values), [rows[0]]);
  assert.deepEqual(applyFilters(rows, "b", filters, values), rows);
  assert.deepEqual(applyFilters(rows, "a", filters, {}), rows);
});
test("mover ou redimensionar reorganiza o grid sem sobreposição e sem mutar a origem", () => {
  const source = [
    module("a", "a", 0, 0),
    module("b", "b", 6, 0),
    module("c", "c", 0, 3, 12, 3),
  ];
  const result = arrangeGrid(source, "a", { x: 8, y: 0, w: 12, h: 4 });
  assert.equal(result[0].layout.x, 0);
  assert.equal(result[0].layout.w, 12);
  assert.deepEqual(source[0].layout, { x: 0, y: 0, w: 6, h: 3 });
  for (let i = 0; i < result.length; i++)
    for (let j = i + 1; j < result.length; j++)
      assert.equal(overlaps(result[i].layout, result[j].layout), false);
});
test("definições oficiais estáticas têm layout válido e referências registradas", () => {
  for (const definition of official)
    assert.deepEqual(
      validateDashboard(definition, registry, allowed),
      definition,
    );
});
test("importação rejeita visuais não publicados, privados, IDs duplicados e outra identidade", () => {
  const personal = {
    ...structuredClone(official[0]),
    visibility: "personal" as const,
    ownerId: "user-a",
    published: false,
  };
  assert.throws(
    () => validateDashboard(personal, registry, allowed, "user-b"),
    /identidade/,
  );
  const unknown = structuredClone(personal);
  unknown.sections[0].modules[0].visualId = "private-component";
  assert.throws(
    () => validateDashboard(unknown, registry, allowed, "user-a"),
    /Visual/,
  );
  const privateRegistry = registry.map((v) =>
    v.id === personal.sections[0].modules[0].visualId
      ? { ...v, private: true }
      : v,
  );
  assert.throws(
    () => validateDashboard(personal, privateRegistry, allowed, "user-a"),
    /Visual/,
  );
  const duplicate = structuredClone(personal);
  duplicate.sections[1].modules[0].id = duplicate.sections[0].modules[0].id;
  assert.throws(
    () => validateDashboard(duplicate, registry, allowed, "user-a"),
    /duplicado/,
  );
});
test("importação rejeita versão desconhecida, layout incompleto e sobreposição", () => {
  assert.throws(
    () =>
      validateDashboard(
        { ...official[0], schemaVersion: 99 },
        registry,
        allowed,
      ),
    /versão/,
  );
  const missing = structuredClone(official[0]);
  delete (missing.sections[0].modules[0].layout as Partial<GridPosition>).w;
  assert.throws(
    () => validateDashboard(missing, registry, allowed),
    /dimensão/,
  );
  const collision = structuredClone(official[0]);
  collision.sections[0].modules[1].layout = {
    ...collision.sections[0].modules[0].layout,
  };
  assert.throws(
    () => validateDashboard(collision, registry, allowed),
    /sobrepostos/,
  );
});
test("datasets locais são validados, agregados e relacionados conforme o schema", () => {
  const schema = DATASETS[0];
  const data = validateDataset(
    JSON.parse(
      readFileSync(schema.url.replace("assets/", "src/assets/"), "utf8"),
    ),
    schema,
  );
  const definition = visual("table");
  definition.query = {
    ...definition.query,
    kind: "table",
    join: {
      table: "units",
      localKey: "unit_id",
      foreignKey: "id",
      prefix: "unit",
    },
  };
  const joined = joinRows(data, schema, definition);
  assert.equal(joined.length, 72);
  assert.equal(joined[0]["unit.name"], joined[0]["business_unit"]);
  assert.equal(aggregate(joined, definition, "Teste").value, 72);
  const undeclared = {
    ...definition,
    query: {
      ...definition.query,
      join: {
        table: "units",
        localKey: "execution_id",
        foreignKey: "id",
        prefix: "unit",
      },
    },
  };
  assert.throws(() => joinRows(data, schema, undeclared), /Relacionamento/);
  const bad = structuredClone(data);
  bad.tables["executions"][0]["duration_minutes"] = "inválido";
  assert.throws(() => validateDataset(bad, schema), /Campo/);
});

test("valores padrão são aplicados e podem ser explicitamente limpos", () => {
  const filters = consolidateFilters(
    [module("a")],
    [visual("a", [{ ...filter, defaultValue: "Comercial" }])],
  );
  const id = filters[0].id;
  assert.equal(resolveFilterValues(filters, {})[id].value, "Comercial");
  assert.equal(
    resolveFilterValues(filters, { [id]: { value: "", operator: "eq" } })[id]
      .value,
    "",
  );
});
