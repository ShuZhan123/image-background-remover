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
      .prepare("SELECT quota_free_used, quota_free_total, plan_type FROM users WHERE id = ?")
      .bind(userId)
      .first();

    if (!user) {
      return { allowed: true, planType: "free" };
    }

    // 付费套餐无限制
    if (user.plan_type !== "free") {
      return { allowed: true, planType: user.plan_type };
    }

    const used = user.quota_free_used || 0;
    const total = user.quota_free_total || 5;

    if (used >= total) {
      return { 
        allowed: false, 
        error: "免费配额已用完，请升级套餐后继续使用",
        planType: user.plan_type
      };
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
    // 记录历史
    await db
      .prepare(`
        INSERT INTO processing_history (user_id, original_name, file_size, status)
        VALUES (?, ?, ?, ?)
      `)
      .bind(userId, fileName, fileSize, status)
      .run();

    // 如果成功，增加配额计数
    if (status === "success") {
      await db
        .prepare(`
          UPDATE users 
          SET quota_free_used = quota_free_used + 1, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `)
        .bind(userId)
        .run();
    }
  } catch (e) {
    console.error("Failed to update quota/history:", e);
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

  // 检查用户信息和配额
  let maxSize = 10 * 1024 * 1024; // 默认10MB
  if (userId) {
    // 登录用户，检查用户计划
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
      error: `文件超过 ${maxMb}MB，${userId ? "当前套餐不支持更大文件" : "升级Pro支持更大文件"}`, 
      code: "FILE_TOO_LARGE" 
    }, { status: 400 });
  }

  // 未登录用户简单IP限流（每天3次）
  // 实际生产需要redis记录IP，这里简化处理依赖用户登录
  if (!userId) {
    // 简单处理：允许通过，但前端提示，真正严格限制需要后端存储
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
  
  // 处理成功，记录历史并增加配额
  if (userId) {
    await incrementQuotaAndRecordHistory(userId, fileName, image.size, "success");
  }

  return new NextResponse(resultBuffer, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": "inline",
    },
  });
}
