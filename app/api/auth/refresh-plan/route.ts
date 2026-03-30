import { NextResponse } from "next/server";
import { auth, unstable_update } from "@/auth";
import { resolvePlanForUser } from "@/lib/resolve-plan";

export async function POST() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Yetkisiz erisim." }, { status: 401 });
  }

  const plan = await resolvePlanForUser(session.user.id, session.user.email);
  const updatedSession = await unstable_update({
    user: {
      plan,
    },
  });

  return NextResponse.json({
    success: true,
    plan,
    session: updatedSession,
  });
}
