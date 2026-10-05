import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface BiasReceipt {
  id: number;
  request_id: string;
  trading_date: string;
  version: number;
  status: "pending" | "passed" | "revision_requested";
  status_label: string;
  submitted_at: string;
  url: string;
}

export interface BiasHomeworkState {
  enabled: boolean;
  linked: boolean;
  active: boolean;
  coach_name?: string;
  homework_title?: string;
  submission: BiasReceipt | null;
  receipt?: BiasReceipt | null;
  error?: string;
  can_restart?: boolean;
  return_url?: string;
}

export const biasHomework = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    action: z.enum(["status", "link", "submit"]),
    code: z.string().min(12).max(64).optional(),
    requestId: z.string().uuid().optional(),
    entryIds: z.array(z.string().uuid()).min(1).max(50).optional(),
  }))
  .handler(async ({ data }): Promise<BiasHomeworkState> => {
    const { handleBiasHomework } = await import("./bias-homework.server");
    return handleBiasHomework(data);
  });
