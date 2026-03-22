import { redirect } from "next/navigation";
import { auth } from "@/auth";

export async function requireSessionUser() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  return session;
}

export async function requireAdminSession() {
  const session = await requireSessionUser();

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return session;
}
