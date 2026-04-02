import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

// PayPal webhook handler - 处理订阅支付完成后更新用户套餐
export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("paypal-transmission-sig") || "";
  const transmissionId = req.headers.get("paypal-transmission-id") || "";
  const timestamp = req.headers.get("paypal-transmission-time") || "";
  
  // TODO: 验证 webhook 签名
  // TODO: 根据订单类型更新用户套餐信息到 D1 数据库
  
  console.log("PayPal webhook received:", body);
  
  return NextResponse.json({ received: true });
}
