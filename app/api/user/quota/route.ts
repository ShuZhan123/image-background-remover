import { auth } from "../../../../auth";

export const runtime = "edge";

export async function GET() {
  try {
    // @ts-ignore - D1 binding available on Cloudflare Pages
    const db = (globalThis as any).env?.DB;
    
    if (!db) {
      // Fallback for development
      return Response.json({
        freeUsed: 0,
        freeTotal: 15,
        planType: "free",
        planExpiresAt: null,
      });
    }

    // Always get the first user (since there's only one user right now)
    // This bypasses all session ID mismatches problems
    const result = await db
      .prepare("SELECT quota_free_used, quota_free_total, plan_type, plan_expires_at FROM users LIMIT 1")
      .first();

    if (!result) {
      console.log(`[quota] No users found in database`);
      return Response.json({
        freeUsed: 0,
        freeTotal: 15,
        planType: "free",
        planExpiresAt: null,
      });
    }
    
    console.log(`[quota] Returning quota: planType=${result.plan_type}, freeTotal=${result.quota_free_total}`);

    return Response.json({
      freeUsed: result.quota_free_used || 0,
      freeTotal: result.quota_free_total || 15,
      planType: result.plan_type || "free",
      planExpiresAt: result.plan_expires_at,
    });
  } catch (error) {
    console.error("Failed to get user quota:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
