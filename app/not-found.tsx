import Link from "next/link";
import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";

export default function NotFound() {
  return (
    <div className="sb-shell">
      <SiteHeader />

      <main className="sb-page">
        <div className="sb-container">
          <section className="state-card state-card--empty">
            <div className="state-card__icon">404</div>
            <h1 className="state-card__title">Aradigin sayfa bulunamadi</h1>
            <p className="state-card__text">
              Link eski olabilir, tasinmis olabilir ya da artik mevcut olmayabilir.
              Ana panelden veya ana sayfadan devam edebilirsin.
            </p>
            <div className="inline-actions">
              <Link href="/" className="btn btn-primary">
                Ana Sayfa
              </Link>
              <Link href="/dashboard" className="btn btn-secondary">
                Dashboard
              </Link>
            </div>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
