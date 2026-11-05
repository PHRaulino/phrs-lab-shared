import { stringify } from "yaml";

/** Exporta os parâmetros disponíveis, sem adicionar metadados de execução. */
export function generateTaskYaml(
  configuration: Record<string, unknown>,
): string {
  return stringify(configuration, { indent: 2, lineWidth: 0 });
}
