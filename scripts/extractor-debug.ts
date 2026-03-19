import { extractFieldsWithFallback } from "@/lib/extractors";
import { fetchPageHtml } from "@/lib/fetch-page-html";

async function run() {
  const urls = [
    "https://www.hepsiburada.com/easyso-portakal-limon-narenciye-sikacagi-dokum-23cm-buyuk-boy-efsanevi-easyso-modeli-2174-p-HBCV00001QP4O3",
    "https://www.hepsiburada.com/tp-link-tl-wa854re-wi-fi-300mbps-menzil-genisletici-priz-tipi-p-BD501264",
    "https://www.hepsiburada.com/kraft-hart-cift-akulu-sarjli-yuksek-basincli-oto-araba-bahce-yikama-sulama-ve-temizleme-tabancasi-makinesi-p-HBCV00006RXJYW",
    "https://www.trendyol.com/zbclub/beyaz-unisex-running-sneaker-ayakkabi-p-1118369786",
    "https://www.trendyol.com/cocuk-akademi/7-den-70-e-turkiye-atlasi-p-937160613?boutiqueId=61",
    "https://www.trendyol.com/xiaomi/redmi-buds-6-play-siyah-kulakici-kulaklik-gurultu-onleme-bt5-4-ios-android-xiaomi-tr-garantili-p-855229295?boutiqueId=61",
    "https://www.n11.com/urun/seiko-prospex-divers-300m-coastal-scene-spb483j-otomatik-erkek-kol-saati-65517820?magaza=asimoptiksaat",
    "https://www.n11.com/urun/sleepy-natural-double-soft-ultra-paket-bebek-bezi-6-numara-xlarge-124-adet-6-numara-118126308?magaza=sleepy",
    "https://www.n11.com/urun/black-mix-para-sayma-makinasi-tl-61970168?magaza=tumpa",
    "https://www.amazon.com.tr/16-AM0009NT-7-240H-Freedos-Laptop-BQ1Y7EA/dp/B0G3QLHC56/",
    "https://amazon.com.tr/Stanley-Quencher-Pipetli-Termos-Bardak/dp/B0CNTWY3VM/",
    "https://amazon.com.tr/Levis-Crop-Kadın-Jean-Pantolon/dp/B0CVHDJRFL/",
  ];

  for (const url of urls) {
    try {
      const html = await fetchPageHtml(url);
      const result = extractFieldsWithFallback({ url, html });

      console.log("\n==================================================");
      console.log("URL:", url);
      console.log("PLATFORM:", result.platform);
      console.log("MERGED:", result.mergedFields);
    } catch (error) {
      console.log("\n==================================================");
      console.log("URL:", url);
      console.log("ERROR:", error);
    }
  }
}

run();