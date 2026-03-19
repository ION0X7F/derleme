export function isUnlimitedUser(email?: string | null) {
  if (!email) return false;

  const allowedEmails =
    process.env.UNLIMITED_USER_EMAILS?.split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean) || [];

  return allowedEmails.includes(email.toLowerCase());
}