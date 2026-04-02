import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

// Alipay webhook handler - 处理支付完成后更新用户套餐
export async function POST(req: NextRequest) {
  const body = await req.text();
  const params = new URLSearchParams(body);
  
  // TODO: 验证支付宝签名
  // TODO: 根据 trade_status 更新用户套餐
  
  console.log("Alipay webhook received:", Object.fromEntries(params));
  
  return NextResponse.json({ received: true });
}
