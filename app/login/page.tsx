import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AuthPanel from "../_ui/auth-panel";
import { isAppPlanId, isPaidPlanId } from "@/lib/plans";

type Props = {
  searchParams?: Promise<{
    plan?: string;
  }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const session = await auth();
  const params = searchParams ? await searchParams : undefined;
  const rawPlan = String(params?.plan || "").trim().toUpperCase();

  if (session?.user?.id) {
    if (isAppPlanId(rawPlan) && isPaidPlanId(rawPlan)) {
      redirect(`/checkout?plan=${encodeURIComponent(rawPlan)}`);
    }
    redirect("/dashboard");
  }

  return <AuthPanel mode="login" />;
}
