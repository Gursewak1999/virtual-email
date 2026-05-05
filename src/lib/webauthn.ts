import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";

export const PASSKEY_RP_NAME = "IRCC Notification Control Center";
export const PASSKEY_CHALLENGE_COOKIE = "ircc_passkey_challenge";
export const PASSKEY_FLOW_COOKIE = "ircc_passkey_flow";
export const PASSKEY_FLOW_MAX_AGE_SECONDS = 5 * 60;

export type PasskeyFlow = "registration" | "authentication";

export interface WebAuthnContext {
  origin: string;
  rpId: string;
}

export interface StoredCredentialTransport {
  id: string;
  transports: AuthenticatorTransportFuture[];
}

export function getWebAuthnContext(request: Request): WebAuthnContext {
  const url = new URL(request.url);

  return {
    origin: url.origin,
    rpId: url.hostname,
  };
}

export function encodeBase64Url(value: Uint8Array): string {
  return Buffer.from(value).toString("base64url");
}

export function decodeBase64Url(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, "base64url"));
}

export function credentialTransportsFromInput(
  transports: AuthenticatorTransportFuture[] | null | undefined,
): AuthenticatorTransportFuture[] {
  return [...(transports ?? [])];
}
