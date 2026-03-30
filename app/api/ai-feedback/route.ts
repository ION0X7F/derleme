import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { appendAiFeedbackRecord } from "@/lib/ai-learning-memory";

function normalizeBoundedString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (!normalized) return undefined;
  return normalized.slice(0, maxLength);
}

export async function POST(req: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { ok: false, error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const body = (await req.json()) as {
      product_url?: unknown;
      product_title?: unknown;
      analysis_area?: unknown;
      ai_output_summary?: unknown;
      user_feedback?: unknown;
      feedback_type?: unknown;
      accepted_rule?: unknown;
      rejected_rule?: unknown;
      notes?: unknown;
    };

    if (
      typeof body.analysis_area !== "string" ||
      typeof body.ai_output_summary !== "string" ||
      typeof body.user_feedback !== "string" ||
      typeof body.feedback_type !== "string"
    ) {
      return NextResponse.json(
        { ok: false, error: "INVALID_FEEDBACK_PAYLOAD" },
        { status: 400 }
      );
    }

    const aiOutputSummary = normalizeBoundedString(body.ai_output_summary, 2000);
    const userFeedback = normalizeBoundedString(body.user_feedback, 2000);

    if (!aiOutputSummary || !userFeedback) {
      return NextResponse.json(
        { ok: false, error: "INVALID_FEEDBACK_PAYLOAD" },
        { status: 400 }
      );
    }

    const saved = await appendAiFeedbackRecord({
      product_url: normalizeBoundedString(body.product_url, 500),
      product_title: normalizeBoundedString(body.product_title, 300),
      analysis_area:
        body.analysis_area === "talep" ||
        body.analysis_area === "yorum" ||
        body.analysis_area === "soru" ||
        body.analysis_area === "icerik" ||
        body.analysis_area === "fiyat" ||
        body.analysis_area === "aksiyon"
          ? body.analysis_area
          : "genel",
      ai_output_summary: aiOutputSummary,
      user_feedback: userFeedback,
      feedback_type:
        body.feedback_type === "kural_duzeltmesi" ||
        body.feedback_type === "veri_yorumlama" ||
        body.feedback_type === "isimlendirme" ||
        body.feedback_type === "oncelik" ||
        body.feedback_type === "tahmin_gercek_ayrimi"
          ? body.feedback_type
          : "veri_yorumlama",
      accepted_rule: normalizeBoundedString(body.accepted_rule, 300),
      rejected_rule: normalizeBoundedString(body.rejected_rule, 300),
      notes: normalizeBoundedString(body.notes, 1000),
    });

    return NextResponse.json({
      ok: true,
      record: {
        created_at: saved.created_at,
        analysis_area: saved.analysis_area,
        feedback_type: saved.feedback_type,
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "FEEDBACK_SAVE_FAILED" }, { status: 500 });
  }
}
