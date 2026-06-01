// HMAC-signed kill tokens (PartyKit/Worker side).
// Mirrors src/lib/pvpToken.ts but uses Web Crypto since PartyKit runs on
// Cloudflare Workers and has no node:crypto. The signing secret must
// match FORCE_PUSH_HMAC_SECRET on the Next.js side.

export interface KillTokenPayload {
  kln: string;
  vln: string;
  hh: boolean;
  exp: number;
  nonce: string;
}

const TOKEN_VERSION = "v1";

function base64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmacSha256(secret: string, data: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return new Uint8Array(sigBuf);
}

export async function signKillToken(payload: KillTokenPayload, secret: string): Promise<string> {
  if (!secret || secret.length < 32) {
    throw new Error("FORCE_PUSH_HMAC_SECRET missing or too short on PartyKit");
  }
  const json = JSON.stringify(payload);
  const payloadB64 = base64urlEncode(new TextEncoder().encode(json));
  const sig = await hmacSha256(secret, `${TOKEN_VERSION}.${payloadB64}`);
  const sigB64 = base64urlEncode(sig);
  return `${TOKEN_VERSION}.${payloadB64}.${sigB64}`;
}

export function randomNonce(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return base64urlEncode(arr);
}
