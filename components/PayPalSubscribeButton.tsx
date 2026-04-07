"use client";

import { useState } from "react";
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

const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || process.env.PAYPAL_CLIENT_ID || "";

export default function PayPalSubscribeButton({ plan, onSuccess, onError }: PayPalSubscribeButtonProps) {
  const [loading, setLoading] = useState(false);

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
