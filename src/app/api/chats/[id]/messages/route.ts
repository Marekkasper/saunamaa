import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MAX_MESSAGE_LENGTH, handleError, jsonError } from "@/lib/api";
import { sendMessage } from "@/lib/mockAi";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const content = typeof body?.content === "string" ? body.content.trim() : "";
    const attachmentName =
      typeof body?.attachmentName === "string" && body.attachmentName.trim()
        ? body.attachmentName.trim().slice(0, 200)
        : null;

    if (!content && !attachmentName) return jsonError("Please type a message before sending.");
    if (content.length > MAX_MESSAGE_LENGTH) {
      return jsonError(`Your message is too long (${content.length} characters). The limit is ${MAX_MESSAGE_LENGTH}.`);
    }

    const chat = await prisma.chatSession.findUnique({
      where: { id },
      include: { systemPrompt: true, _count: { select: { messages: true } } },
    });
    if (!chat) return jsonError("Chat not found. It may have been deleted.", 404);

    const userMessage = await prisma.message.create({
      data: { sessionId: id, role: "user", content: content || "(file only)", attachmentName },
    });

    const answer = await sendMessage(
      content,
      chat.model,
      { temperature: chat.temperature, topP: chat.topP },
      chat.systemPrompt ? { name: chat.systemPrompt.name, content: chat.systemPrompt.content } : null,
      attachmentName
    );

    const assistantMessage = await prisma.message.create({
      data: { sessionId: id, role: "assistant", content: answer },
    });

    // First message names the chat; always bump updatedAt for ordering.
    const title =
      chat.title === "New chat" && content
        ? content.replace(/\s+/g, " ").slice(0, 48) + (content.length > 48 ? "…" : "")
        : chat.title;
    await prisma.chatSession.update({ where: { id }, data: { title } });

    return NextResponse.json({ userMessage, assistantMessage, title }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}

/** "Clear Chat": removes all messages but keeps the session and its settings. */
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    await prisma.message.deleteMany({ where: { sessionId: id } });
    await prisma.chatSession.update({ where: { id }, data: { title: "New chat" } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
