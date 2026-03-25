import { NextResponse } from "next/server";
import { appendAiFeedbackRecord } from "@/lib/ai-learning-memory";

export async function POST(req: Request) {
  try {
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

    const saved = await appendAiFeedbackRecord({
      product_url: typeof body.product_url === "string" ? body.product_url : undefined,
      product_title: typeof body.product_title === "string" ? body.product_title : undefined,
      analysis_area:
        body.analysis_area === "talep" ||
        body.analysis_area === "yorum" ||
        body.analysis_area === "soru" ||
        body.analysis_area === "icerik" ||
        body.analysis_area === "fiyat" ||
        body.analysis_area === "aksiyon"
          ? body.analysis_area
          : "genel",
      ai_output_summary: body.ai_output_summary,
      user_feedback: body.user_feedback,
      feedback_type:
        body.feedback_type === "kural_duzeltmesi" ||
        body.feedback_type === "veri_yorumlama" ||
        body.feedback_type === "isimlendirme" ||
        body.feedback_type === "oncelik" ||
        body.feedback_type === "tahmin_gercek_ayrimi"
          ? body.feedback_type
          : "veri_yorumlama",
      accepted_rule: typeof body.accepted_rule === "string" ? body.accepted_rule : undefined,
      rejected_rule: typeof body.rejected_rule === "string" ? body.rejected_rule : undefined,
      notes: typeof body.notes === "string" ? body.notes : undefined,
    });

    return NextResponse.json({ ok: true, record: saved });
  } catch {
    return NextResponse.json({ ok: false, error: "FEEDBACK_SAVE_FAILED" }, { status: 500 });
  }
}
