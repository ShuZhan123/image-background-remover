import { auth } from "../../../../auth";

export const runtime = "edge";

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
      return Response.json({ items: [] });
    }

    const result = await db
      .prepare(`
        SELECT id, original_name, file_size, processed_at, status 
        FROM processing_history 
        WHERE user_id = ? 
        ORDER BY processed_at DESC 
        LIMIT 20
      `)
      .bind(userId)
      .all();

    const items = (result.results || []).map((row: any) => ({
      id: row.id,
      originalName: row.original_name,
      fileSize: row.file_size,
      processedAt: row.processed_at,
      status: row.status,
    }));

    return Response.json({ items });
  } catch (error) {
    console.error("Failed to get user history:", error);
    return Response.json({ items: [] });
  }
}
