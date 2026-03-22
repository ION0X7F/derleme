type Params = {
  title?: string | null;
  h1?: string | null;
  brand?: string | null;
  product_name?: string | null;
  url: string;
};

function normalizeText(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function detectCategory({
  title,
  h1,
  brand,
  product_name,
  url,
}: Params): string {
  const text = normalizeText(
    `${title || ""} ${h1 || ""} ${brand || ""} ${product_name || ""} ${url}`
  );

  if (
    text.includes("ayakkabi") ||
    text.includes("sneaker") ||
    text.includes("bot") ||
    text.includes("terlik") ||
    text.includes("cizme")
  ) {
    return "Ayakkabi";
  }

  if (
    text.includes("tisort") ||
    text.includes("gomlek") ||
    text.includes("pantolon") ||
    text.includes("ceket") ||
    text.includes("elbise") ||
    text.includes("mont")
  ) {
    return "Giyim";
  }

  if (text.includes("kitap") || text.includes("roman") || text.includes("yazar")) {
    return "Kitap";
  }

  if (
    text.includes("telefon") ||
    text.includes("kulaklik") ||
    text.includes("tablet") ||
    text.includes("laptop") ||
    text.includes("bilgisayar")
  ) {
    return "Elektronik";
  }

  return "General";
}
