import { NextResponse } from "next/server";
import { z } from "zod";
import { apiBinary } from "@/lib/api/binary";
import { AppError } from "@/lib/errors";
import { requireActiveTenant } from "@/lib/tenant/context";

/**
 * Downloads a shipment's label PDF. The browser never sees the API token: this route reads the session, checks the member may
 * view orders in the ACTIVE workspace, and streams the PDF the API stored for that tenant's shipment.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new NextResponse("Not found", { status: 404 });
  try {
    const { tenant } = await requireActiveTenant("orders:view");
    const file = await apiBinary(`/shipments/${id}/label/file`, tenant.id);
    return new NextResponse(file.body, {
      headers: { "Content-Type": file.contentType, "Content-Disposition": `inline; filename="label-${id.slice(0, 8)}.pdf"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
    });
  } catch (error) {
    if (error instanceof AppError) {
      const status = error.code === "NOT_FOUND" ? 404 : error.code === "FORBIDDEN" ? 403 : error.code === "UNAUTHENTICATED" ? 401 : 500;
      return new NextResponse(error.message, { status });
    }
    return new NextResponse("Something went wrong. Please try again.", { status: 500 });
  }
}
