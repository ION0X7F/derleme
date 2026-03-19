"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html>
      <body className="sb-body">
        <div className="sb-shell">
          <main className="sb-page">
            <div className="sb-container sb-stack-20">
              <div className="surface app-card">
                <div className="brand" aria-label="SellBoost AI">
                  <span className="brand__mark">SB</span>
                  <span className="brand__copy">
                    <span className="brand__title">
                      Sell<strong>Boost</strong> AI
                    </span>
                    <span className="brand__subtitle">Kesintiye dayanikli arayuz yuzeyi</span>
                  </span>
                </div>
              </div>

              <section className="state-card state-card--error">
                <div className="state-card__icon">ERR</div>
                <h1 className="state-card__title">Beklenmeyen bir sorun olustu</h1>
                <p className="state-card__text">
                  Arayuz beklenmedik bir hata aldi. Sayfayi yeniden deneyebilir ya da
                  guvenli bir noktadan devam edebilirsin.
                </p>
                <div className="inline-actions">
                  <button type="button" onClick={() => reset()} className="btn btn-primary">
                    Tekrar Dene
                  </button>
                  <Link href="/" className="btn btn-secondary">
                    Ana Sayfa
                  </Link>
                </div>
              </section>
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
