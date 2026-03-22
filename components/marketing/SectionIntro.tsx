type Props = {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
};

export default function SectionIntro({
  eyebrow,
  title,
  description,
  align = "left",
}: Props) {
  return (
    <div className={`section-heading${align === "center" ? " section-heading--center" : ""}`}>
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <h2 className="section-title">{title}</h2>
      {description && <p className="section-text">{description}</p>}
    </div>
  );
}
