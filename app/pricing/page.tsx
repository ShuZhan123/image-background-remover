"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";

export default function PricingPage() {
  const { data: session } = useSession();

  const plans = [
    {
      name: "免费版",
      price: "0",
      period: "永久",
      description: "适合偶尔使用的个人用户",
      features: [
        "每月 15 次图片处理",
        "最大 10MB 文件",
        "PNG 透明背景下载",
        "基础处理质量",
      ],
      cta: session ? "当前套餐" : "免费开始用",
      highlighted: false,
      href: session ? "/dashboard" : "/auth/signin",
    },
    {
      name: "Pro 月付",
      price: "12",
      period: "/月",
      description: "适合经常使用的卖家/设计师",
      features: [
        "每月 200 次图片处理",
        "最大 25MB 文件",
        "PNG 透明背景下载",
        "高清输出质量",
        "无限处理历史记录",
        "支持批量处理（最多10张）",
        "可绑定自己的 API Key",
        "无广告",
      ],
      cta: "立即开通",
      highlighted: true,
      badge: "🔥 最受欢迎",
      href: "#checkout",
    },
    {
      name: "Pro 年付",
      price: "99",
      period: "/年",
      description: "适合重度用户，最划算",
      features: [
        "每年 2400 次图片处理（合计 200次/月）",
        "最大 25MB 文件",
        "PNG 透明背景下载",
        "高清输出质量",
        "无限处理历史记录",
        "支持批量处理（最多10张）",
        "可绑定自己的 API Key",
        "无广告",
      ],
      cta: "开通年付",
      highlighted: false,
      badge: "💥 省 45 元",
      href: "#checkout",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            简单透明的定价
          </h1>
          <p className="text-xl text-gray-600">
            先用后付，用多少付多少，没有隐藏消费
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl p-8 transition-shadow ${
                plan.highlighted
                  ? "bg-white shadow-xl ring-2 ring-blue-500 relative scale-105"
                  : "bg-white shadow-sm hover:shadow-md"
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                  {plan.badge}
                </div>
              )}
              <div className="mb-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {plan.name}
                </h3>
                <p className="text-gray-500 text-sm">{plan.description}</p>
              </div>
              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-gray-900">
                    ¥{plan.price}
                  </span>
                  <span className="text-gray-500">{plan.period}</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <span className="text-green-500">✓</span>
                    <span className="text-gray-700 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={plan.href}
                className={`block text-center px-6 py-3 rounded-xl font-medium transition-colors ${
                  plan.highlighted
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-gray-100 text-gray-900 hover:bg-gray-200"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* FAQ Preview */}
        <div className="mt-20 bg-white rounded-2xl p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            常见问题
          </h2>
          <div className="space-y-6 max-w-3xl mx-auto">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Q: 我的图片会被存储吗？
              </h3>
              <p className="text-gray-600">
                A: 图片仅在内存中处理，不会存储到服务器。登录用户会保留处理历史记录，但仅您本人可见。
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Q: 没用完的次数会累积到下个月吗？
              </h3>
              <p className="text-gray-600">
                A: 月付套餐次数当月有效，不会累积。年付套餐是总次数，有效期一年，你可以自由分配使用。
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Q: 可以退款吗？
              </h3>
              <p className="text-gray-600">
                A: 如果购买后无法正常使用，7天内可以联系我们全额退款。正常使用后不支持部分退款哦。
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Q: 支持什么支付方式？
              </h3>
              <p className="text-gray-600">
                A: 目前支持支付宝、微信支付，海外用户支持 PayPal。
              </p>
            </div>
          </div>
          <div className="mt-8 text-center">
            <Link
              href="/faq"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              查看完整 FAQ →
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-gray-500">
          <p>
            有任何问题？请联系我们 support@example.com
          </p>
        </div>
      </div>
    </div>
  );
}
