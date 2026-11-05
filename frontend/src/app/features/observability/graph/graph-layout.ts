import { Task } from "../models/observability.models";
export const NODE_WIDTH = 204;
export const NODE_HEIGHT = 76;
export interface GraphNode {
  task: Task;
  x: number;
  y: number;
}
export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  path: string;
}
/** Placement only: wave membership and dependencies are supplied by the data source. */
export function layoutGraph(tasks: Task[]) {
  const waves = [...new Set(tasks.map((t) => t.wave))].sort((a, b) => a - b);
  const rows = new Map<number, Task[]>(
    waves.map((w) => [
      w,
      tasks
        .filter((t) => t.wave === w)
        .sort(
          (a, b) =>
            a.workflowId.localeCompare(b.workflowId) ||
            a.name.localeCompare(b.name),
        ),
    ]),
  );
  const rank = new Map<string, number>();
  for (const wave of waves) {
    const members = rows.get(wave)!;
    const score = (t: Task) => {
      const positions = t.dependencies.flatMap((id) =>
        rank.has(id) ? [rank.get(id)!] : [],
      );
      return positions.length
        ? positions.reduce((a, b) => a + b, 0) / positions.length
        : members.indexOf(t);
    };
    const scores = new Map(members.map((t) => [t.id, score(t)]));
    members.sort(
      (a, b) =>
        a.workflowId.localeCompare(b.workflowId) ||
        scores.get(a.id)! - scores.get(b.id)!,
    );
    members.forEach((t, index) => rank.set(t.id, index));
  }
  const maxRows = Math.max(1, ...[...rows.values()].map((r) => r.length));
  const height = maxRows * 106 + 100;
  const columns = waves.map((wave, index) => ({
    wave,
    x: 32 + index * 266,
    width: 236,
  }));
  const nodes = columns.flatMap((col) =>
    (rows.get(col.wave) ?? []).map((task, index) => ({
      task,
      x: col.x + 16,
      y: 78 + index * 106,
    })),
  );
  const byId = new Map(nodes.map((node) => [node.task.id, node]));
  let hiddenEdges = 0;
  const edges: GraphEdge[] = [];
  for (const node of nodes)
    for (const dependency of node.task.dependencies) {
      const source = byId.get(dependency);
      if (!source) {
        hiddenEdges++;
        continue;
      }
      const x1 = source.x + NODE_WIDTH,
        y1 = source.y + NODE_HEIGHT / 2,
        x2 = node.x,
        y2 = node.y + NODE_HEIGHT / 2;
      const bend = Math.max(28, Math.abs(x2 - x1) * 0.5);
      edges.push({
        id: `${dependency}>${node.task.id}`,
        from: dependency,
        to: node.task.id,
        path: `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`,
      });
    }
  return {
    nodes,
    edges,
    columns,
    width: Math.max(340, waves.length * 266 + 48),
    height,
    hiddenEdges,
  };
}
