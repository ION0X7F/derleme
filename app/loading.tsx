export default function RootLoading() {
  return (
    <div className="sb-shell">
      <main className="sb-page">
        <div className="sb-container">
          <div className="state-card state-card--loading">
            <div className="state-card__icon">
              <div className="spinner" />
            </div>
            <h1 className="state-card__title">SellBoost AI hazirlaniyor</h1>
            <p className="state-card__text">
              Premium analiz arayuzu yukleniyor. Kisa bir an icinde karar paneli
              hazir olacak.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
