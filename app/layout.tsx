import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Image Background Remover",
  description: "一键去除图片背景，免费、快速、无需注册",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh">
      <body className="min-h-screen bg-gray-50">
        <SessionProvider>
          <nav className="bg-white border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
              <div className="flex justify-between h-16">
                <div className="flex items-center">
                  <Link href="/" className="flex items-center gap-2">
                    <span className="text-2xl">🖼️</span>
                    <span className="font-bold text-gray-900 text-lg">BG Remover</span>
                  </Link>
                  <div className="hidden sm:ml-8 sm:flex sm:space-x-8">
                    <Link
                      href="/pricing"
                      className="inline-flex items-center px-1 pt-1 border-b-2 border-transparent hover:border-gray-300 text-sm font-medium text-gray-700 hover:text-gray-900"
                    >
                      定价
                    </Link>
                    <Link
                      href="/faq"
                      className="inline-flex items-center px-1 pt-1 border-b-2 border-transparent hover:border-gray-300 text-sm font-medium text-gray-700 hover:text-gray-900"
                    >
                      FAQ
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </nav>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
