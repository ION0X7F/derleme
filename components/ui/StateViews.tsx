export function LoadingState({ message = "Yukleniyor..." }: { message?: string }) {
  return (
    <div className="state-card state-card--loading">
      <div className="state-card__icon">
        <div className="spinner" />
      </div>
      <h2 className="state-card__title">Icerik hazirlaniyor</h2>
      <p className="state-card__text">{message}</p>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="state-card state-card--error">
      <div className="state-card__icon">ERR</div>
      <h2 className="state-card__title">Bir sorun olustu</h2>
      <p className="state-card__text">{message}</p>
    </div>
  );
}

export function EmptyState({
  message = "Henuz kayitli rapor yok.",
}: {
  message?: string;
}) {
  return (
    <div className="state-card state-card--empty">
      <div className="state-card__icon">EMP</div>
      <h2 className="state-card__title">Bos gorunum</h2>
      <p className="state-card__text">{message}</p>
    </div>
  );
}
