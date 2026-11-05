import { GridPosition, ModuleInstance } from "../models/analytics.models";
export function overlaps(a: GridPosition, b: GridPosition): boolean {
  return (
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
  );
}
export function arrangeGrid(
  modules: ModuleInstance[],
  movedId?: string,
  position?: GridPosition,
): ModuleInstance[] {
  const ordered = [...modules].sort((a, b) =>
    a.id === movedId
      ? -1
      : b.id === movedId
        ? 1
        : a.layout.y - b.layout.y || a.layout.x - b.layout.x,
  );
  const placed: ModuleInstance[] = [];
  for (const module of ordered) {
    const raw = module.id === movedId && position ? position : module.layout;
    const w = Math.max(1, Math.min(12, Math.round(raw.w))),
      h = Math.max(1, Math.min(12, Math.round(raw.h)));
    const layout = {
      x: Math.max(0, Math.min(12 - w, Math.round(raw.x))),
      y: Math.max(0, Math.round(raw.y)),
      w,
      h,
    };
    while (placed.some((p) => overlaps(p.layout, layout))) layout.y++;
    placed.push({ ...module, layout });
  }
  return modules.map((m) => placed.find((p) => p.id === m.id)!);
}
