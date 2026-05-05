import { randomBytes } from "node:crypto";

import type { User as NextAuthUser } from "next-auth";

import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { compare, hash } from "bcryptjs";

import { prisma } from "@/lib/prisma";
import {
  decodeBase64Url,
  encodeBase64Url,
  getWebAuthnContext,
  type WebAuthnContext,
} from "@/lib/webauthn";

const challengeCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: 5 * 60,
};

export interface PasskeyRegistrationInput {
  userId: string;
  email: string;
  name: string;
}

export interface PasskeyVaultInput {
  publicKeyJwk: string;
  encryptedPrivateKey: string;
  encryptedPrivateKeyIv: string;
  encryptedPrivateKeySalt: string;
  encryptedPrivateKeyRounds: number;
}

export type PasskeySessionUser = NextAuthUser;

export function getChallengeCookieOptions() {
  return challengeCookieOptions;
}

export function getPasskeyContext(request: Request): WebAuthnContext {
  return getWebAuthnContext(request);
}

export async function buildRegistrationOptions(
  request: Request,
  input: PasskeyRegistrationInput,
) {
  const context = getPasskeyContext(request);
  const userIdBytes = new TextEncoder().encode(input.userId);
  const existingCredentials = await prisma.passkeyCredential.findMany({
    where: {
      user: {
        email: input.email.toLowerCase(),
      },
    },
  });

  return generateRegistrationOptions({
    rpName: "IRCC Notification Control Center",
    rpID: context.rpId,
    userName: input.email.toLowerCase(),
    userDisplayName: input.name.trim(),
    userID: userIdBytes,
    excludeCredentials: existingCredentials.map((credential) => ({
      id: credential.credentialId,
      transports: credential.transports as AuthenticatorTransportFuture[],
    })),
    attestationType: "none",
    authenticatorSelection: {
      userVerification: "preferred",
    },
    supportedAlgorithmIDs: [-7, -8, -257, -258, -259],
  });
}

export async function buildAuthenticationOptions(request: Request, email: string) {
  const context = getPasskeyContext(request);
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { passkeyCredentials: true },
  });

  if (!user || user.passkeyCredentials.length === 0) {
    return null;
  }

  return generateAuthenticationOptions({
    rpID: context.rpId,
    allowCredentials: user.passkeyCredentials.map((credential) => ({
      id: credential.credentialId,
      transports: credential.transports as AuthenticatorTransportFuture[],
    })),
    userVerification: "preferred",
  });
}

export function parseChallengeCookie(cookieHeader: string): string | null {
  const match = cookieHeader.match(/(?:^|;\s*)ircc_passkey_challenge=([^;]+)/);
  return match?.[1] ?? null;
}

export function getExpectedOrigin(request: Request): string {
  const url = new URL(request.url);
  return url.origin;
}

export async function verifyAndStoreRegistration(
  request: Request,
  input: {
    registrationResponse: RegistrationResponseJSON;
    user: PasskeyRegistrationInput;
    vault: PasskeyVaultInput;
    challenge: string;
  },
): Promise<{ user: PasskeySessionUser; recoveryCodes: string[] } | null> {
  const context = getPasskeyContext(request);
  const verified = await verifyRegistrationResponse({
    response: input.registrationResponse,
    expectedChallenge: input.challenge,
    expectedOrigin: getExpectedOrigin(request),
    expectedRPID: context.rpId,
    requireUserVerification: true,
  });

  if (!verified.verified) {
    return null;
  }

  const user = await prisma.user.upsert({
    where: { email: input.user.email.toLowerCase() },
    create: {
      id: input.user.userId,
      email: input.user.email.toLowerCase(),
      name: input.user.name.trim(),
      encryptionPublicKey: input.vault.publicKeyJwk,
      encryptedPrivateKey: input.vault.encryptedPrivateKey,
      encryptedPrivateKeyIv: input.vault.encryptedPrivateKeyIv,
      encryptedPrivateKeySalt: input.vault.encryptedPrivateKeySalt,
      encryptedPrivateKeyRounds: input.vault.encryptedPrivateKeyRounds,
    },
    update: {
      name: input.user.name.trim(),
      encryptionPublicKey: input.vault.publicKeyJwk,
      encryptedPrivateKey: input.vault.encryptedPrivateKey,
      encryptedPrivateKeyIv: input.vault.encryptedPrivateKeyIv,
      encryptedPrivateKeySalt: input.vault.encryptedPrivateKeySalt,
      encryptedPrivateKeyRounds: input.vault.encryptedPrivateKeyRounds,
    },
  });

  const credential = verified.registrationInfo.credential;

  await prisma.passkeyCredential.upsert({
    where: { credentialId: credential.id },
    create: {
      userId: user.id,
      credentialId: credential.id,
      publicKey: encodeBase64Url(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports ?? [],
      backedUp: verified.registrationInfo.credentialBackedUp,
      lastUsedAt: new Date(),
    },
    update: {
      userId: user.id,
      publicKey: encodeBase64Url(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports ?? [],
      backedUp: verified.registrationInfo.credentialBackedUp,
      lastUsedAt: new Date(),
    },
  });

  const recoveryCodes = await createRecoveryCodes(user.id);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name ?? undefined,
      encryptionPublicKey: user.encryptionPublicKey ?? undefined,
      encryptedPrivateKey: user.encryptedPrivateKey ?? undefined,
      encryptedPrivateKeyIv: user.encryptedPrivateKeyIv ?? undefined,
      encryptedPrivateKeySalt: user.encryptedPrivateKeySalt ?? undefined,
      encryptedPrivateKeyRounds: user.encryptedPrivateKeyRounds ?? undefined,
    },
    recoveryCodes,
  };
}

export async function verifyPasskeyAuthentication(
  request: Request,
  input: {
    email: string;
    authenticationResponse: AuthenticationResponseJSON;
    challenge: string;
  },
): Promise<PasskeySessionUser | null> {
  const context = getPasskeyContext(request);
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
    include: { passkeyCredentials: true },
  });

  if (!user) {
    return null;
  }

  const credential = user.passkeyCredentials.find(
    (item) => item.credentialId === input.authenticationResponse.id,
  );

  if (!credential) {
    return null;
  }

  const verified = await verifyAuthenticationResponse({
    response: input.authenticationResponse,
    expectedChallenge: input.challenge,
    expectedOrigin: getExpectedOrigin(request),
    expectedRPID: context.rpId,
    credential: {
      id: credential.credentialId,
      publicKey: decodeBase64Url(credential.publicKey) as Uint8Array<ArrayBuffer>,
      counter: credential.counter,
      transports: credential.transports as AuthenticatorTransportFuture[],
    },
    requireUserVerification: true,
  });

  if (!verified.verified) {
    return null;
  }

  await prisma.passkeyCredential.update({
    where: { id: credential.id },
    data: {
      counter: verified.authenticationInfo.newCounter,
      backedUp: verified.authenticationInfo.credentialBackedUp,
      lastUsedAt: new Date(),
    },
  });

  return {
    id: user.id,
    email: user.email,
    name: user.name ?? undefined,
    encryptionPublicKey: user.encryptionPublicKey ?? undefined,
    encryptedPrivateKey: user.encryptedPrivateKey ?? undefined,
    encryptedPrivateKeyIv: user.encryptedPrivateKeyIv ?? undefined,
    encryptedPrivateKeySalt: user.encryptedPrivateKeySalt ?? undefined,
    encryptedPrivateKeyRounds: user.encryptedPrivateKeyRounds ?? undefined,
  };
}

export async function verifyRecoveryCode(
  email: string,
  recoveryCode: string,
): Promise<PasskeySessionUser | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedCode = recoveryCode.trim().toUpperCase();

  if (!normalizedEmail || !normalizedCode) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    return null;
  }

  const recoveryEntries = await prisma.recoveryCode.findMany({
    where: {
      userId: user.id,
      usedAt: null,
    },
    orderBy: { createdAt: "asc" },
  });

  for (const entry of recoveryEntries) {
    if (await compare(normalizedCode, entry.codeHash)) {
      await prisma.recoveryCode.update({
        where: { id: entry.id },
        data: { usedAt: new Date() },
      });

      return {
        id: user.id,
        email: user.email,
        name: user.name ?? undefined,
        encryptionPublicKey: user.encryptionPublicKey ?? undefined,
        encryptedPrivateKey: user.encryptedPrivateKey ?? undefined,
        encryptedPrivateKeyIv: user.encryptedPrivateKeyIv ?? undefined,
        encryptedPrivateKeySalt: user.encryptedPrivateKeySalt ?? undefined,
        encryptedPrivateKeyRounds: user.encryptedPrivateKeyRounds ?? undefined,
      };
    }
  }

  return null;
}

async function createRecoveryCodes(userId: string): Promise<string[]> {
  const recoveryCodes = Array.from({ length: 5 }, () => generateRecoveryCode());
  const hashedCodes = await Promise.all(recoveryCodes.map((code) => hash(code, 12)));

  await prisma.recoveryCode.createMany({
    data: hashedCodes.map((codeHash) => ({
      userId,
      codeHash,
    })),
  });

  return recoveryCodes;
}

function generateRecoveryCode(length = 12): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(length);
  let output = "";

  for (let index = 0; index < length; index += 1) {
    output += alphabet[bytes[index] % alphabet.length];
  }

  return output;
}
