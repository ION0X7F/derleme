import Link from "next/link";
import type { PricingCardPlan } from "@/lib/plans";

type Props = {
  plans: PricingCardPlan[];
  compact?: boolean;
};

export default function PricingCards({ plans, compact = false }: Props) {
  return (
    <div className={`pricing-grid${compact ? " pricing-grid--compact" : ""}`}>
      {plans.map((plan) => (
        <article
          key={plan.key}
          className={`surface pricing-card${plan.featured ? " is-featured" : ""}`}
          data-accent={plan.accent ?? "neutral"}
        >
          <div className="pricing-card__head">
            <div>
              <h3 className="pricing-card__name">{plan.name}</h3>
              <p className="pricing-card__subtitle">{plan.subtitle}</p>
            </div>
            {plan.badge && <div className="eyebrow">{plan.badge}</div>}
          </div>

          <div className="pricing-card__price-row">
            <p className="pricing-card__price">{plan.price}</p>
            <span className="pricing-card__billing">{plan.billing}</span>
          </div>

          <p className="pricing-card__copy">{plan.description}</p>

          <ul className="pricing-card__list">
            {plan.features.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>

          <Link
            href={plan.ctaHref}
            className={plan.featured ? "btn btn-primary" : "btn btn-secondary"}
          >
            {plan.ctaLabel}
          </Link>
        </article>
      ))}
    </div>
  );
}
