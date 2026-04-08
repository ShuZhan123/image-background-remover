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

// 客户端动态获取环境变量，通过 window.__env 注入
// 适配 Cloudflare Pages 构建时环境变量不注入问题
function useClientId() {
  const [clientId, setClientId] = useState<string>("");
  
  useEffect(() => {
    // 从 window.__env 读取
    const id = (window as any).__env?.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
    console.log("PayPal Client ID:", id);
    setClientId(id || "");
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
