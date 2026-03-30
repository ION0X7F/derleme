import { auth } from "@/auth";
import AuthPanel from "../_ui/auth-panel";

export default async function AdminPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <AuthPanel
        mode="login"
        callbackUrlOverride="/admin"
        context="admin"
      />
    );
  }

  return (
    <iframe
      src="/admin-panel.html"
      style={{
        width: "100vw",
        height: "100vh",
        border: "none",
        display: "block",
      }}
      title="SellBoost Admin Panel"
    />
  );
}
