import { NextResponse } from "next/server";
import { z } from "zod";
import { apiBinary } from "@/lib/api/binary";
import { requirePlatformPermission } from "@/lib/auth/platform";
import { AppError } from "@/lib/errors";

/**
 * Downloads an invoice as a PDF. The browser never sees the API token: this route reads the session, checks the signed-in person's
 * platform role may read billing, and streams the PDF the API builds from the stored invoice and its verified payment.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new NextResponse("Not found", { status: 404 });
  try {
    await requirePlatformPermission("billing:read");
    const file = await apiBinary(`/platform/billing/invoices/${id}/download`);
    return new NextResponse(file.body, {
      headers: { "Content-Type": file.contentType, "Content-Disposition": `attachment; filename="invoice-${id.slice(0, 8)}.pdf"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
    });
  } catch (error) {
    if (error instanceof AppError) {
      const status = error.code === "NOT_FOUND" ? 404 : error.code === "FORBIDDEN" ? 403 : error.code === "UNAUTHENTICATED" ? 401 : 500;
      return new NextResponse(error.message, { status });
    }
    return new NextResponse("Something went wrong. Please try again.", { status: 500 });
  }
}
