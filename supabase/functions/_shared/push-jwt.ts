import { SignJWT, importPKCS8 } from "https://esm.sh/jose@5.9.6";

export async function signEs256Jwt(input: {
  privateKeyPem: string;
  keyId: string;
  issuer: string;
}): Promise<string> {
  const key = await importPKCS8(normalizePem(input.privateKeyPem, "EC"), "ES256");
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: input.keyId })
    .setIssuer(input.issuer)
    .setIssuedAt()
    .setExpirationTime("50m")
    .sign(key);
}

export async function googleAccessToken(input: {
  clientEmail: string;
  privateKeyPem: string;
  scope: string;
}): Promise<string> {
  const key = await importPKCS8(normalizePem(input.privateKeyPem, "RSA"), "RS256");
  const jwt = await new SignJWT({
    scope: input.scope,
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(input.clientEmail)
    .setSubject(input.clientEmail)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(key);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const json = (await response.json()) as { access_token?: string; error?: string };
  if (!response.ok || !json.access_token) {
    throw new Error(json.error ?? `google_oauth_${response.status}`);
  }
  return json.access_token;
}

function normalizePem(raw: string, kind: "EC" | "RSA"): string {
  const trimmed = raw.replace(/\\n/g, "\n").trim();
  if (trimmed.includes("BEGIN")) {
    return trimmed;
  }
  const header =
    kind === "EC"
      ? "-----BEGIN PRIVATE KEY-----"
      : "-----BEGIN PRIVATE KEY-----";
  const footer = "-----END PRIVATE KEY-----";
  const body = trimmed.replace(/\s+/g, "");
  const chunks = body.match(/.{1,64}/g) ?? [body];
  return `${header}\n${chunks.join("\n")}\n${footer}`;
}
