// 你需要在 PayPal 后台提前创建好订阅计划，然后把 plan id 填在这里
// Sandbox 环境填写 sandbox plan id，Live 环境填写 live plan id
export const PAYPAL_PLAN_IDS = {
  "pro-monthly": process.env.PAYPAL_PLAN_ID_PRO_MONTHLY || "",
  "pro-yearly": process.env.PAYPAL_PLAN_ID_PRO_YEARLY || "",
} as const;

export type PayPalPlanId = keyof typeof PAYPAL_PLAN_IDS;

// PayPal API uses interval_unit: "DAY", "WEEK", "MONTH", "YEAR"
export const PAYPAL_PLANS = {
  "pro-monthly": {
    name: "Pro Monthly",
    price: "12.00",
    currency: "USD",
    interval: "MONTHLY",
    paypalInterval: "MONTH" as const,
    quota: 200,
  },
  "pro-yearly": {
    name: "Pro Yearly",
    price: "99.00", 
    currency: "USD",
    interval: "YEARLY",
    paypalInterval: "YEAR" as const,
    quota: 2400,
  }
} as const;
