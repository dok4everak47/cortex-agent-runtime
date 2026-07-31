const SENSITIVE_PATTERNS = [
  "APP_KEY",
  "DB_PASSWORD",
  "MAIL_PASSWORD",
  "AWS_SECRET",
  "STRIPE_SECRET",
  "PUSHER_APP_SECRET",
  "_TOKEN",
  "_SECRET",
  "PASSWORD",
  "SECRET",
]

export function redactLine(line: string): string {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith("#")) return line

  const eq = trimmed.indexOf("=")
  if (eq === -1) return line

  const key = trimmed.slice(0, eq).trim()
  const upper = key.toUpperCase()
  if (SENSITIVE_PATTERNS.some((pattern) => upper.includes(pattern))) {
    return `${key}=[REDACTED]`
  }
  return line
}

export function redactText(text: string): string {
  return text
    .split("\n")
    .map((line) => redactLine(line))
    .join("\n")
}
