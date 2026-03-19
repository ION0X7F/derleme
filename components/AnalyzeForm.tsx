"use client";

type Props = {
  url: string;
  loading: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

export default function AnalyzeForm({
  url,
  loading,
  onChange,
  onSubmit,
}: Props) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading || !url.trim()) return;
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="sb-stack-12">
      <div className="surface-soft" style={{ padding: 14 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          <div>
            <div className="stat-card__label">Analiz girisi</div>
            <div className="card-heading" style={{ marginBottom: 0 }}>
              Trendyol urun linkini dogrudan karar paneline tasiyin
            </div>
          </div>

          <div className="pill-row">
            <span className="hero-point">Link / veri / muhakeme</span>
            <span className="hero-point">Dark / Light uyumlu</span>
          </div>
        </div>

        <div className="analyze-form-shell">
          <label className="form-label" style={{ gap: 0 }}>
            <span className="sr-only">Trendyol urun linki</span>
            <input
              type="url"
              value={url}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Trendyol urun linkini yapistir... ornek: https://www.trendyol.com/..."
              className="input"
              autoComplete="off"
              spellCheck={false}
              inputMode="url"
              style={{ minHeight: 62 }}
            />
          </label>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !url.trim()}
            style={{ minHeight: 62, minWidth: 168 }}
          >
            {loading ? (
              <>
                <span className="spinner" />
                <span>Analiz ediliyor</span>
              </>
            ) : (
              <>
                <span>Analiz Et</span>
                <span className="mono">{">"}</span>
              </>
            )}
          </button>
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
          Trendyol urun linkini girin. Sonuc ekraninda guven, fiyat, icerik,
          rakip ve karar sinyallerini tek panelde okuyun.
        </p>

        <div className="pill-row">
          <span className="hero-point">Hizli ilk okuma</span>
          <span className="hero-point">AI teshis</span>
          <span className="hero-point">Rapor akisi</span>
        </div>
      </div>
    </form>
  );
}
