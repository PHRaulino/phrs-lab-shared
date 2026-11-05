import { Dashboard, VisualDefinition } from "../models/analytics.models";
import { overlaps } from "../state/grid-layout";
export function validateDashboard(
  input: unknown,
  registry: VisualDefinition[],
  allowedIds: Set<string>,
  ownerId?: string,
): Dashboard {
  if (!input || typeof input !== "object")
    throw new Error("Definição de dashboard inválida.");
  const d = input as Dashboard;
  const text = (v: unknown, max = 200) =>
    typeof v === "string" && v.trim().length > 0 && v.length <= max;
  if (
    d.schemaVersion !== 1 ||
    !text(d.id) ||
    !text(d.name) ||
    typeof d.description !== "string" ||
    d.description.length > 2000 ||
    !Array.isArray(d.tags) ||
    d.tags.some((t) => !text(t, 50)) ||
    !["official", "personal"].includes(d.visibility) ||
    typeof d.published !== "boolean" ||
    typeof d.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(d.updatedAt))
  )
    throw new Error("Metadados ou versão da dashboard inválidos.");
  if (d.visibility === "personal" && d.ownerId !== ownerId)
    throw new Error("Esta dashboard pertence a outra identidade.");
  if (!Array.isArray(d.sections) || d.sections.length > 30)
    throw new Error("Seções inválidas ou limite de 30 seções excedido.");
  const ids = new Set<string>();
  let total = 0;
  for (const section of d.sections) {
    if (
      !text(section.id) ||
      ids.has(section.id) ||
      !text(section.title) ||
      !Number.isInteger(section.order) ||
      section.order < 0 ||
      section.layout?.columns !== 12 ||
      section.layout.gap !== 12 ||
      !Array.isArray(section.modules) ||
      (section.collapsed !== undefined &&
        typeof section.collapsed !== "boolean")
    )
      throw new Error("Seção ou layout inválido.");
    ids.add(section.id);
    for (const module of section.modules) {
      total++;
      const visual = registry.find((v) => v.id === module.visualId);
      const layout = module.layout;
      if (
        !visual ||
        !allowedIds.has(module.visualId) ||
        visual.private ||
        !text(module.id) ||
        ids.has(module.id)
      )
        throw new Error(
          "Visual não publicado, privado, desconhecido ou identificador duplicado.",
        );
      ids.add(module.id);
      if (
        !module.configuration ||
        typeof module.configuration !== "object" ||
        Array.isArray(module.configuration) ||
        Object.keys(module.configuration).length > 30 ||
        Object.values(module.configuration).some(
          (v) => !["string", "number", "boolean"].includes(typeof v),
        )
      )
        throw new Error("Configuração de módulo inválida.");
      if (
        !layout ||
        ![layout.x, layout.y, layout.w, layout.h].every(Number.isInteger) ||
        layout.x < 0 ||
        layout.y < 0 ||
        layout.y > 10000 ||
        layout.w < visual.layout.minW ||
        layout.h < visual.layout.minH ||
        layout.w > 12 ||
        layout.h > 12 ||
        layout.x + layout.w > 12
      )
        throw new Error("Posição ou dimensão de módulo inválida.");
    }
    for (let i = 0; i < section.modules.length; i++)
      for (let j = i + 1; j < section.modules.length; j++)
        if (overlaps(section.modules[i].layout, section.modules[j].layout))
          throw new Error("A definição contém módulos sobrepostos.");
  }
  if (total > 100)
    throw new Error("Limite de 100 módulos por dashboard excedido.");
  return structuredClone(d);
}
export function publishedVisualIds(
  dashboards: Dashboard[],
  registry: VisualDefinition[],
): Set<string> {
  return new Set(
    dashboards
      .filter((d) => d.visibility === "official" && d.published)
      .flatMap((d) =>
        d.sections.flatMap((s) => s.modules.map((m) => m.visualId)),
      )
      .filter((id) => registry.some((v) => v.id === id && !v.private)),
  );
}
