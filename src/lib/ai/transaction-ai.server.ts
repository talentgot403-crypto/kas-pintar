import { createOpenAI } from "@ai-sdk/openai";
import { APICallError, NoObjectGeneratedError, Output, streamText } from "ai";
import { z } from "zod";

import { categoriesFor, formatRupiah, sanitizeAnalysis, type AiAnalysis, type AiCandidate, type TxDraft } from "../finance";
import { createLovableAiGatewayRunIdFetch, getLovableAiGatewayRunId } from "./run-id.server";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";

export type AnalyzeResult = { ok: true; analysis: AiAnalysis } | { ok: false; error: string };

const INSTRUCTIONS = `Anda asisten bendahara organisasi di Indonesia.
Tugas:
1. Pilih SATU kategori paling sesuai untuk transaksi baru dari daftar kategori yang diberikan. Jika tidak ada yang cocok, pilih "Lainnya" bila tersedia, atau kategori terdekat dengan keyakinan "rendah".
2. Bandingkan transaksi baru dengan daftar transaksi lama. Tandai sebagai kemungkinan duplikat HANYA jika kemungkinan besar itu pencatatan ganda dari kejadian yang sama (keterangan bermakna sama, jumlah sama atau hampir sama, tanggal berdekatan). Transaksi rutin bulanan di bulan berbeda BUKAN duplikat.
Tulis alasan singkat (maks. 1 kalimat) dalam Bahasa Indonesia. Gunakan ID transaksi persis seperti yang diberikan.`;

function friendlyError(status: number | undefined): string {
  if (status === 402) return "Kredit AI habis. Pemilik workspace perlu menambah kredit agar fitur saran AI bisa dipakai lagi.";
  if (status === 429) return "Layanan AI sedang sibuk. Coba lagi dalam beberapa saat.";
  if (status === 403) return "Akses AI untuk workspace ini sedang dibatasi. Hubungi admin workspace.";
  if (status === 401) return "Konfigurasi AI belum lengkap.";
  return "Saran AI sedang tidak tersedia. Coba lagi nanti.";
}

export async function analyzeTransaction(
  request: Request,
  draft: TxDraft,
  candidates: AiCandidate[],
): Promise<AnalyzeResult> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return { ok: false, error: friendlyError(401) };

  const categories = categoriesFor(draft.type) as [string, ...string[]];
  const schema = z.object({
    category: z.enum(categories),
    confidence: z.enum(["tinggi", "sedang", "rendah"]),
    reason: z.string(),
    duplicates: z.array(z.object({ id: z.string(), reason: z.string() })),
  });

  const history = candidates.length
    ? candidates
        .map((t) => `- id=${t.id} | ${t.date} | ${t.description} | ${t.category} | ${formatRupiah(t.amount)}`)
        .join("\n")
    : "(tidak ada)";

  const prompt = `Transaksi baru:
- Jenis: ${draft.type === "masuk" ? "Pemasukan" : "Pengeluaran"}
- Tanggal: ${draft.date}
- Keterangan: ${draft.description}
- Jumlah: ${draft.amount > 0 ? formatRupiah(draft.amount) : "(belum diisi)"}

Kategori yang tersedia: ${categories.join(", ")}

Transaksi lama dengan jenis sama (±30 hari):
${history}`;

  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  const provider = createOpenAI({
    baseURL: GATEWAY_URL,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });

  let streamError: unknown;
  try {
    const result = streamText({
      model: provider.responses(MODEL),
      instructions: INSTRUCTIONS,
      messages: [{ role: "user", content: prompt }],
      output: Output.object({ schema }),
      abortSignal: request.signal,
      maxRetries: 0,
      onError: ({ error }) => {
        streamError = error;
      },
      providerOptions: {
        openai: {
          forceReasoning: true,
          reasoningEffort: "low",
          reasoningSummary: "auto",
          store: false,
          include: ["reasoning.encrypted_content"],
        },
      },
    });
    const output = await result.output;
    const analysis = sanitizeAnalysis(
      output,
      draft.type,
      candidates.map((c) => c.id),
    );
    return { ok: true, analysis };
  } catch (error) {
    const err = streamError ?? error;
    if (NoObjectGeneratedError.isInstance(error)) {
      console.error("[ai] structured output gagal", error.text);
      return { ok: false, error: "AI tidak memberi jawaban yang bisa dibaca. Coba lagi." };
    }
    const status = APICallError.isInstance(err) ? err.statusCode : undefined;
    console.error("[ai] analisis transaksi gagal", status, err);
    return { ok: false, error: friendlyError(status) };
  }
}
