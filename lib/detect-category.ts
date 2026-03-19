type Params = {
  title?: string;
  h1?: string;
  url: string;
};

export function detectCategory({ title, h1, url }: Params): string {
  const text = `${title || ""} ${h1 || ""} ${url}`.toLowerCase();

  if (
    text.includes("ayakkabı") ||
    text.includes("sneaker") ||
    text.includes("terlik") ||
    text.includes("bot")
  ) {
    return "Ayakkabı";
  }

  if (
    text.includes("tişört") ||
    text.includes("gömlek") ||
    text.includes("pantolon") ||
    text.includes("ceket") ||
    text.includes("elbise")
  ) {
    return "Giyim";
  }

  if (
    text.includes("kitap") ||
    text.includes("roman") ||
    text.includes("yazar")
  ) {
    return "Kitap";
  }

  if (
    text.includes("telefon") ||
    text.includes("kulaklık") ||
    text.includes("tablet") ||
    text.includes("laptop")
  ) {
    return "Elektronik";
  }

  return "General";
}