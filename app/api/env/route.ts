import { NextResponse } from "next/server";

// 暴露需要客户端使用的环境变量
export async function GET() {
  return NextResponse.json({
    NEXT_PUBLIC_PAYPAL_CLIENT_ID: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "",
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || "",
  });
}
