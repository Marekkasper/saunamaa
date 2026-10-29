import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, database: "up" });
  } catch {
    // Still 200 so the web service stays up; the UI shows a friendly banner.
    return NextResponse.json({ ok: true, database: "down" });
  }
}
