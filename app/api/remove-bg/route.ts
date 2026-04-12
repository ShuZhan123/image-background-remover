import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../auth";

export const runtime = "edge";

const ERROR_MAP: Record<string, string> = {
  "file_too_large": "文件超过 10MB",
  "unsupported_format": "不支持的图片格式",
  "insufficient_credits": "API 额度已耗尽",
  "rate_limit": "请求过于频繁，请稍后重试",
};

// 检查用户配额
async function checkUserQuota(userId: number): Promise<{ allowed: boolean; error?: string; planType: string }> {
  // @ts-ignore - D1 binding
  const db = process.env.DB ? (globalThis as any).env?.DB : null;
  
  if (!db) {
    // 无数据库时允许继续（开发环境）
    return { allowed: true, planType: "free" };
  }

  try {
    const user = await db
      .prepare("SELECT quota_free_used, quota_free_total, quota_paid_used, quota_paid_total, plan_type FROM users WHERE id = ?")
      .bind(userId)
      .first();

    if (!user) {
      return { allowed: true, planType: "free" };
    }

    // 免费用户检查免费配额
    if (user.plan_type === "free") {
      const used = user.quota_free_used || 0;
      const total = user.quota_free_total || 5;

      if (used >= total) {
        return { 
          allowed: false, 
          error: "免费配额已用完，请升级套餐后继续使用",
          planType: user.plan_type
        };
      }
    } else {
      // 付费会员检查付费配额
      const used = user.quota_paid_used || 0;
      const total = user.quota_paid_total || 0;
      
      // 如果有配额总数（会员应该有配额），检查是否超限
      if (total > 0 && used >= total) {
        return { 
          allowed: false, 
          error: "本月会员配额已用完，请等待下月刷新或升级套餐",
          planType: user.plan_type
        };
      }
    }

    return { allowed: true, planType: user.plan_type };
  } catch (e) {
    console.error("Failed to check quota:", e);
    return { allowed: true, planType: "free" }; // 出错时放行
  }
}

// 增加配额使用并记录历史
async function incrementQuotaAndRecordHistory(
  userId: number,
  fileName: string,
  fileSize: number,
  status: "success" | "failed"
) {
  // @ts-ignore - D1 binding
  const db = process.env.DB ? (globalThis as any).env?.DB : null;
  
  if (!db) return;

  try {
    // 获取用户计划类型
    const user = await db
      .prepare("SELECT plan_type FROM users WHERE id = ?")
      .bind(userId)
      .first();
      
    // 记录历史
    await db
      .prepare(`
        INSERT INTO processing_history (user_id, original_name, file_size, status)
        VALUES (?, ?, ?, ?)
      `)
      .bind(userId, fileName, fileSize, status)
      .run();

    // 如果成功，增加对应配额计数
    if (status === "success" && user) {
      if (user.plan_type === "free") {
        await db
          .prepare(`
            UPDATE users 
            SET quota_free_used = quota_free_used + 1, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `)
          .bind(userId)
          .run();
      } else {
        await db
          .prepare(`
            UPDATE users 
            SET quota_paid_used = quota_paid_used + 1, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `)
          .bind(userId)
          .run();
      }
    }
  } catch (e) {
    console.error("Failed to update quota/history:", e);
  }
}

// 检查未登录游客配额（每天每个IP最多3次）
async function checkGuestQuota(ip: string): Promise<{ allowed: boolean; used: number }> {
  // @ts-ignore - D1 binding
  const db = (globalThis as any).env?.DB || (process.env as any).DB;
  
  if (!db) {
    // 无数据库时允许继续（开发环境）
    return { allowed: true, used: 0 };
  }

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  try {
    // 查询今天这个IP的使用记录，如果不存在则插入
    const existing = await db
      .prepare("SELECT usage_count FROM guest_access WHERE ip_address = ? AND access_date = ?")
      .bind(ip, today)
      .first();

    if (!existing) {
      // 今天第一次使用，插入新记录
      await db
        .prepare("INSERT INTO guest_access (ip_address, access_date, usage_count) VALUES (?, ?, 0)")
        .bind(ip, today)
        .run();
      return { allowed: true, used: 0 };
    }

    const used = existing.usage_count || 0;
    // 未登录用户每天最多免费3次
    if (used >= 3) {
      return { allowed: false, used };
    }

    return { allowed: true, used };
  } catch (e) {
    console.error("Failed to check guest quota:", e);
    return { allowed: true, used: 0 }; // 出错时放行
  }
}

// 增加未登录游客使用次数
async function incrementGuestUsage(ip: string) {
  // @ts-ignore - D1 binding
  const db = (globalThis as any).env?.DB || (process.env as any).DB;
  
  if (!db) return;

  const today = new Date().toISOString().split('T')[0];

  try {
    // UPSERT：如果存在则增加计数，不存在则插入
    await db
      .prepare(`
        INSERT INTO guest_access (ip_address, access_date, usage_count)
        VALUES (?, ?, 1)
        ON CONFLICT(ip_address, access_date)
        DO UPDATE SET usage_count = usage_count + 1, updated_at = CURRENT_TIMESTAMP
      `)
      .bind(ip, today)
      .run();
  } catch (e) {
    console.error("Failed to increment guest usage:", e);
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id ? Number(session.user.id) : null;

  const apiKey = process.env.REMOVE_BG_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "服务未配置，请联系管理员", code: "MISCONFIGURED" }, { status: 500 });
  }

  let formData: FormData;
  let fileName = "unknown";
  try {
    formData = await req.formData();
    const image = formData.get("image");
    if (image instanceof File) {
      fileName = image.name;
    }
  } catch {
    return NextResponse.json({ error: "请求格式错误", code: "BAD_REQUEST" }, { status: 400 });
  }

  const image = formData.get("image");
  if (!image || !(image instanceof Blob)) {
    return NextResponse.json({ error: "未收到图片文件", code: "BAD_REQUEST" }, { status: 400 });
  }

  // 获取客户端IP
  const clientIp = req.headers.get("x-forwarded-for") || 
                   req.headers.get("cf-connecting-ip") || 
                   "127.0.0.1";

  let maxSize = 10 * 1024 * 1024; // 默认10MB
  let isGuest = false;

  // 未登录用户检查每日IP配额
  if (!userId) {
    isGuest = true;
    const guestCheck = await checkGuestQuota(clientIp);
    if (!guestCheck.allowed) {
      return NextResponse.json({ 
        error: `未登录用户每天最多免费体验3次，你今天已使用${guestCheck.used}次，请登录后继续使用。如果还没有账号，请先注册登录。`,
        code: "GUEST_QUOTA_EXCEEDED"
      }, { status: 403 });
    }
  } else {
    // 已登录用户检查用户配额
    const quotaCheck = await checkUserQuota(userId);
    maxSize = quotaCheck.planType !== "free" ? 25 * 1024 * 1024 : 10 * 1024 * 1024;
    
    if (!quotaCheck.allowed) {
      await incrementQuotaAndRecordHistory(userId, fileName, image.size, "failed");
      return NextResponse.json({ error: quotaCheck.error, code: "QUOTA_EXCEEDED" }, { status: 403 });
    }
  }

  // 大小校验
  if (image.size > maxSize) {
    const maxMb = maxSize / (1024 * 1024);
    if (userId) {
      await incrementQuotaAndRecordHistory(userId, fileName, image.size, "failed");
    }
    return NextResponse.json({ 
      error: `文件超过 ${maxMb}MB，当前套餐不支持更大文件，升级Pro支持更大文件`, 
      code: "FILE_TOO_LARGE" 
    }, { status: 400 });
  }

  // 转发给 Remove.bg
  const upstream = new FormData();
  upstream.append("image_file", image);
  upstream.append("size", "auto");

  let res: Response;
  try {
    res = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: { "X-Api-Key": apiKey },
      body: upstream,
    });
  } catch {
    if (userId) {
      await incrementQuotaAndRecordHistory(userId, fileName, image.size, "failed");
    }
    return NextResponse.json({ error: "网络错误，请稍后重试", code: "NETWORK_ERROR" }, { status: 502 });
  }

  if (!res.ok) {
    let code = "UNKNOWN";
    let friendlyMsg = "处理失败，请稍后重试";
    try {
      const data = await res.json();
      const errKey = data?.errors?.[0]?.code?.toLowerCase() ?? "";
      code = errKey.toUpperCase();
      friendlyMsg = ERROR_MAP[errKey] ?? data?.errors?.[0]?.title ?? "处理失败，请稍后重试";
    } catch {}
    if (userId) {
      await incrementQuotaAndRecordHistory(userId, fileName, image.size, "failed");
    }
    return NextResponse.json({ error: friendlyMsg, code }, { status: res.status });
  }

  const resultBuffer = await res.arrayBuffer();
  
  // 处理成功，计数
  if (userId) {
    await incrementQuotaAndRecordHistory(userId, fileName, image.size, "success");
  } else {
    // 未登录用户处理成功，增加计数
    await incrementGuestUsage(clientIp);
  }

  return new NextResponse(resultBuffer, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": "inline",
    },
  });
}
