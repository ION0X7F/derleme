import { ReactNode } from "react";

type Props = {
  children: ReactNode;
  style?: React.CSSProperties;
};

export default function SectionTitle({ children, style }: Props) {
  return (
    <p
      style={{
        margin: "0 0 14px",
        color: "var(--text-faint)",
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        ...style,
      }}
    >
      {children}
    </p>
  );
}
