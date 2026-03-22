"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getPlanDefinitions, isAppPlanId, type AppPlanId } from "@/lib/plans";

const planOptions = getPlanDefinitions().map((plan) => ({
  id: plan.id,
  label: plan.displayName,
}));

type Props = {
  userId: string;
  currentPlanId: string;
  currentPlanLabel: string;
  subscriptionStatusLabel: string;
};

export default function UserPlanForm({
  userId,
  currentPlanId,
  currentPlanLabel,
  subscriptionStatusLabel,
}: Props) {
  const router = useRouter();
  const normalizedCurrentPlanId: AppPlanId = isAppPlanId(currentPlanId)
    ? currentPlanId
    : "FREE";
  const [selectedPlanId, setSelectedPlanId] = useState<AppPlanId>(
    normalizedCurrentPlanId
  );
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (selectedPlanId === normalizedCurrentPlanId) {
      setFeedback({
        tone: "success",
        message: `Plan zaten ${currentPlanLabel}.`,
      });
      return;
    }

    setFeedback(null);
    setIsSaving(true);

    try {
      const response = await fetch(`/api/admin/users/${userId}/subscription`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planId: selectedPlanId,
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        planLabel?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "Plan guncellenemedi.");
      }

      setFeedback({
        tone: "success",
        message: `${data.planLabel || "Plan"} aktif edildi.`,
      });

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Plan guncellenemedi.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="admin-plan-form" onSubmit={handleSubmit}>
      <div className="admin-plan-form__controls">
        <select
          className="select admin-plan-form__select"
          aria-label="Uyelik plani sec"
          value={selectedPlanId}
          onChange={(event) => setSelectedPlanId(event.target.value as AppPlanId)}
          disabled={isSaving || isPending}
        >
          {planOptions.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.label}
            </option>
          ))}
        </select>

        <button
          type="submit"
          className="btn btn-secondary admin-plan-form__button"
          disabled={isSaving || isPending}
        >
          {isSaving || isPending ? "Kaydediliyor" : "Kaydet"}
        </button>
      </div>

      <div className="admin-plan-form__meta">
        Su an: {currentPlanLabel} / Abonelik: {subscriptionStatusLabel}
      </div>

      {feedback ? (
        <div
          className={`admin-plan-form__message ${
            feedback.tone === "error"
              ? "admin-plan-form__message--error"
              : "admin-plan-form__message--success"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}
    </form>
  );
}
