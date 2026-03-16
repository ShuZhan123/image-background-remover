import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const ERROR_MAP: Record<string, string> = {
  "file_too_large": "文件超过 10MB",
  "unsupported_format": "不支持的图片格式",
  "insufficient_credits": "API 额度已耗尽",
  "rate_limit": "请求过于频繁，请稍后重试",
};

export async function POST(req: NextRequest) {
  const apiKey = process.env.REMOVE_BG_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "服务未配置，请联系管理员", code: "MISCONFIGURED" }, { status: 500 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "请求格式错误", code: "BAD_REQUEST" }, { status: 400 });
  }

  const image = formData.get("image");
  if (!image || !(image instanceof Blob)) {
    return NextResponse.json({ error: "未收到图片文件", code: "BAD_REQUEST" }, { status: 400 });
  }

  // 大小校验
  if (image.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "文件超过 10MB", code: "FILE_TOO_LARGE" }, { status: 400 });
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
    return NextResponse.json({ error: "网络错误，请稍后重试", code: "NETWORK_ERROR" }, { status: 502 });
  }

  if (!res.ok) {
    let code = "UNKNOWN";
    try {
      const data = await res.json();
      const errKey = data?.errors?.[0]?.code?.toLowerCase() ?? "";
      code = errKey.toUpperCase();
      const friendlyMsg = ERROR_MAP[errKey] ?? data?.errors?.[0]?.title ?? "处理失败，请稍后重试";
      return NextResponse.json({ error: friendlyMsg, code }, { status: res.status });
    } catch {
      return NextResponse.json({ error: "处理失败，请稍后重试", code }, { status: res.status });
    }
  }

  const resultBuffer = await res.arrayBuffer();
  return new NextResponse(resultBuffer, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": "inline",
    },
  });
}
