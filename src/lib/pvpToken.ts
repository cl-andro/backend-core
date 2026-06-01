// ─── HMAC-signed kill tokens ────────────────────────────────
// Tokens are minted by the PartyKit fly server when a kill is confirmed
// server-side, then carried by the killer's client to the credit-kill API.
// The API verifies the signature with the shared FORCE_PUSH_HMAC_SECRET
// before crediting XP. This prevents forged credit requests where a
// malicious client posts arbitrary {target_login} pairs.
//
// Format: `<payload-base64url>.<sig-base64url>`
// payload JSON: { kid, vid, kln, vln, hh, exp, nonce }

import { createHmac, timingSafeEqual } from "node:crypto";

export interface KillTokenPayload {
  /** Killer github_login (lowercased). */
  kln: string;
  /** Victim github_login (lowercased). */
  vln: string;
  /** Happy hour flag at time of kill. */
  hh: boolean;
  /** Expiration (epoch ms). */
  exp: number;
  /** Server-generated nonce; ensures token uniqueness. */
  nonce: string;
}

const TOKEN_VERSION = "v1";
const MAX_TOKEN_LENGTH = 1024;

function base64urlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(s: string): Buffer {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4 !== 0) s += "=";
  return Buffer.from(s, "base64");
}

function getSecret(): string {
  const s = process.env.FORCE_PUSH_HMAC_SECRET;
  if (!s || s.length < 32) {
    throw new Error("FORCE_PUSH_HMAC_SECRET is missing or shorter than 32 chars");
  }
  return s;
}

export function signKillToken(payload: KillTokenPayload): string {
  const secret = getSecret();
  const json = JSON.stringify(payload);
  const payloadB64 = base64urlEncode(Buffer.from(json, "utf8"));
  const sigBuf = createHmac("sha256", secret).update(`${TOKEN_VERSION}.${payloadB64}`).digest();
  const sigB64 = base64urlEncode(sigBuf);
  return `${TOKEN_VERSION}.${payloadB64}.${sigB64}`;
}

export type KillTokenVerifyResult =
  | { ok: true; payload: KillTokenPayload }
  | { ok: false; reason: "invalid_format" | "bad_signature" | "expired" | "too_long" | "invalid_payload" };

export function verifyKillToken(token: string): KillTokenVerifyResult {
  if (typeof token !== "string" || token.length === 0) return { ok: false, reason: "invalid_format" };
  if (token.length > MAX_TOKEN_LENGTH) return { ok: false, reason: "too_long" };

  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) return { ok: false, reason: "invalid_format" };

  const [, payloadB64, sigB64] = parts;
  let expectedSig: Buffer;
  let providedSig: Buffer;
  try {
    expectedSig = createHmac("sha256", getSecret()).update(`${TOKEN_VERSION}.${payloadB64}`).digest();
    providedSig = base64urlDecode(sigB64);
  } catch {
    return { ok: false, reason: "invalid_format" };
  }
  if (expectedSig.length !== providedSig.length) return { ok: false, reason: "bad_signature" };
  if (!timingSafeEqual(expectedSig, providedSig)) return { ok: false, reason: "bad_signature" };

  let payload: KillTokenPayload;
  try {
    const json = base64urlDecode(payloadB64).toString("utf8");
    payload = JSON.parse(json);
  } catch {
    return { ok: false, reason: "invalid_payload" };
  }

  if (
    !payload ||
    typeof payload.kln !== "string" ||
    typeof payload.vln !== "string" ||
    typeof payload.hh !== "boolean" ||
    typeof payload.exp !== "number" ||
    typeof payload.nonce !== "string"
  ) {
    return { ok: false, reason: "invalid_payload" };
  }
  if (payload.exp < Date.now()) return { ok: false, reason: "expired" };
  if (payload.kln.length < 1 || payload.kln.length > 64) return { ok: false, reason: "invalid_payload" };
  if (payload.vln.length < 1 || payload.vln.length > 64) return { ok: false, reason: "invalid_payload" };
  if (payload.nonce.length < 8 || payload.nonce.length > 64) return { ok: false, reason: "invalid_payload" };

  return { ok: true, payload };
}
