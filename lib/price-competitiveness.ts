export function getPriceCompetitivenessLabel(value?: string | null) {
  if (!value) return "Belirtilmedi";

  const lower = value.toLowerCase();

  if (lower.includes("guclu teklif")) {
    return "Guclu teklif";
  }

  if (lower.includes("ucretsiz kargo ve hizli teslimat")) {
    return "Ucretsiz kargo ve hizli teslimat var";
  }

  if (lower.includes("indirim ve kampanya")) {
    return "Indirim ve kampanya var";
  }

  if (lower.includes("indirim sinyali")) {
    return "Indirim var";
  }

  if (lower.includes("rekabet baskisi var")) {
    return "Rekabet baskisi yuksek";
  }

  if (lower.includes("rakip guven seviyesi daha guclu")) {
    return "Rakip guveni daha guclu";
  }

  if (lower.includes("rakip teslimat gucu daha guclu")) {
    return "Rakip teslimati daha guclu";
  }

  if (lower.includes("en dusuk rakipten")) {
    return "Rakibe gore daha pahali";
  }

  if (lower.includes("daha ucuz rakip saticilar")) {
    return "Daha ucuz rakip var";
  }

  if (lower.includes("rakipler arasinda en dusuk fiyat")) {
    return "En dusuk fiyat sende";
  }

  if (lower.includes("en dusuk fiyat bandinda")) {
    return "En dusuk fiyat bandindasin";
  }

  if (lower.includes("rekabet bulunan urunde")) {
    return "Rekabette teklif orta seviyede";
  }

  if (lower.includes("kargo avantaji")) {
    return "Kargo kosulu fena degil";
  }

  if (lower.includes("kampanya ile desteklenen")) {
    return "Kampanya var";
  }

  if (lower.includes("teslimat bariyeri")) {
    return "Teslimat bariyeri riski";
  }

  if (lower.includes("temel fiyat sinyali")) {
    return "Fiyat var, belirgin avantaj yok";
  }

  return value;
}
