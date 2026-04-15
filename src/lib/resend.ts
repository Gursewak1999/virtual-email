import { Resend } from "resend";

const globalForResend = globalThis as unknown as {
  resend?: Resend;
};

export function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY environment variable.");
  }

  if (!globalForResend.resend) {
    globalForResend.resend = new Resend(apiKey);
  }

  return globalForResend.resend;
}
