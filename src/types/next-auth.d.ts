import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      encryptionPublicKey?: string;
      encryptedPrivateKey?: string;
      encryptedPrivateKeyIv?: string;
      encryptedPrivateKeySalt?: string;
      encryptedPrivateKeyRounds?: number;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    encryptionPublicKey?: string;
    encryptedPrivateKey?: string;
    encryptedPrivateKeyIv?: string;
    encryptedPrivateKeySalt?: string;
    encryptedPrivateKeyRounds?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    encryptionPublicKey?: string;
    encryptedPrivateKey?: string;
    encryptedPrivateKeyIv?: string;
    encryptedPrivateKeySalt?: string;
    encryptedPrivateKeyRounds?: number;
  }
}

export {};
