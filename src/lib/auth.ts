import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { AuthenticationResponseJSON } from "@simplewebauthn/server";

import {
  parseChallengeCookie,
  verifyPasskeyAuthentication,
  verifyRecoveryCode,
} from "@/lib/passkey-auth";

function toRequest(req: {
  headers?: Record<string, string | string[] | undefined>;
  url?: string;
}): Request {
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers ?? {})) {
    if (typeof value === "string") {
      headers.set(key, value);
    }
  }

  const origin =
    typeof req.headers?.origin === "string"
      ? req.headers.origin
      : typeof req.headers?.referer === "string"
        ? new URL(req.headers.referer).origin
        : typeof req.headers?.host === "string"
          ? `http://${req.headers.host}`
          : "http://localhost:3000";

  return new Request(req.url ?? origin, { headers });
}

const authSecret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;

if (!authSecret) {
  throw new Error("Missing NEXTAUTH_SECRET (or AUTH_SECRET) for NextAuth.");
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth",
  },
  providers: [
    CredentialsProvider({
      name: "Passkey or Recovery Code",
      credentials: {
        email: {
          label: "Email",
          type: "email",
        },
        authResponse: {
          label: "Passkey Response",
          type: "text",
        },
        recoveryCode: {
          label: "Recovery Code",
          type: "text",
        },
      },
      async authorize(credentials, req) {
        if (
          typeof credentials?.email !== "string" ||
          (typeof credentials?.authResponse !== "string" &&
            typeof credentials?.recoveryCode !== "string")
        ) {
          return null;
        }

        const email = credentials.email.trim().toLowerCase();

        if (typeof credentials.recoveryCode === "string") {
          return verifyRecoveryCode(email, credentials.recoveryCode);
        }

        if (!credentials.authResponse || !req) {
          return null;
        }

        const expectedChallenge = parseChallengeCookie(
          req.headers?.cookie ?? "",
        );
        if (!expectedChallenge) {
          return null;
        }

        let authenticationResponse: AuthenticationResponseJSON;

        try {
          authenticationResponse = JSON.parse(
            credentials.authResponse,
          ) as AuthenticationResponseJSON;
        } catch {
          return null;
        }

        return verifyPasskeyAuthentication(toRequest(req), {
          email,
          authenticationResponse,
          challenge: expectedChallenge,
        });
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
        token.encryptionPublicKey =
          typeof user.encryptionPublicKey === "string"
            ? user.encryptionPublicKey
            : undefined;
        token.encryptedPrivateKey =
          typeof user.encryptedPrivateKey === "string"
            ? user.encryptedPrivateKey
            : undefined;
        token.encryptedPrivateKeyIv =
          typeof user.encryptedPrivateKeyIv === "string"
            ? user.encryptedPrivateKeyIv
            : undefined;
        token.encryptedPrivateKeySalt =
          typeof user.encryptedPrivateKeySalt === "string"
            ? user.encryptedPrivateKeySalt
            : undefined;
        token.encryptedPrivateKeyRounds =
          typeof user.encryptedPrivateKeyRounds === "number"
            ? user.encryptedPrivateKeyRounds
            : undefined;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && typeof token.id === "string") {
        session.user.id = token.id;
        session.user.encryptionPublicKey =
          typeof token.encryptionPublicKey === "string"
            ? token.encryptionPublicKey
            : undefined;
        session.user.encryptedPrivateKey =
          typeof token.encryptedPrivateKey === "string"
            ? token.encryptedPrivateKey
            : undefined;
        session.user.encryptedPrivateKeyIv =
          typeof token.encryptedPrivateKeyIv === "string"
            ? token.encryptedPrivateKeyIv
            : undefined;
        session.user.encryptedPrivateKeySalt =
          typeof token.encryptedPrivateKeySalt === "string"
            ? token.encryptedPrivateKeySalt
            : undefined;
        session.user.encryptedPrivateKeyRounds =
          typeof token.encryptedPrivateKeyRounds === "number"
            ? token.encryptedPrivateKeyRounds
            : undefined;
      }

      return session;
    },
  },
  secret: authSecret,
};
