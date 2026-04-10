import { NextRequest, NextResponse } from "next/server";
import { PAYPAL_PLANS, PayPalPlanId } from "@/lib/paypal";
import { auth } from "@/auth";
import { D1Database } from "@cloudflare/workers-types";

export const runtime = "edge";

/**
 * Create PayPal subscription
 * POST /api/paypal/create-subscription
 * Body: { planId: "pro-monthly" | "pro-yearly" }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { planId } = await req.json() as { planId: PayPalPlanId };
    const plan = PAYPAL_PLANS[planId];
    
    if (!plan) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    // Get the actual INTEGER userId from database by email
    const db = (globalThis as any).env?.DB || (process.env as any).DB;
    if (!db) {
      console.error("DB binding not found");
      return NextResponse.json({ error: "DB not found" }, { status: 500 });
    }
    
    const user = await db.prepare(`SELECT id FROM users WHERE email = ?`)
      .bind(session.user.email)
      .first();
    
    if (!user) {
      console.error(`User not found for email: ${session.user.email}`);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    const userId = user.id; // This is the actual INTEGER userId from database

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    // For sandbox, we use direct fetch to PayPal API
    const isSandbox = process.env.PAYPAL_ENVIRONMENT !== "live";
    const apiBaseUrl = isSandbox ? "https://api.sandbox.paypal.com" : "https://api.paypal.com";
    const authString = Buffer.from(
      `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
    ).toString('base64');

    // 先尝试查找已存在的同名 Product，如果找不到再创建
    let productId: string;
    const listProductsRes = await fetch(`${apiBaseUrl}/v1/catalogs/products?page_size=10`, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${authString}`,
      },
    });

    if (listProductsRes.ok) {
      const products = await listProductsRes.json();
      const existingProduct = products.products?.find((p: any) => p.name === "Image Background Remover Pro");
      if (existingProduct) {
        productId = existingProduct.id;
        console.log("Using existing product:", productId);
      } else {
        // Create product
        const productRes = await fetch(`${apiBaseUrl}/v1/catalogs/products`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Basic ${authString}`,
          },
          body: JSON.stringify({
            name: "Image Background Remover Pro",
            description: "Pro subscription for Image Background Remover",
            type: "SERVICE",
            category: "SOFTWARE"
          })
        });

        if (!productRes.ok) {
          const error = await productRes.text();
          console.error("Failed to create product:", error);
          return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
        }

        const product = await productRes.json();
        productId = product.id;
        console.log("Created new product:", productId);
      }
    } else {
      // Create product if list fails
      const productRes = await fetch(`${apiBaseUrl}/v1/catalogs/products`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${authString}`,
        },
        body: JSON.stringify({
          name: "Image Background Remover Pro",
          description: "Pro subscription for Image Background Remover",
          type: "SERVICE",
          category: "SOFTWARE"
        })
      });

      if (!productRes.ok) {
        const error = await productRes.text();
        console.error("Failed to create product:", error);
        return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
      }

      const product = await productRes.json();
      productId = product.id;
      console.log("Created new product:", productId);
    }

    // 查找已存在的同名 Plan
    let billingPlanId: string;
    const listPlansRes = await fetch(`${apiBaseUrl}/v1/billing/plans?page_size=10`, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${authString}`,
      },
    });

    if (listPlansRes.ok) {
      const plans = await listPlansRes.json();
      const existingPlan = plans.plans?.find((p: any) => p.name === plan.name);
      if (existingPlan && existingPlan.status === "ACTIVE") {
        billingPlanId = existingPlan.id;
        console.log("Using existing billing plan:", billingPlanId);
      } else {
        // Create billing plan
        const billingRes = await fetch(`${apiBaseUrl}/v1/billing/plans`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Basic ${authString}`,
          },
          body: JSON.stringify({
            product_id: productId,
            name: plan.name,
            description: `${plan.quota} processing credits per ${plan.interval.toLowerCase()}`,
            status: "ACTIVE",
            billing_cycles: [
              {
                frequency: {
                  interval_unit: plan.paypalInterval,
                  interval_count: 1
                },
                tenure_type: "REGULAR",
                sequence: 1,
                total_cycles: 0,
                pricing_scheme: {
                  fixed_price: {
                    value: plan.price,
                    currency_code: plan.currency
                  }
                }
              }
            ],
            payment_preferences: {
              auto_bill_outstanding: true,
              setup_fee_failure_action: "CONTINUE",
              payment_failure_threshold: 3
            }
          })
        });

        if (!billingRes.ok) {
          const error = await billingRes.text();
          console.error("Failed to create billing plan:", error);
          return NextResponse.json({ error: `Failed to create billing plan: ${error}` }, { status: 500 });
        }

        const billingPlan = await billingRes.json();
        billingPlanId = billingPlan.id;
        console.log("Created new billing plan:", billingPlanId);
      }
    } else {
      // Create plan if list fails
      const billingRes = await fetch(`${apiBaseUrl}/v1/billing/plans`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${authString}`,
        },
        body: JSON.stringify({
          product_id: productId,
          name: plan.name,
          description: `${plan.quota} processing credits per ${plan.interval.toLowerCase()}`,
          status: "ACTIVE",
          billing_cycles: [
            {
              frequency: {
                interval_unit: plan.paypalInterval,
                interval_count: 1
              },
              tenure_type: "REGULAR",
              sequence: 1,
              total_cycles: 0,
              pricing_scheme: {
                fixed_price: {
                  value: plan.price,
                  currency_code: plan.currency
                }
              }
            }
          ],
          payment_preferences: {
            auto_bill_outstanding: true,
            setup_fee_failure_action: "CONTINUE",
            payment_failure_threshold: 3
          }
        })
      });

      if (!billingRes.ok) {
        const error = await billingRes.text();
        console.error("Failed to create billing plan:", error);
        return NextResponse.json({ error: "Failed to create billing plan" }, { status: 500 });
      }

      const billingPlan = await billingRes.json();
      billingPlanId = billingPlan.id;
      console.log("Created new billing plan:", billingPlanId);
    }

    // Create subscription
    const subscriptionRes = await fetch(`${apiBaseUrl}/v1/billing/subscriptions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${authString}`,
      },
      body: JSON.stringify({
        plan_id: billingPlanId,
        subscriber: {
          email_address: session.user.email
        },
        application_context: {
          return_url: `${baseUrl}/dashboard?subscription=success`,
          cancel_url: `${baseUrl}/pricing?subscription=canceled`,
          brand_name: "Image Background Remover",
          landing_page: "LOGIN",
          shipping_preference: "NO_SHIPPING",
          user_action: "continue"
        },
        custom_id: JSON.stringify({
          userId: userId,
          planType: planId
        })
      })
    });

    if (!subscriptionRes.ok) {
      const error = await subscriptionRes.text();
      console.error("Failed to create subscription:", error);
      return NextResponse.json({ error: `Failed to create subscription: ${error}` }, { status: 500 });
    }

    const subscription = await subscriptionRes.json();

    if (!subscription.id) {
      console.error("Failed to create subscription:", subscription);
      return NextResponse.json({ error: "Failed to create subscription" }, { status: 500 });
    }

    return NextResponse.json({
      subscriptionId: subscription.id,
      approveUrl: subscription.links.find((link: any) => link.rel === "approve")?.href
    });

  } catch (error) {
    console.error("Error creating PayPal subscription:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
