import { NextResponse } from "next/server";

export const MODELS = ["GPT-4", "Claude", "Local Llama"] as const;
export const MAX_MESSAGE_LENGTH = 4000;

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Turns any thrown error into a friendly JSON response instead of a crash. */
export function handleError(err: unknown) {
  const e = err as { code?: string; name?: string; message?: string };
  console.error("[api]", e?.name, e?.code, e?.message);
  const dbDown =
    e?.name === "PrismaClientInitializationError" ||
    ["P1001", "P1002", "P1008", "P1017", "P2024"].includes(e?.code ?? "") ||
    /DATABASE_URL|connect|ECONNREFUSED|timed out/i.test(e?.message ?? "");
  if (dbDown) {
    return jsonError(
      "Leili can't reach the sauna database right now. Please try again in a moment.",
      503
    );
  }
  if (e?.code === "P2025") return jsonError("That item no longer exists.", 404);
  if (e?.code === "P2002") return jsonError("A prompt with that name already exists.", 409);
  return jsonError("Something went wrong on the server. Please try again.", 500);
}

export function clamp01(v: unknown, fallback: number) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(Math.min(1, Math.max(0, n)) * 10) / 10;
}
