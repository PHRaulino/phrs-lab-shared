export type FieldKind =
  | "text"
  | "number"
  | "boolean"
  | "array"
  | "object"
  | "null";
export interface ConfigurationField {
  key: string;
  kind: FieldKind;
  value: string;
}
export function configurationFields(
  configuration: Record<string, unknown>,
): ConfigurationField[] {
  return Object.entries(configuration).map(([key, value]) => {
    const kind: FieldKind =
      value === null
        ? "null"
        : Array.isArray(value)
          ? "array"
          : typeof value === "object"
            ? "object"
            : typeof value === "boolean"
              ? "boolean"
              : typeof value === "number"
                ? "number"
                : "text";
    return {
      key,
      kind,
      value:
        typeof value === "string"
          ? value
          : (JSON.stringify(value, null, 2) ?? ""),
    };
  });
}
/** Preserve the types of existing configuration fields; no invented required parameters. */
export function parseConfiguration(fields: ConfigurationField[]) {
  const errors: Record<string, string> = {};
  const entries: [string, unknown][] = [];
  for (const field of fields) {
    let value: unknown = field.value;
    if (field.kind !== "text") {
      try {
        value = JSON.parse(field.value);
        const valid =
          field.kind === "number"
            ? typeof value === "number" && Number.isFinite(value)
            : field.kind === "boolean"
              ? typeof value === "boolean"
              : field.kind === "array"
                ? Array.isArray(value)
                : field.kind === "null"
                  ? value === null
                  : value !== null &&
                    typeof value === "object" &&
                    !Array.isArray(value);
        if (!valid) throw new Error();
      } catch {
        errors[field.key] =
          field.kind === "array"
            ? 'Informe uma lista JSON válida, por exemplo ["data_referencia"].'
            : field.kind === "object"
              ? 'Informe um objeto JSON válido, por exemplo {"chave": "valor"}.'
              : field.kind === "number"
                ? "Informe um número válido."
                : field.kind === "boolean"
                  ? "Selecione verdadeiro ou falso."
                  : "Este campo deve conter null.";
      }
    }
    entries.push([field.key, value]);
  }
  return {
    configuration: Object.fromEntries(entries),
    errors,
    valid: Object.keys(errors).length === 0,
  };
}
