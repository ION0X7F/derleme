"use client";

type AnalyzeFormVariant = "marketing" | "workspace";

type Props = {
  url: string;
  loading: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  variant?: AnalyzeFormVariant;
  submitLabel?: string;
  placeholder?: string;
  showMarketingMeta?: boolean;
};

export default function AnalyzeForm({
  url,
  loading,
  onChange,
  onSubmit,
  variant = "marketing",
  submitLabel,
  placeholder,
  showMarketingMeta = true,
}: Props) {
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading || !url.trim()) return;
    onSubmit();
  };

  const isWorkspace = variant === "workspace";
  const pills = isWorkspace
    ? ["URL > extractor > AI", "Karar izi hazır", "Kayıtlı rapor akışı"]
    : ["Anında satış teşhisi", "Tek linkle AI yorum", "Tam rapora hızlı geçiş"];
  const buttonLabel = submitLabel || (isWorkspace ? "Analiz Et" : "Analizi Başlat");

  const workspaceNotes = [
    {
      label: "Okunan katman",
      text: "Fiyat, teslimat, yorum, görsel ve güven sinyalleri tek akış olarak toplanır.",
    },
    {
      label: "Nihai çıktı",
      text: "Kritik teşhis, öncelikli aksiyonlar ve karar izi aynı rapora taşınır.",
    },
  ];

  const loadingNotice = loading ? (
    <div className="analyze-form__loading">
      <span className="spinner" />
      <div className="analyze-form__loading-copy">
        <div className="analyze-form__loading-title">AI analiz ediyor</div>
        <div className="analyze-form__loading-text">
          Ürün sayfası, fiyat, güven ve rakip sinyalleri okunuyor...
        </div>
      </div>
    </div>
  ) : null;

  if (!isWorkspace) {
    return (
      <form onSubmit={handleSubmit} className="analyze-form analyze-form--marketing">
        <div className="analyze-form__panel analyze-form__panel--marketing">
          <label className="form-label analyze-form__field" style={{ gap: 10 }}>
            <span className="analyze-form__label">Ürün Linki</span>

            <div className="analyze-form__input-shell analyze-form__input-shell--marketing">
              <input
                type="url"
                value={url}
                onChange={(event) => onChange(event.target.value)}
                placeholder={
                  placeholder ||
                  "https://www.trendyol.com/... ürün linkini buraya yapıştır"
                }
                className="input analyze-form__input"
                autoComplete="off"
                spellCheck={false}
                inputMode="url"
              />

              <button
                type="submit"
                className="btn btn-primary analyze-form__submit"
                disabled={loading || !url.trim()}
              >
                {loading ? (
                  <>
                    <span className="spinner" />
                    <span>Analiz hazırlanıyor</span>
                  </>
                ) : (
                  <span>{buttonLabel}</span>
                )}
              </button>
            </div>
          </label>

          {loadingNotice}

          {showMarketingMeta && (
            <div className="analyze-form__marketing-meta">
              <p className="hero-note" style={{ margin: 0 }}>
                Linki yapıştır, ürününün satış potansiyelini büyütecek içgörüler
                birkaç saniyede gelsin.
              </p>

              <div className="pill-row">
                {pills.map((pill) => (
                  <span key={pill} className="hero-point">
                    {pill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </form>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="analyze-form sb-stack-12 analyze-form--workspace"
    >
      <div className="surface-soft analyze-form__panel">
        <div className="analyze-form__header">
          <div>
            <div className="stat-card__label">Analiz komutu</div>
            <div className="card-heading" style={{ marginBottom: 0 }}>
              Trendyol ürün linkini yapıştır ve raporu karar paneline taşı
            </div>
            <p className="analyze-form__subtitle">
              Bu giriş, benchmark farkı ile AI teşhisini aynı akışta tetikler ve
              kayıtlı rapora giden yolu hazırlar.
            </p>
          </div>

          <div className="pill-row">
            {pills.map((pill) => (
              <span key={pill} className="hero-point">
                {pill}
              </span>
            ))}
          </div>
        </div>

        <div className="analyze-form__input-shell analyze-form__input-shell--workspace">
          <div className="analyze-form__prefix">
            <span className="stat-card__label">Girilen</span>
            <span className="mono">URL</span>
          </div>

          <label className="form-label" style={{ gap: 0 }}>
            <span className="sr-only">Trendyol ürün linki</span>
            <input
              type="url"
              value={url}
              onChange={(event) => onChange(event.target.value)}
              placeholder="Trendyol ürün linkini yapıştır... örnek: https://www.trendyol.com/..."
              className="input analyze-form__input"
              autoComplete="off"
              spellCheck={false}
              inputMode="url"
            />
          </label>

          <button
            type="submit"
            className="btn btn-primary analyze-form__submit"
            disabled={loading || !url.trim()}
          >
            {loading ? (
              <>
                <span className="spinner" />
                <span>Analiz hazırlanıyor</span>
              </>
            ) : (
              <>
                <span>{buttonLabel}</span>
                <span className="mono">{">"}</span>
              </>
            )}
          </button>
        </div>

        {loadingNotice}

        <div className="analyze-form__workspace-notes">
          {workspaceNotes.map((item) => (
            <article key={item.label} className="analyze-form__workspace-note">
              <div className="stat-card__label">{item.label}</div>
              <p className="card-copy">{item.text}</p>
            </article>
          ))}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <p className="hero-note" style={{ margin: 0 }}>
          Trendyol ürün linkini gir. Sonuç ekranında güven, fiyat, içerik, rakip ve
          karar sinyallerini tek panelde oku.
        </p>

        <div className="pill-row">
          <span className="hero-point">Hızlı ilk okuma</span>
          <span className="hero-point">AI teşhis</span>
          <span className="hero-point">Rapor akışı</span>
        </div>
      </div>
    </form>
  );
}
