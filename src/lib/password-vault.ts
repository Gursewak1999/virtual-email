import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function getEncryptionKey(): Buffer {
  const secret = process.env.APP_ENCRYPTION_KEY ?? process.env.NEXTAUTH_SECRET;

  if (!secret) {
    throw new Error(
      "Missing APP_ENCRYPTION_KEY (or NEXTAUTH_SECRET fallback) for mailbox password encryption.",
    );
  }

  return createHash("sha256").update(secret).digest();
}

export interface EncryptedPassword {
  ciphertext: string;
  iv: string;
  tag: string;
}

export function encryptMailboxPassword(password: string): EncryptedPassword {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);

  const ciphertextBuffer = Buffer.concat([
    cipher.update(password, "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return {
    ciphertext: ciphertextBuffer.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

export function decryptMailboxPassword(payload: EncryptedPassword): string {
  const decipher = createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(payload.iv, "base64"),
  );

  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

export function generateMailboxPassword(length = 18): string {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*";
  const bytes = randomBytes(length);

  let password = "";
  for (let index = 0; index < length; index += 1) {
    password += alphabet[bytes[index] % alphabet.length];
  }

  return password;
}
