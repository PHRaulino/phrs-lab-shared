import assert from "node:assert/strict";
import { test } from "node:test";
import {
  configurationFields,
  parseConfiguration,
} from "../src/app/features/observability/models/task-configuration-form";

test("formulário preserva os tipos e não altera a configuração de origem", () => {
  const original = {
    processing_type: "incremental",
    retries: 3,
    enabled: false,
    partition_by: ["dia"],
    merge: { keys: ["id"] },
    optional: null,
    delete_sql: "DELETE FROM tabela WHERE id = :id",
  };
  const fields = configurationFields(original);
  assert.deepEqual(parseConfiguration(fields).configuration, original);
  assert.equal(parseConfiguration(fields).valid, true);
  fields.find((f) => f.key === "processing_type")!.value = "full";
  assert.equal(original.processing_type, "incremental");
  assert.equal(
    parseConfiguration(fields).configuration["processing_type"],
    "full",
  );
});
test("JSON inválido e conversões de tipos impedem o salvamento", () => {
  const fields = configurationFields({
    merge: { keys: ["id"] },
    partition_by: ["data"],
    retries: 2,
    enabled: true,
  });
  fields[0].value = '{"keys":';
  fields[1].value = "{}";
  fields[2].value = '"dois"';
  fields[3].value = "1";
  const result = parseConfiguration(fields);
  assert.equal(result.valid, false);
  assert.deepEqual(Object.keys(result.errors), [
    "merge",
    "partition_by",
    "retries",
    "enabled",
  ]);
});
test("texto vazio não cria uma restrição obrigatória inexistente", () => {
  const fields = configurationFields({ filter_period: "daily" });
  fields[0].value = "";
  assert.equal(parseConfiguration(fields).valid, true);
  assert.deepEqual(parseConfiguration(fields).configuration, {
    filter_period: "",
  });
});

test("YAML gerado preserva SQL, listas, booleanos, nulos e textos especiais", async () => {
  const { generateTaskYaml } = await import(
    "../src/app/features/observability/data/task-yaml-export"
  );
  const { parse } = await import("yaml");
  const configuration = {
    processing_type: "incremental",
    partition_by: ["data_referencia"],
    enabled: false,
    retries: 2,
    optional: null,
    description: "valor: especial # texto",
    source: { format: "parquet" },
    delete_sql:
      "DELETE FROM SOT.pedidos\nWHERE data_referencia = :data_referencia\nAND descricao = 'A: B # C'",
  };
  const content = generateTaskYaml(configuration);
  assert.deepEqual(parse(content), configuration);
  assert.ok(content.endsWith("\n"));
  assert.equal("configuration" in parse(content), false);
});
