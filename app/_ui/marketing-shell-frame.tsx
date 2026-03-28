"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

type PageView =
  | "home"
  | "features"
  | "pricing"
  | "login"
  | "register"
  | "report";

type Props = {
  initialView: PageView;
};

export default function MarketingShellFrame({ initialView }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || typeof data !== "object" || data.type !== "sellboost:navigate") return;
      const href = typeof data.href === "string" ? data.href : "";
      if (!href || href === pathname) return;
      router.push(href);
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [pathname, router]);

  return (
    <iframe
      title="SellBoost Marketing"
      src={`/marketing-shell.html?page=${initialView}`}
      style={{
        display: "block",
        width: "100%",
        height: "100vh",
        border: "0",
        background: "#09090e",
      }}
    />
  );
}
