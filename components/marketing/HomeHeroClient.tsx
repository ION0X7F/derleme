"use client";

import Link from "next/link";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import AnalyzeForm from "@/components/AnalyzeForm";
import { getAccessAwareDiagnosisText } from "@/lib/access-copy";
import { parseAnalysisSummary } from "@/lib/analysis-summary";
import type { AnalysisResult } from "@/types";

type TeaserResponse = {
  result?: AnalysisResult;
  report?: {
    id?: string;
  } | null;
  autoSaved?: boolean;
};

type PreviewMetric = {
  label: string;
  value: string;
  unit: string;
};

type PreviewBar = {
  label: string;
  width: number;
};

type PreviewAction = {
  number: string;
  label: string;
  width: number;
};

function clampScore(score: number | null | undefined) {
  if (typeof score !== "number" || Number.isNaN(score)) {
    return null;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function truncateText(text: string, limit = 150) {
  if (text.length <= limit) {
    return text;
  }

  return `${text.slice(0, limit).trimEnd()}...`;
}

function getLockedSections(result: AnalysisResult | null) {
  return result?.access?.lockedSections?.length ?? 0;
}

function getPreviewMetrics(teaser: AnalysisResult | null): PreviewMetric[] {
  if (!teaser) {
    return [
      { label: "Genel skor", value: "84", unit: "/100" },
      { label: "SEO", value: "78", unit: "/100" },
      { label: "Teklif baskısı", value: "3", unit: " sinyal" },
    ];
  }

  const overallScore = clampScore(teaser.overallScore);
  const seoScore = clampScore(teaser.seoScore);
  const offerPressure =
    teaser.extractedData?.other_sellers_count ?? teaser.priorityActions?.length ?? 0;

  return [
    {
      label: "Genel skor",
      value: overallScore !== null ? String(overallScore) : "--",
      unit: overallScore !== null ? "/100" : "",
    },
    {
      label: "SEO",
      value: seoScore !== null ? String(seoScore) : "--",
      unit: seoScore !== null ? "/100" : "",
    },
    {
      label: "Teklif baskısı",
      value: String(offerPressure),
      unit: " sinyal",
    },
  ];
}

function getPreviewBars(teaser: AnalysisResult | null): PreviewBar[] {
  if (!teaser) {
    return [
      { label: "Genel skor", width: 84 },
      { label: "SEO sinyali", width: 72 },
      { label: "Veri güveni", width: 66 },
    ];
  }

  return [
    {
      label: "Genel skor",
      width: clampScore(teaser.overallScore) ?? 42,
    },
    {
      label: "SEO sinyali",
      width: clampScore(teaser.seoScore) ?? 58,
    },
    {
      label: "Veri güveni",
      width: clampScore(teaser.dataCompletenessScore) ?? 68,
    },
  ];
}

function getPreviewActions(teaser: AnalysisResult | null): PreviewAction[] {
  if (!teaser || !teaser.priorityActions?.length) {
    return [
      {
        number: "1",
        label: "Vitrin anlatımını ilk bakışta daha ikna edici hale getir.",
        width: 84,
      },
      {
        number: "2",
        label: "Rakip teklif baskısını fiyat ve teslimat diliyle dengele.",
        width: 72,
      },
      {
        number: "3",
        label: "Yorum ve güven sinyallerini üst alanda daha görünür yap.",
        width: 60,
      },
    ];
  }

  return teaser.priorityActions.slice(0, 3).map((item, index) => ({
    number: String(index + 1),
    label: truncateText(item.title, 64),
    width: Math.max(42, 92 - index * 14),
  }));
}

export default function HomeHeroClient() {
  const router = useRouter();
  const { status } = useSession();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [teaser, setTeaser] = useState<AnalysisResult | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);

  const summarySections = parseAnalysisSummary(teaser?.summary);
  const isAuthenticated = status === "authenticated";
  const lockedCount = getLockedSections(teaser);
  const previewMetrics = getPreviewMetrics(teaser);
  const previewBars = getPreviewBars(teaser);
  const previewActions = getPreviewActions(teaser);
  const showPreview = loading || !!teaser;

  const diagnosisText = teaser
    ? truncateText(
        summarySections.criticalDiagnosis ||
          teaser.summary ||
          "Teaser raporu hazır. Tam karar panelinde daha derin içgörüler açılır."
      )
    : "Ürün linkini bırak. SellBoost fiyat, güven, içerik ve rakip sinyallerini tek bir satış teşhisine dönüştürsün.";

  const displayDiagnosisText = teaser
    ? truncateText(
        getAccessAwareDiagnosisText({
          plan: teaser.access?.plan,
          lockedSections: teaser.access?.lockedSections,
          dataCompletenessScore: teaser.dataCompletenessScore,
          coverageConfidence: teaser.coverage?.confidence ?? null,
          diagnosis: summarySections.criticalDiagnosis,
          summary: teaser.summary,
        }) || diagnosisText
      )
    : diagnosisText;

  async function handleAnalyze() {
    if (!url.trim()) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });

      const data = (await response.json()) as TeaserResponse & {
        message?: string;
        error?: string;
        detail?: string;
      };

      if (!response.ok) {
        setTeaser(null);
        setReportId(null);
        setError(data.detail || data.message || data.error || "Analiz başarısız.");
        return;
      }

      setTeaser(data.result ?? null);
      setReportId(data.report?.id ?? null);
    } catch {
      setError("Analiz sırasında bağlantı hatası oluştu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <section className="bright-hero">
        <div className="bright-hero__blur bright-hero__blur--left" aria-hidden />
        <div className="bright-hero__blur bright-hero__blur--right" aria-hidden />

        <div className="sb-container bright-hero__content">
          <div className="bright-hero__copy">
            <h1 className="bright-hero__title">
              Satışı yavaşlatan sinyalleri
              <span> ilk ekranda gör.</span>
            </h1>

            <p className="bright-hero__text">{displayDiagnosisText}</p>
          </div>

          <div className="bright-prompt">
            <div className="bright-prompt__chips">
              {[
                "Fiyat baskısını tara",
                "Güven sinyallerini oku",
                "İçerik darboğazını bul",
                "Rakip teklifleri karşılaştır",
              ].map((chip) => (
                <span key={chip} className="bright-chip">
                  {chip}
                </span>
              ))}
            </div>

            <AnalyzeForm
              url={url}
              loading={loading}
              onChange={setUrl}
              onSubmit={handleAnalyze}
              submitLabel="AI teşhisini başlat"
              placeholder="https://www.trendyol.com/... ürün linkini bırak ve ilk teşhisi al"
              showMarketingMeta={false}
            />

            {error && <div className="alert alert-error">{error}</div>}

            <div className="bright-prompt__footer">
              <p className="bright-prompt__hint">
                Fiyat, yorum, güven, görsel ve teklif baskısı aynı akışta okunur.
              </p>

              <div className="hero-actions" style={{ marginTop: 0 }}>
                <Link href="/how-it-works" className="btn btn-secondary">
                  Nasıl çalıştığını gör
                </Link>
                <Link href="/register" className="btn btn-primary">
                  Ücretsiz dene
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {showPreview ? (
        <section className="bright-preview" aria-live="polite">
        <div className="sb-container bright-preview__stack">
          <div className="bright-preview__frame">
            <div className="bright-preview__bar">
              <div className="bright-preview__dots" aria-hidden>
                <span />
                <span />
                <span />
              </div>
              <div className="bright-preview__bar-label">
                {loading
                  ? "AI ürün sayfasını okuyor"
                  : teaser
                    ? "Canlı teaser ön izlemesi"
                    : "İlk karar ekranı"}
              </div>
            </div>

            <div className="bright-preview__body">
              <div className="bright-preview__lead">
                <div className="bright-section-kicker">
                  {loading
                    ? "Analiz akışı"
                    : teaser
                      ? "İlk teşhis hazır"
                      : "Karar özeti"}
                </div>
                <h2 className="bright-preview__title">
                  {teaser
                    ? "İlk sonuçlar birkaç saniyede görünür"
                    : "Girilen link sonuç ekranını anında doldurur"}
                </h2>
                <p className="bright-preview__copy">
                  {loading
                    ? "SellBoost ürün verisini, rakip baskısını ve güven sinyallerini işleyip ilk satış teşhisini çıkarıyor."
                    : displayDiagnosisText}
                </p>
              </div>

              <div className="bright-metrics">
                {previewMetrics.map((metric) => (
                  <div key={metric.label} className="bright-metric">
                    <div className="bright-metric__label">{metric.label}</div>
                    <div className="bright-metric__value">
                      {metric.value}
                      {metric.unit ? <span>{metric.unit}</span> : null}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mock-analysis">
                <div className="mock-analysis__left">
                  <div className="mock-analysis__label">
                    {teaser ? "Karar sinyalleri" : "Satışı etkileyen alanlar"}
                  </div>

                  {previewBars.map((bar) => (
                    <div key={bar.label} className="landing-preview__summary">
                      <div className="preview-metric__label" style={{ marginBottom: 0 }}>
                        {bar.label}
                      </div>
                      <div className="mock-analysis__line" style={{ width: `${bar.width}%` }} />
                    </div>
                  ))}
                </div>

                <div className="mock-analysis__right">
                  <div className="mock-analysis__label">Öncelikli aksiyonlar</div>

                  {previewActions.map((action) => (
                    <div
                      key={`${action.number}-${action.label}`}
                      className="landing-preview__summary"
                    >
                      <div className="mock-action">
                        <span className="mock-action__num">{action.number}</span>
                        <div
                          className="mock-action__line"
                          style={{ width: `${action.width}%` }}
                        />
                      </div>
                      <p className="mock-action__copy">{action.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="hero-actions" style={{ marginTop: 0 }}>
                {teaser ? (
                  isAuthenticated && reportId ? (
                    <button
                      type="button"
                      className="btn btn-primary btn--lg"
                      onClick={() => router.push(`/report/${reportId}`)}
                    >
                      Tam raporu aç
                    </button>
                  ) : (
                    <Link href="/register" className="btn btn-primary btn--lg">
                      Tam AI analizi için kayıt ol
                    </Link>
                  )
                ) : (
                  <Link href="/register" className="btn btn-primary btn--lg">
                    Hesap aç ve raporlarını kaydet
                  </Link>
                )}
              </div>

              <p className="hero-note" style={{ margin: 0, textAlign: "center" }}>
                {teaser
                  ? lockedCount > 0
                    ? `${lockedCount} bölüm tam raporda açılır; rekabet katmanı ve detaylı aksiyon sırası hesapta görünür.`
                    : "Tam rapor, rapor kütüphanesi ve dışa aktarma akışıyla birlikte hazır."
                  : "Linki gönderdiğinde skorlar, teşhis ve önerilen hamleler bu alanda anında görünür."}
              </p>
            </div>
          </div>

          <div className="bright-showcase">
            {[
              {
                label: "Fiyat baskısı",
                value: teaser
                  ? `${teaser.extractedData?.other_sellers_count ?? 0} rakip`
                  : "4 rakip",
                title: teaser
                  ? "Teklif katmanı ilk karar alanlarından biri"
                  : "Rakip teklifleri senden daha görünür olabilir",
                detail: teaser
                  ? "Rakip sayısı ve fiyat konumu, kullanıcı kararını ilk saniyelerde etkiliyor."
                  : "Daha ucuz veya daha hızlı teslimatlı satıcılar dönüşümü aşağı çekebilir.",
              },
              {
                label: "Güven nabzı",
                value:
                  typeof teaser?.extractedData?.rating_value === "number"
                    ? `${teaser.extractedData.rating_value.toFixed(1)} / 5`
                    : "4.7 / 5",
                title: teaser
                  ? "Güven sinyalleri analizde ayrı bir katman olarak okunuyor"
                  : "Güven alanı güçlü ama yeterince öne çıkmıyor",
                detail: teaser
                  ? "Yorum puanı, yorum sayısı ve satıcı sinyalleri birlikte değerlendirilir."
                  : "Yorum puanı iyi olduğunda bunu başlık ve ilk ekranla desteklemek gerekir.",
              },
              {
                label: "İçerik açıklığı",
                value:
                  clampScore(teaser?.seoScore) !== null
                    ? `${clampScore(teaser?.seoScore) ?? 0} / 100`
                    : "87 / 100",
                title: teaser
                  ? "Başlık ve içerik netliği satış hızını doğrudan etkiler"
                  : "Başlık ve görsel dili dönüşüme daha yakın olabilir",
                detail: teaser
                  ? "İçerik sinyalleri güçlü oldukça fiyat baskısına rağmen dönüşüm korunabilir."
                  : "İçerik netleştikçe fiyat baskısına rağmen tıklama ve ikna gücü artar.",
              },
            ].map((item) => (
              <article key={item.label} className="bright-showcase__item">
                <div className="bright-showcase__label">{item.label}</div>
                <div className="bright-showcase__value">{item.value}</div>
                <h3 className="bright-showcase__title">{item.title}</h3>
                <p className="bright-showcase__detail">{item.detail}</p>
              </article>
            ))}
          </div>
        </div>
        </section>
      ) : null}
    </>
  );
}
