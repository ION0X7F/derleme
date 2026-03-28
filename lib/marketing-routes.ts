export const MARKETING_ROUTES = {
  home: "/",
  features: "/features",
  pricing: "/pricing",
  login: "/login",
  register: "/register",
  report: "/report-demo",
} as const;

export type MarketingView = keyof typeof MARKETING_ROUTES;

export function getMarketingRoute(view: MarketingView) {
  return MARKETING_ROUTES[view];
}
