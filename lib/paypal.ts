export const PAYPAL_PLANS = {
  "pro-monthly": {
    id: "pro-monthly",
    name: "Pro Monthly",
    price: "12.00",
    currency: "USD",
    interval: "MONTHLY",
    quota: 200,
  },
  "pro-yearly": {
    id: "pro-yearly",
    name: "Pro Yearly",
    price: "99.00", 
    currency: "USD",
    interval: "YEARLY",
    quota: 2400,
  }
} as const;

export type PayPalPlanId = keyof typeof PAYPAL_PLANS;
