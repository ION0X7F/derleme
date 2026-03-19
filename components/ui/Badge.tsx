import { CSSProperties, ReactNode } from "react";

type Variant = "default" | "green" | "yellow" | "red" | "orange" | "indigo";

type Props = {
  children: ReactNode;
  variant?: Variant;
};

const styles: Record<Variant, CSSProperties> = {
  default: {
    color: "var(--text-soft)",
    background: "color-mix(in srgb, var(--surface-soft) 100%, transparent)",
    borderColor: "var(--line)",
  },
  green: {
    color: "var(--success)",
    background: "color-mix(in srgb, var(--success) 10%, transparent)",
    borderColor: "color-mix(in srgb, var(--success) 24%, transparent)",
  },
  yellow: {
    color: "var(--warning)",
    background: "color-mix(in srgb, var(--warning) 10%, transparent)",
    borderColor: "color-mix(in srgb, var(--warning) 24%, transparent)",
  },
  red: {
    color: "var(--danger)",
    background: "color-mix(in srgb, var(--danger) 10%, transparent)",
    borderColor: "color-mix(in srgb, var(--danger) 24%, transparent)",
  },
  orange: {
    color: "var(--brand-strong)",
    background: "color-mix(in srgb, var(--brand) 10%, transparent)",
    borderColor: "color-mix(in srgb, var(--brand) 24%, transparent)",
  },
  indigo: {
    color: "var(--accent)",
    background: "color-mix(in srgb, var(--accent) 10%, transparent)",
    borderColor: "color-mix(in srgb, var(--accent) 24%, transparent)",
  },
};

export default function Badge({ children, variant = "default" }: Props) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        minHeight: 30,
        padding: "0 12px",
        borderRadius: 999,
        border: "1px solid",
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: "0.02em",
        ...styles[variant],
      }}
    >
      {children}
    </span>
  );
}

export function ScoreBadge({ score }: { score: number }) {
  const variant = score >= 70 ? "green" : score >= 45 ? "yellow" : "red";
  return <Badge variant={variant}>SEO {score}/100</Badge>;
}
