/** Token-count parameters (max_tokens, max_output_tokens) are not authentication credentials. */
export function isCredentialParameter(key: string): boolean {
  const normalized = key.replace(/[^a-z]/gi, "").toLowerCase();
  return (
    [
      "apikey",
      "accesstoken",
      "authtoken",
      "token",
      "secret",
      "clientsecret",
      "password",
      "credential",
      "credentials",
      "privatekey",
      "authorization",
    ].includes(normalized) ||
    normalized.endsWith("apikey") ||
    normalized.endsWith("privatekey")
  );
}
