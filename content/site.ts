export type MarketingNavItem = {
  href: string;
  label: string;
};

export type MarketingPlan = {
  key: string;
  name: string;
  price: string;
  billing: string;
  subtitle: string;
  description: string;
  features: string[];
  badge?: string;
  featured?: boolean;
  accent?: "brand" | "accent" | "success" | "neutral";
  ctaHref: string;
  ctaLabel: string;
};

export const marketingNavItems: MarketingNavItem[] = [
  { href: "/features", label: "Ozellikler" },
  { href: "/how-it-works", label: "Nasil Calisir" },
  { href: "/pricing", label: "Fiyatlandirma" },
  { href: "/about", label: "Hakkimizda" },
  { href: "/faq", label: "SSS" },
];

export const footerLinks: MarketingNavItem[] = [
  { href: "/", label: "Ana Sayfa" },
  { href: "/features", label: "Ozellikler" },
  { href: "/how-it-works", label: "Nasil Calisir" },
  { href: "/pricing", label: "Fiyatlandirma" },
  { href: "/about", label: "Hakkimizda" },
  { href: "/faq", label: "SSS" },
];

export const landingBenefits = [
  {
    code: "KT",
    title: "Kritik teshis once gelir",
    text: "Skor yiginindan once ana darbozagi adlandirir ve hangi katmanin satisi frenledigini gosterir.",
  },
  {
    code: "RK",
    title: "Rekabet sinyalleri birlikte okunur",
    text: "Fiyat, teslimat, guven ve diger satici baskisini ayni karar ekseninde yorumlar.",
  },
  {
    code: "AI",
    title: "AI yorumlari aksiyona doner",
    text: "Baslik, icerik, guven ve teklif tarafinda once neyin degismesini gerektigini siralar.",
  },
];

export const landingTrustSignals = [
  "Trendyol urun akisi ve teklif yapisina odakli",
  "Kategori benchmarki ve karar izi ile aciklanabilir teshis",
  "Guest giriste teaser, kayitli kullanicida tam rapor deneyimi",
];

export const productFeatureGroups = [
  {
    eyebrow: "Kesif",
    title: "Baslik, aciklama ve gorsel yeterliligini okur",
    text: "Icerik derinligi, gorsel cesitlilik, teknik alanlar ve urun anlatimi birlikte degerlendirilir.",
  },
  {
    eyebrow: "Guven",
    title: "Yorum, satici ve iade sinyallerini birlestirir",
    text: "Yildiz puani, yorum ozeti, satici guveni ve resmi satici etkisi ayni panelde gorunur.",
  },
  {
    eyebrow: "Teklif",
    title: "Fiyat ve teslimat baskisini ayni eksende tartar",
    text: "Fiyat pozisyonu, kargo hizi, ucretsiz kargo ve kampanya sinyalleri karar seviyesinde yorumlanir.",
  },
  {
    eyebrow: "Rekabet",
    title: "Diger satici tekliflerini ayrismaya cevirir",
    text: "Diger satici sayisi, fiyat farki, hizli teslimat ve guven seviyesi rakip baskisina cevrilir.",
  },
  {
    eyebrow: "Yorumlama",
    title: "AI sinyalleri tekilleştirip aksiyon listesi uretir",
    text: "Veri carpistirma, kritik teshis, oncelikli aksiyonlar ve karar izi tek ciktiya doner.",
  },
  {
    eyebrow: "Yonetim",
    title: "Rapor kutuphanesi ve export akisina tasinir",
    text: "Kayitli rapor, premium export ve tekrar okunabilir karar ekranlari ayni urun deneyiminde kalir.",
  },
];

export const howItWorksSteps = [
  {
    step: "01",
    title: "Linki gir",
    text: "Trendyol urun baglantisini yapistir. Sistem sayfa icerigini, satici katmanini ve temel teklif sinyallerini toplar.",
  },
  {
    step: "02",
    title: "Veriyi zenginlestir",
    text: "Ham HTML, platform extractor ve varsa ek seller verisi tamamlanarak guvenli bir analiz paketi olusturulur.",
  },
  {
    step: "03",
    title: "Sinyalleri carpistir",
    text: "Fiyat, teslimat, gorsel, icerik, yorum ve guven alanlari kategori benchmarki ile birlikte degerlendirilir.",
  },
  {
    step: "04",
    title: "AI yorumu olustur",
    text: "Model tek basina karar vermez; deterministik teshis, benchmark ve ogrenilen kurallarla hizali cikti verir.",
  },
  {
    step: "05",
    title: "Aksiyonlari goster",
    text: "Kritik teshis, oncelikli aksiyonlar, kalite kartlari ve karar izi rapor ekraninda acilir.",
  },
];

export const pricingPlans: MarketingPlan[] = [
  {
    key: "free",
    name: "Ucretsiz",
    price: "0 TL",
    billing: "/ ay",
    subtitle: "Sistemi tanimak isteyenler icin giris seviyesi",
    description:
      "Temel skor gorunumu, sinirli analiz hakki ve kilitli premium alanlarla hizli deneme yapisi.",
    features: [
      "Sinirli analiz hakki",
      "Temel skor gorunumu",
      "Sinirli analiz onizlemesi",
      "Kismi AI yorumlama",
      "Sinirli rapor gecmisi",
      "Gelişmis rekabet detaylari sinirli",
    ],
    accent: "neutral",
    ctaHref: "/register",
    ctaLabel: "Ucretsiz Basla",
  },
  {
    key: "pro",
    name: "Pro",
    price: "399 TL",
    billing: "/ ay",
    subtitle: "Gercek kullanicilar icin ana karar paneli",
    description:
      "Tam AI analiz, premium dashboard ve detayli urun teshisi ile SellBoost deneyiminin merkez paketi.",
    features: [
      "Tam AI analiz ve kritik teshis",
      "Baslik, aciklama ve SSS onerileri",
      "Rakip fiyat ve teklif analizi",
      "Detayli dashboard ve rapor kutuphanesi",
      "Daha guclu kullanim limiti",
      "Gelismis tahmin ve aksiyon ekranlari",
    ],
    badge: "En populer",
    featured: true,
    accent: "brand",
    ctaHref: "/register?plan=PRO_MONTHLY",
    ctaLabel: "Pro'ya Gec",
  },
  {
    key: "pro-yearly",
    name: "Pro Yillik",
    price: "3.990 TL",
    billing: "/ yil",
    subtitle: "Uzun vadede en iyi deger",
    description:
      "Pro deneyimini daha guclu deger algisi ve uzun vadeli kullanim mantigi ile sunar.",
    features: [
      "Pro planin tum ozellikleri",
      "Yillik kullanim avantaji",
      "Daha yuksek deger algisi",
      "Surekli rapor ve karar izi akisi",
    ],
    badge: "En avantajli",
    accent: "success",
    ctaHref: "/register?plan=PRO_YEARLY",
    ctaLabel: "Yillik Degeri Sec",
  },
  {
    key: "team",
    name: "Team / Ajans",
    price: "1.290 TL",
    billing: "/ ay",
    subtitle: "Ekipler ve cok urun yoneten yapilar icin",
    description:
      "Daha yuksek kapasite, rapor yonetimi ve ekip kullanimina uygun daha kurumsal deneyim.",
    features: [
      "Ekip odakli kullanim hissi",
      "Daha yuksek analiz kapasitesi",
      "Gelismis rapor yonetimi",
      "Ajans ve coklu urun akislari icin uygun yapi",
    ],
    accent: "accent",
    ctaHref: "/register?plan=TEAM",
    ctaLabel: "Ekip Paketi Sor",
  },
];

export const pricingMatrix = [
  {
    feature: "Aylik analiz hakki",
    free: "Sinirli",
    pro: "Yuksek",
    yearly: "Yuksek",
    team: "Cok yuksek",
  },
  {
    feature: "AI yorumlama derinligi",
    free: "Kismi",
    pro: "Tam",
    yearly: "Tam",
    team: "Tam + ekip akisli",
  },
  {
    feature: "Rapor kutuphanesi",
    free: "Sinirli",
    pro: "Genis",
    yearly: "Genis",
    team: "Ekip odakli",
  },
  {
    feature: "Export ve premium aksiyonlar",
    free: "Kilitli",
    pro: "Acik",
    yearly: "Acik",
    team: "Acik",
  },
];

export const faqItems = [
  {
    q: "SellBoost tam olarak neyi analiz ediyor?",
    a: "Trendyol urun sayfasindaki fiyat, teslimat, yorum, guven, icerik ve rekabet sinyallerini tek karar paneline topluyor.",
  },
  {
    q: "Ucretsiz plan ile Pro arasindaki ana fark nedir?",
    a: "Ucretsiz plan daha cok teaser ve temel skor deneyimi sunar. Pro ise tam AI yorumu, derin dashboard, export ve daha guclu aksiyon ekranlarini acar.",
  },
  {
    q: "Ilk 15 gun Pro kampanyasi nasil calisiyor?",
    a: "Ilk karar surecini hizlandirmak icin Pro deneyimini kampanyali sekilde denemeye acan sinirli sureli premium giris teklifidir.",
  },
  {
    q: "Raporlar kaydoluyor mu?",
    a: "Kayitli kullanicilarin raporlari uygun plan seviyesinde kutuphaneye eklenir ve daha sonra rapor ekranindan tekrar acilabilir.",
  },
  {
    q: "AI tek basina mi karar veriyor?",
    a: "Hayir. Sistem deterministik analiz, benchmark ve ogrenilmis kurallari birlestirip AI yorumunu bunlarla hizalar.",
  },
  {
    q: "Takim veya ajans kullanimina uygun mu?",
    a: "Evet. Team / Ajans paketi cok urunlu kullanim ve operasyonel takip ihtiyacina gore konumlandirildi.",
  },
];

export const campaignContent = {
  badge: "Sinirli kampanya",
  title: "Ilk 15 gun Pro uyelik ozel kampanya ile acik.",
  detail:
    "Karar panelinin tum derinligini hizli test etmek isteyen ekipler icin kontrollu, premium bir gecis teklifi.",
  ctaLabel: "Kampanyayi Gor",
  ctaHref: "/pricing",
};

export const aboutPrinciples = [
  {
    title: "Neyi cozer?",
    text: "SellBoost, Trendyol urunlerindeki darbogazi skor olarak degil karar problemi olarak tanimlar.",
  },
  {
    title: "Nasil dusunur?",
    text: "Icerik, teslimat, fiyat, guven ve rakip sinyallerini birlikte degerlendirerek aksiyon onceligi kurar.",
  },
  {
    title: "Kimler icin?",
    text: "Markalar, e-ticaret ekipleri, danismanlar ve ajanslar icin hafif ama ciddi bir analiz urunudur.",
  },
];
