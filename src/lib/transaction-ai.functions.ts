import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { DUPLICATE_MAX_CANDIDATES } from "./finance";

const txSchema = z.object({
  id: z.string().max(80),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().max(200),
  category: z.string().max(60),
  type: z.enum(["masuk", "keluar"]),
  amount: z.number().nonnegative(),
  status: z.enum(["selesai", "menunggu", "dibatalkan"]),
});

const inputSchema = z.object({
  draft: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    description: z.string().trim().min(3).max(120),
    type: z.enum(["masuk", "keluar"]),
    amount: z.number().nonnegative(),
  }),
  candidates: z.array(txSchema).max(DUPLICATE_MAX_CANDIDATES),
});

export const suggestTransactionInsights = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const { analyzeTransaction } = await import("./ai/transaction-ai.server");
    return analyzeTransaction(getRequest(), data.draft, data.candidates);
  });
