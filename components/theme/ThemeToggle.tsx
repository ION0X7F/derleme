"use client";

import { useState } from "react";

type ThemeMode = "dark" | "light";

function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme === "light" ? "light" : "dark";
  localStorage.setItem("sellboost-theme", theme);
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof document === "undefined") {
      return "dark";
    }

    return document.documentElement.dataset.theme === "light" ? "light" : "dark";
  });

  const nextTheme: ThemeMode = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      className={`theme-toggle ${theme === "light" ? "is-light" : ""}`}
      onClick={() => {
        applyTheme(nextTheme);
        setTheme(nextTheme);
      }}
      aria-label={
        theme === "dark" ? "Gunduz temasina gec" : "Gece temasina gec"
      }
      title={theme === "dark" ? "Gunduz temasi" : "Gece temasi"}
    >
      <span className="theme-toggle__track" aria-hidden="true">
        <span className="theme-toggle__thumb" />
      </span>
      <span className="theme-toggle__label">
        {theme === "dark" ? "Gece" : "Gunduz"}
      </span>
    </button>
  );
}
