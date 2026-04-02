"use client";

import { useState, useCallback, useEffect } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import Link from "next/link";

type Status = "idle" | "processing" | "done" | "error";
type UserQuota = {
  freeUsed: number;
  freeTotal: number;
  planType: "free" | "pro" | "premium";
  planExpiresAt: string | null;
};

export default function Home() {
  const { data: session, status: sessionStatus } = useSession();
  const [processingStatus, setProcessingStatus] = useState<Status>("idle");
  const [originalUrl, setOriginalUrl] = useState<string>("");
  const [resultUrl, setResultUrl] = useState<string>("");
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [originalName, setOriginalName] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [dragging, setDragging] = useState(false);
  const [quota, setQuota] = useState<UserQuota | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(false);

  // Fetch quota when user is authenticated
  useEffect(() => {
    if (sessionStatus === "authenticated") {
      setQuotaLoading(true);
      fetch("/api/user/quota")
        .then(res => res.json())
        .then(data => {
          setQuota(data);
          setQuotaLoading(false);
        })
        .catch(() => setQuotaLoading(false));
    } else {
      // For unauthenticated users, we check quota by IP on backend
      setQuota(null);
    }
  }, [sessionStatus]);

  const getRemainingQuota = () => {
    if (!quota) return null;
    return quota.freeTotal - quota.freeUsed;
  };

  const remaining = getRemainingQuota();

  const checkQuota = useCallback(async (): Promise<boolean> => {
    // If user is logged in, check from cached quota
    if (session?.user && quota) {
      return getRemainingQuota() > 0;
    }
    // For unauthenticated, we'll let backend check
    return true;
  }, [session, quota]);

  const processFile = useCallback(async (file: File) => {
    // 校验格式
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setErrorMsg("不支持的格式，请上传 JPG / PNG / WebP");
      setProcessingStatus("error");
      return;
    }

    // Check max file size based on plan
    const maxSize = quota?.planType !== "free" ? 25 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      const maxMb = maxSize / (1024 * 1024);
      setErrorMsg(`文件超过 ${maxMb}MB，${quota?.planType === "free" ? "升级Pro支持更大文件" : "请压缩后重试"}`);
      setProcessingStatus("error");
      return;
    }

    // Check quota
    const hasQuota = await checkQuota();
    if (!hasQuota) {
      if (session?.user) {
        setErrorMsg("本月免费配额已用完，请升级Pro继续使用");
      } else {
        setErrorMsg("今日免费配额已用完，请登录获取更多免费次数，或升级Pro");
      }
      setProcessingStatus("error");
      return;
    }

    setOriginalName(file.name);
    setOriginalUrl(URL.createObjectURL(file));
    setProcessingStatus("processing");

    try {
      const form = new FormData();
      form.append("image", file);
      form.append("fileName", file.name);
      form.append("fileSize", file.size.toString());

      const res = await fetch("/api/remove-bg", {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(30000),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.code === "QUOTA_EXCEEDED") {
          if (session?.user) {
            setErrorMsg("本月配额已用完，请升级Pro继续使用");
          } else {
            setErrorMsg("今日配额已用完，请登录获取更多次数");
          }
        } else {
          throw new Error(data.error || "处理失败，请稍后重试");
        }
        setProcessingStatus("error");
        return;
      }

      const blob = await res.blob();
      setResultBlob(blob);
      setResultUrl(URL.createObjectURL(blob));
      setProcessingStatus("done");

      // Refresh quota after successful processing
      if (sessionStatus === "authenticated") {
        fetch("/api/user/quota")
          .then(res => res.json())
          .then(data => setQuota(data))
          .catch(() => {});
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "未知错误";
      setErrorMsg(msg.includes("timeout") ? "处理超时（30s），请重试" : msg);
      setProcessingStatus("error");
    }
  }, [checkQuota, quota, sessionStatus]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleDownload = () => {
    if (!resultBlob) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = originalName.replace(/\.[^.]+$/, "") + "_removed.png";
    a.click();
  };

  const handleReset = () => {
    setProcessingStatus("idle");
    setOriginalUrl("");
    setResultUrl("");
    setResultBlob(null);
    setOriginalName("");
    setErrorMsg("");
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12 relative">
      {/* 右上角用户信息/登录按钮 */}
      {sessionStatus === "authenticated" && session?.user ? (
        <div className="absolute top-4 right-4 flex items-center gap-3 bg-white rounded-xl p-3 shadow-sm">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 hover:bg-gray-50 rounded-lg transition-colors p-1"
          >
            <div className="hidden sm:block">
              <p className="font-medium text-gray-900 text-sm">{session.user.name}</p>
              <p className="text-xs text-gray-500">个人中心</p>
            </div>
            {session.user.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={session.user.image}
                alt={session.user.name || ""}
                className="w-8 h-8 rounded-full"
              />
            )}
          </Link>
          <div className="h-8 w-px bg-gray-200" />
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            退出
          </button>
        </div>
      ) : sessionStatus === "unauthenticated" ? (
        <div className="absolute top-4 right-4">
          <Link
            href="/auth/signin"
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            Google 登录
          </Link>
        </div>
      ) : null}

      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">
          🖼️ Background Remover
        </h1>
        <p className="text-gray-500 text-lg">
          一键去除图片背景，免费、快速
          {sessionStatus === "authenticated" ? "" : "无需注册"}
        </p>
        {/* 显示剩余配额 */}
        {sessionStatus === "authenticated" && quota && remaining !== null && (
          <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full">
            <span className="text-sm text-gray-600">
              本月剩余 <span className="font-semibold text-gray-900">{remaining}</span> 次
            </span>
            {quota.planType === "free" && (
              <Link href="/pricing" className="text-xs text-blue-600 hover:underline font-medium">
                升级Pro →
              </Link>
            )}
          </div>
        )}
        {!session && (
          <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full">
            <span className="text-sm text-gray-600">
              未登录每日限3次 · <Link href="/auth/signin" className="text-blue-600 hover:underline">登录送每月15次</Link>
            </span>
          </div>
        )}
      </div>

      {/* 如果未登录，仍然可以使用（保持原有逻辑，但可以选择登录保存历史 */}
      {/* 状态一：上传 */}
      {processingStatus === "idle" && (
        <label
          className={`w-full max-w-lg border-2 border-dashed rounded-2xl p-12 flex flex-col items-center gap-4 cursor-pointer transition-colors ${
            dragging
              ? "border-blue-500 bg-blue-50"
              : "border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <span className="text-5xl">📁</span>
          <div className="text-center">
            <p className="text-gray-700 font-medium">拖拽图片到此处</p>
            <p className="text-gray-400 text-sm mt-1">或点击选择文件</p>
          </div>
          <p className="text-gray-400 text-xs">支持 JPG / PNG / WebP · 最大 10MB</p>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileInput}
          />
        </label>
      )}

      {/* 状态二：处理中 */}
      {processingStatus === "processing" && (
        <div className="w-full max-w-lg bg-white rounded-2xl p-12 flex flex-col items-center gap-6 shadow-sm">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-600 font-medium">正在去除背景，请稍候...</p>
        </div>
      )}

      {/* 状态三：完成 */}
      {processingStatus === "done" && (
        <div className="w-full max-w-3xl flex flex-col items-center gap-6">
          <div className="grid grid-cols-2 gap-4 w-full">
            <div className="flex flex-col gap-2">
              <p className="text-sm text-gray-500 text-center font-medium">原图</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={originalUrl} alt="原图" className="rounded-xl w-full object-contain max-h-80 bg-gray-100" />
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-sm text-gray-500 text-center font-medium">处理结果</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resultUrl}
                alt="处理结果"
                className="rounded-xl w-full object-contain max-h-80"
                style={{
                  background:
                    "repeating-conic-gradient(#e5e7eb 0% 25%, #fff 0% 50%) 0 0 / 20px 20px",
                }}
              />
            </div>
          </div>
          <div className="flex gap-4">
            <button
              onClick={handleDownload}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
            >
              ⬇️ 下载 PNG
            </button>
            <button
              onClick={handleReset}
              className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
            >
              再处理一张
            </button>
          </div>
          {/* 升级提示给免费用户 */}
          {(!session || (quota && quota.planType === "free")) && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl text-center">
              <p className="text-sm text-blue-800 mb-2">
                🚀 开通Pro，每月 {quota?.planType === "free" ? "200次处理" : "200次处理"}，支持批量上传
              </p>
              <Link
                href="/pricing"
                className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                查看定价 →
              </Link>
            </div>
          )}
        </div>
      )}

      {/* 状态四：错误 */}
      {processingStatus === "error" && (
        <div className="w-full max-w-lg bg-red-50 border border-red-200 rounded-2xl p-8 flex flex-col items-center gap-4">
          <span className="text-4xl">⚠️</span>
          <p className="text-red-700 font-medium text-center">{errorMsg}</p>
          <div className="flex gap-3">
            {errorMsg.includes("配额") && (
              <>
                {!session?.user && (
                  <Link
                    href="/auth/signin"
                    className="px-6 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors"
                  >
                    登录领免费次数
                  </Link>
                )}
                <Link
                  href="/pricing"
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
                >
                  开通Pro
                </Link>
              </>
            )}
            <button
              onClick={handleReset}
              className={`px-6 py-3 rounded-xl font-medium transition-colors ${
                errorMsg.includes("配额") 
                  ? "bg-gray-200 text-gray-700 hover:bg-gray-300" 
                  : "bg-red-600 text-white hover:bg-red-700"
              }`}
            >
              重试
            </button>
          </div>
        </div>
      )}

      {/* Footer with privacy policy link - required for Google OAuth verification */}
      <footer className="mt-16 text-center text-sm text-gray-500">
        <p>
          © 2026 Background Remover · <Link href="/privacy" className="underline hover:text-gray-700">Privacy Policy</Link>
        </p>
      </footer>
    </main>
  );
}
