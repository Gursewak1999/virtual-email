const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmailAddress(value: string): string {
  return value.trim().toLowerCase();
}

export function isLikelyEmailAddress(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

export function parseRecipientInput(
  value: string | string[] | null | undefined,
): string[] {
  const rawParts = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,;\n]+/)
      : [];

  const normalized = rawParts
    .map((item) => normalizeEmailAddress(item))
    .filter(Boolean)
    .filter((item, index, all) => all.indexOf(item) === index)
    .filter(isLikelyEmailAddress);

  return normalized;
}

export function extractEmailAddress(
  value: string | null | undefined,
): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  const match = trimmed.match(/<([^<>]+)>/);
  const candidate = match?.[1] ?? trimmed;

  if (!isLikelyEmailAddress(candidate)) {
    return null;
  }

  return normalizeEmailAddress(candidate);
}

export function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildSnippet(
  text: string | null | undefined,
  maxLength = 140,
): string {
  if (!text) {
    return "";
  }

  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}
