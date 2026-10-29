import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleError, jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const prompts = await prisma.systemPrompt.findMany({ orderBy: { createdAt: "asc" } });
    return NextResponse.json(prompts);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body.name ?? "").trim().slice(0, 60);
    const content = String(body.content ?? "").trim().slice(0, 2000);
    if (!name || !content) return jsonError("Both a name and the prompt text are required.");
    const prompt = await prisma.systemPrompt.create({ data: { name, content } });
    return NextResponse.json(prompt, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
