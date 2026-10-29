import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MODELS, clamp01, handleError, jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const chat = await prisma.chatSession.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!chat) return jsonError("Chat not found.", 404);
    return NextResponse.json(chat);
  } catch (e) {
    return handleError(e);
  }
}

/** Saves per-chat settings: model, persona, temperature, top-p. */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const data: Record<string, unknown> = {};
    if (MODELS.includes(body.model)) data.model = body.model;
    if (body.temperature !== undefined) data.temperature = clamp01(body.temperature, 0.7);
    if (body.topP !== undefined) data.topP = clamp01(body.topP, 0.9);
    if (body.systemPromptId !== undefined) data.systemPromptId = body.systemPromptId || null;
    const chat = await prisma.chatSession.update({ where: { id }, data });
    return NextResponse.json(chat);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    await prisma.chatSession.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
