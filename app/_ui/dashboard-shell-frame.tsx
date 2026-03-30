"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  WORKSPACE_ROUTES,
  getCanonicalReportRoute,
  isCanonicalWorkspacePath,
} from "@/lib/workspace-routes";

type View =
  | "overview"
  | "reports"
  | "new-analysis"
  | "account"
  | "settings"
  | "report-detail";

type Props = {
  initialView: View;
  reportId?: string;
  initialPrefillUrl?: string;
  initialAutorun?: boolean;
};

type WorkspaceRouteState = {
  view: View;
  reportId?: string;
};

const DASHBOARD_SHELL_VERSION = "2026-03-29-13";

function getQuery(
  view: View,
  reportId?: string,
  passthrough?: { prefillUrl?: string; autorun?: boolean }
) {
  const params = new URLSearchParams();
  params.set("view", view);
  if (reportId) params.set("reportId", reportId);
  if (passthrough?.prefillUrl) params.set("prefillUrl", passthrough.prefillUrl);
  if (passthrough?.autorun) params.set("autorun", "1");
  return params.toString();
}

function normalizeNavigationHref(href: string) {
  if (!href.startsWith("/")) return "";
  if (href.startsWith("/reports/")) {
    const suffix = href.slice("/reports/".length);
    const [reportId, rest = ""] = suffix.split(/(?=[?#])/);
    return reportId ? `${getCanonicalReportRoute(reportId)}${rest}` : WORKSPACE_ROUTES.reports;
  }
  return href;
}

function toWorkspaceRouteState(pathname: string): WorkspaceRouteState | null {
  if (pathname === WORKSPACE_ROUTES.dashboard) return { view: "overview" };
  if (pathname === WORKSPACE_ROUTES.analyze) return { view: "new-analysis" };
  if (pathname === WORKSPACE_ROUTES.reports) return { view: "reports" };
  if (pathname === WORKSPACE_ROUTES.account) return { view: "account" };
  if (pathname === WORKSPACE_ROUTES.settings) return { view: "settings" };
  if (pathname.startsWith("/report/")) {
    const reportId = pathname.slice("/report/".length).split(/[?#]/)[0];
    if (reportId) {
      return { view: "report-detail", reportId: decodeURIComponent(reportId) };
    }
  }
  return null;
}

export default function DashboardShellFrame({
  initialView,
  reportId,
  initialPrefillUrl,
  initialAutorun,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [isFrameReady, setIsFrameReady] = useState(false);
  const [frameHash, setFrameHash] = useState("");
  const passthrough =
    initialView === "new-analysis"
      ? {
          prefillUrl:
            initialPrefillUrl || searchParams.get("url") || undefined,
          autorun:
            initialAutorun === true || searchParams.get("autorun") === "1",
        }
      : undefined;

  const postViewToIframe = (nextState: WorkspaceRouteState) => {
    const frameWindow = iframeRef.current?.contentWindow;
    if (!frameWindow) return;
    frameWindow.postMessage(
      {
        type: "sellboost:set-view",
        view: nextState.view,
        reportId: nextState.reportId,
      },
      window.location.origin
    );
  };

  useEffect(() => {
    setIsFrameReady(false);
  }, [initialView, reportId]);

  useEffect(() => {
    const syncHash = () => setFrameHash(window.location.hash || "");
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || typeof data !== "object" || data.type !== "sellboost:navigate") return;
      const href = typeof data.href === "string" ? normalizeNavigationHref(data.href) : "";
      if (!href) return;
      if (isCanonicalWorkspacePath(href)) {
        const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        if (currentUrl !== href) {
          window.history.pushState({}, "", href);
        }
        return;
      }
      router.push(href);
    };

    const onPopState = () => {
      const nextState = toWorkspaceRouteState(window.location.pathname);
      if (!nextState) return;
      postViewToIframe(nextState);
    };

    window.addEventListener("message", onMessage);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("popstate", onPopState);
    };
  }, [router]);

  useEffect(() => {
    const frame = iframeRef.current;
    if (!frame) return;

    const markReady = () => setIsFrameReady(true);
    const intervalId = window.setInterval(() => {
      try {
        const doc = frame.contentDocument;
        if (!doc) return;
        if (doc.readyState === "interactive" || doc.readyState === "complete") {
          markReady();
          window.clearInterval(intervalId);
        }
      } catch {
        // Same-origin static asset; ignore transient access errors.
      }
    }, 120);

    const timeoutId = window.setTimeout(markReady, 2500);
    frame.addEventListener("load", markReady);

    return () => {
      frame.removeEventListener("load", markReady);
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [initialView, reportId]);

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, rgba(79, 127, 255, 0.14), transparent 32%), #09090e",
      }}
    >
      {!isFrameReady ? (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            background:
              "linear-gradient(180deg, rgba(9, 9, 14, 0.98), rgba(15, 16, 24, 0.98))",
            pointerEvents: "none",
            zIndex: 1,
          }}
        >
          <div
            style={{
              display: "grid",
              gap: "12px",
              justifyItems: "center",
              color: "#eceff8",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "999px",
                border: "2px solid rgba(255,255,255,0.12)",
                borderTopColor: "#4f7fff",
                animation: "sellboost-spin 0.8s linear infinite",
              }}
            />
            <div style={{ fontSize: "13px", opacity: 0.78 }}>Panel hazirlaniyor...</div>
          </div>
        </div>
      ) : null}

      <iframe
        ref={iframeRef}
        title="SellBoost Dashboard"
        src={`/dashboard-shell.html?${getQuery(initialView, reportId, passthrough)}&shellv=${DASHBOARD_SHELL_VERSION}${frameHash}`}
        onLoad={() => setIsFrameReady(true)}
        style={{
          display: "block",
          width: "100%",
          height: "100vh",
          border: "0",
          background: "#09090e",
          opacity: isFrameReady ? 1 : 0,
          transition: "opacity 0.18s ease",
        }}
      />

      <style jsx>{`
        @keyframes sellboost-spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
