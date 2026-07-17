export const ADMIN_EMAILS = ["trish@zoda.sg"];

export function isAdminEmail(email: string | null | undefined) {
  return Boolean(email && ADMIN_EMAILS.includes(email.toLowerCase()));
}
