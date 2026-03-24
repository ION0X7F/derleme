import RoutePlaceholder from "../_ui/route-placeholder";

export default function AnalyzePage() {
  return (
    <RoutePlaceholder
      title="Yeni analiz"
      description="Analiz ekrani yeniden tasarlanacak. URL girisi bu gecici iskelette korunuyor."
    >
      <form className="placeholder-form">
        <label className="placeholder-label" htmlFor="product-url">
          Trendyol urun linki
        </label>
        <input
          id="product-url"
          name="url"
          type="url"
          className="placeholder-input"
          placeholder="https://www.trendyol.com/..."
        />
        <button type="button" className="placeholder-button">
          Analiz et
        </button>
      </form>
    </RoutePlaceholder>
  );
}
