"use client";

import { useState, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";

type Status = "idle" | "processing" | "done" | "error";

export default function Home() {
  const { data: session, status: sessionStatus } = useSession();
  const [processingStatus, setProcessingStatus] = useState<Status>("idle");
  const [originalUrl, setOriginalUrl] = useState<string>("");
  const [resultUrl, setResultUrl] = useState<string>("");
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [originalName, setOriginalName] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [dragging, setDragging] = useState(false);

  const processFile = useCallback(async (file: File) => {
    // 校验格式
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setErrorMsg("不支持的格式，请上传 JPG / PNG / WebP");
      setProcessingStatus("error");
      return;
    }
    // 校验大小
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg("文件超过 10MB，请压缩后重试");
      setProcessingStatus("error");
      return;
    }

    setOriginalName(file.name);
    setOriginalUrl(URL.createObjectURL(file));
    setProcessingStatus("processing");

    try {
      const form = new FormData();
      form.append("image", file);

      const res = await fetch("/api/remove-bg", {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(30000),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "处理失败，请稍后重试");
      }

      const blob = await res.blob();
      setResultBlob(blob);
      setResultUrl(URL.createObjectURL(blob));
      setProcessingStatus("done");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "未知错误";
      setErrorMsg(msg.includes("timeout") ? "处理超时（30s），请重试" : msg);
      setProcessingStatus("error");
    }
  }, []);

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
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      {/* 用户信息栏 */}
      {sessionStatus === "authenticated" && session?.user ? (
        <div className="w-full max-w-3xl mb-6 flex items-center justify-between bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            {session.user.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={session.user.image}
                alt={session.user.name || ""}
                className="w-10 h-10 rounded-full"
              />
            )}
            <div>
              <p className="font-medium text-gray-900">{session.user.name}</p>
              <p className="text-sm text-gray-500">{session.user.email}</p>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            退出登录
          </button>
        </div>
      ) : sessionStatus === "unauthenticated" ? (
        <div className="w-full max-w-3xl mb-6 flex items-center justify-end">
          <Link
            href="/auth/signin"
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
        </div>
      )}

      {/* 状态四：错误 */}
      {processingStatus === "error" && (
        <div className="w-full max-w-lg bg-red-50 border border-red-200 rounded-2xl p-8 flex flex-col items-center gap-4">
          <span className="text-4xl">⚠️</span>
          <p className="text-red-700 font-medium text-center">{errorMsg}</p>
          <button
            onClick={handleReset}
            className="px-6 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
          >
            重试
          </button>
        </div>
      )}
    </main>
  );
}
