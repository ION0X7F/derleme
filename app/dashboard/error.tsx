"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("DASHBOARD_ROUTE_ERROR", error);
  }, [error]);

  return (
    <div className="sb-page">
      <div className="sb-container">
        <section className="state-card state-card--error">
          <div className="state-card__icon">DB</div>
          <h1 className="state-card__title">Dashboard gecici olarak acilamadi</h1>
          <p className="state-card__text">
            Oturum acildi ancak dashboard verisi yuklenirken beklenmeyen bir sorun olustu.
            Guvenli sekilde tekrar deneyebilir ya da diger ekranlardan devam edebilirsin.
          </p>
          <div className="inline-actions">
            <button type="button" onClick={() => reset()} className="btn btn-primary">
              Tekrar Dene
            </button>
            <Link href="/analyze" className="btn btn-secondary">
              Yeni Analiz
            </Link>
            <Link href="/reports" className="btn btn-secondary">
              Raporlar
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
