"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

type UserQuota = {
  freeUsed: number;
  freeTotal: number;
  planType: "free" | "pro" | "premium";
  planExpiresAt: string | null;
};

type HistoryItem = {
  id: number;
  originalName: string;
  fileSize: number;
  processedAt: string;
  status: "success" | "failed";
};

export default function DashboardPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const [quota, setQuota] = useState<UserQuota | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionStatus === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }

    if (sessionStatus === "authenticated") {
      // 检查 URL 中是否有 subscription=success 参数，如果有则主动检查订阅状态
      const hasSubscriptionSuccess = typeof window !== 'undefined' && 
        new URLSearchParams(window.location.search).has('subscription');
      
      const loadQuota = () => {
        fetch("/api/user/quota")
          .then(res => res.json())
          .then(data => {
            setQuota(data);
            setLoading(false);
          })
          .catch(err => {
            console.error("Failed to fetch quota:", err);
            setLoading(false);
          });
      };

      if (hasSubscriptionSuccess) {
        // 如果刚从PayPal返回，主动调用检查并激活订阅
        fetch("/api/paypal/check-subscription")
          .then(res => res.json())
          .then(() => {
            loadQuota();
            // 清除URL参数，避免刷新重复触发
            if (window.history.replaceState) {
              window.history.replaceState({}, document.title, window.location.pathname);
            }
          })
          .catch(err => {
            console.error("Failed to check subscription:", err);
            loadQuota();
          });
      } else {
        loadQuota();
      }

      fetch("/api/user/history")
        .then(res => res.json())
        .then(data => {
          setHistory(data.items || []);
        })
        .catch(err => console.error("Failed to fetch history:", err));
    }
  }, [sessionStatus, router, session]);

  if (sessionStatus === "loading" || loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (!session?.user) {
    return null;
  }

  const remaining = quota ? quota.freeTotal - quota.freeUsed : 0;
  const progressPercent = quota ? (quota.freeUsed / quota.freeTotal) * 100 : 0;

  const planNames = {
    free: "免费版",
    pro: "专业版",
    premium: "旗舰版",
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("zh-CN");
  };

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">个人中心</h1>
            <p className="text-gray-500 mt-1">欢迎回来，{session.user.name}</p>
          </div>
          <Link
            href="/"
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            ← 返回处理
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* 用户信息卡片 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-sm font-medium text-gray-500 mb-4">账户信息</h2>
            <div className="flex items-center gap-4 mb-4">
              {session.user.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={session.user.image}
                  alt={session.user.name || ""}
                  className="w-16 h-16 rounded-full"
                />
              )}
              <div>
                <p className="font-medium text-gray-900">{session.user.name}</p>
                <p className="text-sm text-gray-500">{session.user.email}</p>
              </div>
            </div>
            <div className="pt-4 border-t border-gray-100">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">当前套餐</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  quota?.planType === "free"
                    ? "bg-gray-100 text-gray-600"
                    : "bg-green-100 text-green-700"
                }`}>
                  {planNames[quota?.planType || "free"]}
                </span>
              </div>
              {quota?.planExpiresAt && (
                <div className="flex justify-between items-center mt-2">
                  <span className="text-sm text-gray-500">到期时间</span>
                  <span className="text-sm text-gray-900">
                    {new Date(quota.planExpiresAt).toLocaleDateString("zh-CN")}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 配额使用卡片 */}
          <div className="bg-white rounded-xl shadow-sm p-6 md:col-span-2">
            <h2 className="text-sm font-medium text-gray-500 mb-4">本月处理配额</h2>
            <div className="mb-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">
                  已使用 {quota?.freeUsed || 0} / {quota?.freeTotal || 5}
                </span>
                <span className="text-sm font-medium text-gray-900">
                  剩余 {remaining} 次
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    progressPercent > 90
                      ? "bg-red-500"
                      : progressPercent > 70
                      ? "bg-yellow-500"
                      : "bg-blue-500"
                  }`}
                  style={{ width: `${Math.min(progressPercent, 100)}%` }}
                />
              </div>
            </div>
            {remaining <= 0 && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  免费配额已用完，请升级套餐继续使用。
                </p>
                <Link href="/pricing" className="inline-block mt-2 px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm hover:bg-yellow-700 transition-colors">
                  立即升级
                </Link>
              </div>
            )}
            {quota && quota.planType !== "free" && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">
                  您当前使用的是 {planNames[quota.planType]}，享有无限次处理。
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 处理历史 */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
          <h2 className="text-sm font-medium text-gray-500 mb-4">处理历史</h2>
          {history.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p>暂无处理记录</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-2">文件名</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-2">大小</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-2">状态</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase py-3 px-2">时间</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item) => (
                    <tr key={item.id} className="border-b border-gray-50">
                      <td className="py-3 px-2 text-sm text-gray-900">{item.originalName}</td>
                      <td className="py-3 px-2 text-sm text-gray-500">{formatFileSize(item.fileSize)}</td>
                      <td className="py-3 px-2">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          item.status === "success"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}>
                          {item.status === "success" ? "成功" : "失败"}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-sm text-gray-500">{formatDate(item.processedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 订阅/升级卡片 */}
        {quota?.planType === "free" && (
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold mb-1">升级到专业版</h2>
                <p className="text-blue-100">每月 200次处理、更高文件限额、批量处理</p>
              </div>
              <Link
                href="/pricing"
                className="inline-block text-center px-6 py-3 bg-white text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors"
              >
                立即升级 - ¥12/月
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
