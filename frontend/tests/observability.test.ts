import assert from "node:assert/strict";
import { test } from "node:test";
import { observationFixture } from "../src/mocks/fixtures/observability";
import {
  EMPTY_FILTERS,
  elapsed,
  filterTasks,
  summary,
  waveSummaries,
} from "../src/app/features/observability/state/observability.utils";
import {
  layoutGraph,
  NODE_HEIGHT,
  NODE_WIDTH,
} from "../src/app/features/observability/graph/graph-layout";

const snapshot = observationFixture();
test("os filtros combinam unidade, camada, workflow, status e tabela sem alterar a fonte", () => {
  const result = filterTasks(snapshot.tasks, {
    ...EMPTY_FILTERS,
    businessUnit: "Comercial",
    layer: "SOT",
    workflowId: "commerce",
    status: "error",
    search: "PEDIDOS",
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].name, "pedidos_validados");
  assert.equal(snapshot.tasks.length, 24);
  const metrics = summary(result);
  assert.equal(metrics.total, 1);
  assert.equal(metrics.error, 1);
  assert.equal(metrics.waves, 1);
  assert.equal(waveSummaries(snapshot, result).length, 1);
});
test("resumo contabiliza espera como pendente e separa canceladas e ignoradas", () => {
  const metrics = summary(snapshot.tasks);
  assert.equal(
    metrics.total,
    metrics.completed +
      metrics.running +
      metrics.pending +
      metrics.error +
      metrics.other,
  );
  assert.equal(metrics.other, 2);
  assert.equal(metrics.waves, 10);
  assert.equal(summary([]).total, 0);
});
test("duração usa intervalo de execução e não soma tarefas paralelas", () => {
  const completed = snapshot.tasks.filter((t) => t.wave === 1);
  assert.equal(elapsed(completed, snapshot.observedAt), 90000);
  assert.equal(elapsed(snapshot.tasks, snapshot.observedAt), 360000);
  assert.equal(elapsed([], snapshot.observedAt), undefined);
});
test("grafo grande preserva relações e ondas fornecidas sem sobreposição", () => {
  const source = observationFixture(true);
  const graph = layoutGraph(source.tasks);
  assert.equal(graph.nodes.length, 240);
  assert.equal(graph.hiddenEdges, 0);
  assert.equal(
    graph.edges.length,
    source.tasks.reduce((sum, t) => sum + t.dependencies.length, 0),
  );
  for (const node of graph.nodes) {
    assert.equal(
      graph.columns.find((c) => c.wave === node.task.wave)!.x + 16,
      node.x,
    );
    for (const other of graph.nodes) {
      if (node.task.id === other.task.id) continue;
      assert.ok(
        Math.abs(node.x - other.x) >= NODE_WIDTH ||
          Math.abs(node.y - other.y) >= NODE_HEIGHT,
      );
    }
  }
  for (const edge of graph.edges) {
    assert.ok(
      source.tasks
        .find((t) => t.id === edge.to)!
        .dependencies.includes(edge.from),
    );
  }
});
test("grafo filtrado informa dependências externas e não inventa conexões", () => {
  const tasks = filterTasks(snapshot.tasks, {
    ...EMPTY_FILTERS,
    layer: "SPEC",
  });
  const graph = layoutGraph(tasks);
  assert.equal(graph.edges.length, 4);
  assert.equal(graph.hiddenEdges, 6);
});
test("evolução do mock é monotônica e mantém dependências e ondas", () => {
  const later = observationFixture(false, 2);
  const first = snapshot.tasks.find((t) => t.name === "estoque")!;
  const last = later.tasks.find((t) => t.id === first.id)!;
  assert.equal(first.status, "running");
  assert.equal(last.status, "completed");
  assert.deepEqual(last.dependencies, first.dependencies);
  assert.equal(last.wave, first.wave);
  assert.deepEqual(
    observationFixture(false, 3).tasks.map((t) => t.status),
    later.tasks.map((t) => t.status),
  );
});

test("as camadas da demonstração são somente SOR, SOT e SPEC", () => {
  for (const large of [false, true]) {
    assert.deepEqual(
      [
        ...new Set(observationFixture(large).tasks.map((task) => task.layer)),
      ].sort(),
      ["SOR", "SOT", "SPEC"],
    );
  }
});
