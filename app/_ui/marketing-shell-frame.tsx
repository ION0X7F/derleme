"use client";

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
