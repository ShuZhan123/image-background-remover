"use client";

import { useState, useEffect } from "react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";

export type Plan = {
  id: "pro-monthly" | "pro-yearly";
  name: string;
  price: string;
};

type PayPalSubscribeButtonProps = {
  plan: Plan;
  onSuccess: () => void;
  onError: (error: string) => void;
};

// 客户端动态获取环境变量，兜底方案
// 1. 优先从 window.__env 读取（Cloudflare Pages 替换）
// 2. 如果还是占位符，从 API 端点动态获取
function useClientId() {
  const [clientId, setClientId] = useState<string>("");
  
  useEffect(() => {
    async function getClientId() {
      // 先从 window.__env 读取
      let id = (window as any).__env?.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
      
      // 如果还是占位符字符串，说明 Cloudflare 替换没生效，从 API 获取
      if (!id || id.includes("{{") || id.includes("}}")) {
        console.log("Cloudflare replacement not working, fetching from API...");
        try {
          const res = await fetch("/api/env");
          const data = await res.json();
          id = data.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "";
        } catch (e) {
          console.error("Failed to fetch env from API:", e);
          id = "";
        }
      }
      
      console.log("PayPal Client ID:", id);
      setClientId(id || "");
    }
    
    getClientId();
  }, []);
  
  return clientId;
}

export default function PayPalSubscribeButton({ plan, onSuccess, onError }: PayPalSubscribeButtonProps) {
  const [loading, setLoading] = useState(false);
  const clientId = useClientId();

  async function createSubscription() {
    setLoading(true);
    try {
      const response = await fetch("/api/paypal/create-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ planId: plan.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create subscription");
      }

      // Return the subscription ID for PayPal
      return data.subscriptionId;
    } catch (error) {
      console.error("Error creating subscription:", error);
      onError(error instanceof Error ? error.message : "Unknown error");
      setLoading(false);
      throw error;
    }
  }

  function onApprove(data: any) {
    setLoading(false);
    onSuccess();
    return Promise.resolve();
  }

  function onErrorCallback(error: any) {
    console.error("PayPal error:", error);
    onError(error.message || "PayPal error occurred");
    setLoading(false);
  }

  if (!clientId) {
    return (
      <div className="w-full p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm text-center">
        PayPal Client ID not configured. Please check environment variables.
      </div>
    );
  }

  return (
    <div className="w-full">
      <PayPalScriptProvider options={{ clientId, currency: "USD", intent: "subscription" }}>
        <PayPalButtons
          style={{
            layout: "vertical",
            shape: "rect",
          }}
          createSubscription={createSubscription}
          onApprove={onApprove}
          onError={onErrorCallback}
          disabled={loading}
        />
      </PayPalScriptProvider>
      {loading && (
        <div className="text-center mt-2 text-sm text-gray-500">
          Processing...
        </div>
      )}
    </div>
  );
}
