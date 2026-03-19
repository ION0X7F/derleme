type Props = {
  label: string;
  value?: string | null;
};

export default function InfoRow({ label, value }: Props) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(120px, 180px) 1fr",
        gap: 14,
        padding: "12px 0",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <span
        style={{
          color: "var(--text-faint)",
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>

      <span
        style={{
          color: value ? "var(--text-soft)" : "var(--text-faint)",
          fontSize: 14,
          fontWeight: value ? 700 : 500,
          fontStyle: value ? "normal" : "italic",
          lineHeight: 1.75,
          wordBreak: "break-word",
        }}
      >
        {value || "Bulunamadi"}
      </span>
    </div>
  );
}
