"use client";

import { useEffect, useState } from "react";

type View = "overview" | "reports" | "new-analysis" | "account" | "report-detail";

type Props = {
  initialView: View;
  reportId?: string;
};

function getQuery(view: View, reportId?: string) {
  const params = new URLSearchParams();
  params.set("view", view);
  if (reportId) params.set("reportId", reportId);
  return params.toString();
}

export default function DashboardShellFrame({ initialView, reportId }: Props) {
  const [view, setView] = useState<View>(initialView);

  useEffect(() => {
    if (initialView !== "overview") {
      setView(initialView);
      return;
    }

    const sync = () => {
      setView(window.location.hash === "#new-analysis" ? "new-analysis" : "overview");
    };

    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [initialView]);

  return (
    <iframe
      title="SellBoost Dashboard"
      src={`/dashboard-shell.html?${getQuery(view, reportId)}`}
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
