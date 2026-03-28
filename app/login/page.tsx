import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AuthPanel from "../_ui/auth-panel";

export default async function LoginPage() {
  const session = await auth();

  if (session?.user?.id) {
    redirect("/dashboard");
  }

  return <AuthPanel mode="login" />;
}
