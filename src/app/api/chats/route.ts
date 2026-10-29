import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MODELS, clamp01, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const chats = await prisma.chatSession.findMany({
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, updatedAt: true, createdAt: true },
    });
    return NextResponse.json(chats);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const model = MODELS.includes(body.model) ? body.model : "GPT-4";
    let systemPromptId: string | null = typeof body.systemPromptId === "string" ? body.systemPromptId : null;
    if (systemPromptId) {
      const exists = await prisma.systemPrompt.findUnique({ where: { id: systemPromptId } });
      if (!exists) systemPromptId = null;
    }
    const chat = await prisma.chatSession.create({
      data: {
        model,
        temperature: clamp01(body.temperature, 0.7),
        topP: clamp01(body.topP, 0.9),
        systemPromptId,
      },
      include: { messages: true },
    });
    return NextResponse.json(chat, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
