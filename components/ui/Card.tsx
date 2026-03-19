import { CSSProperties, ReactNode } from "react";

type Props = {
  children: ReactNode;
  style?: CSSProperties;
  hoverable?: boolean;
};

export default function Card({ children, style, hoverable }: Props) {
  return (
    <section
      className={`surface app-card${hoverable ? " surface-hover" : ""}`}
      style={style}
    >
      {children}
    </section>
  );
}
