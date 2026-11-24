import { NextResponse } from "next/server";
import { z } from "zod";
import { apiBinary } from "@/lib/api/binary";
import { canManageBilling } from "@/lib/auth/permissions";
import { AppError } from "@/lib/errors";
import { requireActiveTenant } from "@/lib/tenant/context";

/**
 * Downloads one of the organization's own invoices as a PDF. The browser never sees the API token: this route reads the session, checks
 * the signed-in person is the Owner of the active organization, and streams the PDF the API builds. The API checks again and only ever
 * returns an invoice of this organization.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new NextResponse("Not found", { status: 404 });
  try {
    const active = await requireActiveTenant("billing:manage");
    if (!canManageBilling(active)) return new NextResponse("Forbidden", { status: 403 });
    const file = await apiBinary(`/billing/invoices/${id}/download`, active.tenant.id);
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
