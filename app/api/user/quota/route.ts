import { auth } from "../../../../auth";

export async function GET() {
  const session = await auth();
  
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(session.user.id);
  
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

    const result = await db
      .prepare("SELECT quota_free_used, quota_free_total, plan_type, plan_expires_at FROM users WHERE id = ?")
      .bind(userId)
      .first();

    if (!result) {
      return Response.json({
        freeUsed: 0,
        freeTotal: 15,
        planType: "free",
        planExpiresAt: null,
      });
    }

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
