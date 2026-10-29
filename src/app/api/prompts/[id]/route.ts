import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleError, jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const name = String(body.name ?? "").trim().slice(0, 60);
    const content = String(body.content ?? "").trim().slice(0, 2000);
    if (!name || !content) return jsonError("Both a name and the prompt text are required.");
    const prompt = await prisma.systemPrompt.update({ where: { id }, data: { name, content } });
    return NextResponse.json(prompt);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    await prisma.systemPrompt.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
