import { cookies } from "next/headers";
import { randomUUID } from "crypto";

const GUEST_COOKIE_NAME = "sellboost_guest_id";

export async function getOrCreateGuestId() {
  const cookieStore = await cookies();
  let guestId = cookieStore.get(GUEST_COOKIE_NAME)?.value;

  if (!guestId) {
    guestId = randomUUID();

    cookieStore.set(GUEST_COOKIE_NAME, guestId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return guestId;
}

export async function getGuestId() {
  const cookieStore = await cookies();
  return cookieStore.get(GUEST_COOKIE_NAME)?.value ?? null;
}