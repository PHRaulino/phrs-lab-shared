import {
  BoundFilter,
  FilterDefinition,
  FilterValue,
  ModuleInstance,
  Row,
  VisualDefinition,
} from "../models/analytics.models";
/** Merge by semantic ID, type and the complete operator contract, never by display name. */
export function consolidateFilters(
  modules: ModuleInstance[],
  registry: VisualDefinition[],
): BoundFilter[] {
  const filters = new Map<string, BoundFilter>();
  for (const module of modules)
    for (const definition of registry.find((v) => v.id === module.visualId)
      ?.filters ?? []) {
      const id = [
        definition.semanticId,
        definition.type,
        [...definition.operators].sort().join(","),
      ].join(":");
      let bound = filters.get(id);
      if (!bound) {
        bound = {
          id,
          definition: {
            ...definition,
            options: [...(definition.options ?? [])],
          },
          moduleIds: [],
          bindings: {},
        };
        filters.set(id, bound);
      }
      if (!bound.moduleIds.includes(module.id)) bound.moduleIds.push(module.id);
      bound.bindings[module.id] = definition;
      bound.definition.options = [
        ...new Set([
          ...(bound.definition.options ?? []),
          ...(definition.options ?? []),
        ]),
      ].sort();
    }
  return [...filters.values()];
}
export function applyFilters(
  rows: Row[],
  moduleId: string,
  filters: BoundFilter[],
  values: Record<string, FilterValue>,
): Row[] {
  return rows.filter((row) =>
    filters.every((filter) => {
      const binding = filter.bindings[moduleId],
        value = values[filter.id];
      if (!binding || !value || value.value === "") return true;
      if (!binding.operators.includes(value.operator)) return false;
      const field = row[binding.mapping.field];
      if (field === null || field === undefined) return false;
      const raw = binding.type === "number" ? Number(field) : String(field);
      const target =
        binding.type === "number" ? Number(value.value) : value.value;
      if (value.operator === "gte") return raw >= target;
      if (value.operator === "lte") return raw <= target;
      if (value.operator === "in")
        return value.value.split("|").includes(String(field));
      return String(field) === value.value;
    }),
  );
}
export function moduleFilters(
  moduleId: string,
  filters: BoundFilter[],
  values: Record<string, FilterValue>,
): Record<string, FilterValue> {
  return Object.fromEntries(
    filters
      .filter((f) => f.moduleIds.includes(moduleId) && values[f.id]?.value)
      .map((f) => [f.id, values[f.id]]),
  );
}

export function resolveFilterValues(
  filters: BoundFilter[],
  saved: Record<string, FilterValue>,
): Record<string, FilterValue> {
  const defaults = Object.fromEntries(
    filters
      .filter((f) => f.definition.defaultValue !== undefined)
      .map((f) => [
        f.id,
        {
          value: f.definition.defaultValue!,
          operator: f.definition.operators[0],
        },
      ]),
  );
  return { ...defaults, ...saved };
}
