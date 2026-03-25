import { promises as fs } from "node:fs";
import path from "node:path";

export type AiFeedbackType =
  | "kural_duzeltmesi"
  | "veri_yorumlama"
  | "isimlendirme"
  | "oncelik"
  | "tahmin_gercek_ayrimi";

export type AiFeedbackRecord = {
  schema_version: "1.0";
  record_type: "feedback";
  created_at: string;
  product_url?: string;
  product_title?: string;
  analysis_area:
    | "talep"
    | "yorum"
    | "soru"
    | "icerik"
    | "fiyat"
    | "aksiyon"
    | "genel";
  ai_output_summary: string;
  user_feedback: string;
  feedback_type: AiFeedbackType;
  accepted_rule?: string;
  rejected_rule?: string;
  notes?: string;
};

const RULEBOOK_PATH = path.join(process.cwd(), "TRENDYOL_UZMANLIK_KURALLARI.md");
const FEEDBACK_PATH = path.join(process.cwd(), "AI_GERI_BILDIRIM_KAYITLARI.jsonl");
const ANALYST_PROMPT_PATH = path.join(process.cwd(), "ANALIST_PROMPT_TR.md");
const REVIEWER_PROMPT_PATH = path.join(process.cwd(), "DENETCI_PROMPT_TR.md");

async function safeReadFile(filePath: string) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

function compactText(value: string) {
  return value.replace(/\r/g, "").trim();
}

export async function appendAiFeedbackRecord(
  record: Omit<AiFeedbackRecord, "schema_version" | "record_type" | "created_at"> & {
    created_at?: string;
  }
) {
  const payload: AiFeedbackRecord = {
    schema_version: "1.0",
    record_type: "feedback",
    created_at: record.created_at || new Date().toISOString(),
    product_url: record.product_url,
    product_title: record.product_title,
    analysis_area: record.analysis_area,
    ai_output_summary: record.ai_output_summary,
    user_feedback: record.user_feedback,
    feedback_type: record.feedback_type,
    accepted_rule: record.accepted_rule,
    rejected_rule: record.rejected_rule,
    notes: record.notes,
  };

  await fs.appendFile(FEEDBACK_PATH, `${JSON.stringify(payload)}\n`, "utf8");
  return payload;
}

export async function readRecentAiFeedback(limit = 8) {
  const raw = await safeReadFile(FEEDBACK_PATH);
  if (!raw) return [] as AiFeedbackRecord[];

  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as AiFeedbackRecord;
      } catch {
        return null;
      }
    })
    .filter((item): item is AiFeedbackRecord => item !== null && item.record_type === "feedback")
    .slice(-limit)
    .reverse();
}

export async function buildAiLearningPromptSection(params?: {
  limit?: number;
  area?: string | null;
}) {
  const [rulebook, recentFeedback] = await Promise.all([
    safeReadFile(RULEBOOK_PATH),
    readRecentAiFeedback(params?.limit ?? 6),
  ]);

  const filteredFeedback = recentFeedback.filter((item) =>
    params?.area ? item.analysis_area === params.area || item.analysis_area === "genel" : true
  );

  const feedbackText = filteredFeedback.length
    ? filteredFeedback
        .map((item, index) =>
          [
            `Ornek ${index + 1}`,
            `Alan: ${item.analysis_area}`,
            `AI ozeti: ${compactText(item.ai_output_summary)}`,
            `Kullanici geri bildirimi: ${compactText(item.user_feedback)}`,
            item.accepted_rule ? `Kabul edilen kural: ${compactText(item.accepted_rule)}` : "",
            item.rejected_rule ? `Reddedilen yorum: ${compactText(item.rejected_rule)}` : "",
          ]
            .filter(Boolean)
            .join("\n")
        )
        .join("\n\n")
    : "Henuz kayitli geri bildirim yok.";

  return [
    "UZMANLIK KURALLARI:",
    compactText(rulebook || "Kural kitabi bulunamadi."),
    "",
    "SON GERI BILDIRIM ORNEKLERI:",
    feedbackText,
  ].join("\n");
}

export async function readAnalystPromptTemplate() {
  return compactText(await safeReadFile(ANALYST_PROMPT_PATH));
}

export async function readReviewerPromptTemplate() {
  return compactText(await safeReadFile(REVIEWER_PROMPT_PATH));
}
