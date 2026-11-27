import "server-only";
import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";

/** Answers an export download that failed with the same plain-text statuses the invoice download uses. Never forwards internal detail. */
export function exportFailure(error: unknown): NextResponse {
  if (error instanceof AppError) {
    const status = error.code === "NOT_FOUND" ? 404 : error.code === "FORBIDDEN" ? 403 : error.code === "UNAUTHENTICATED" ? 401 : error.code === "VALIDATION" ? 400 : 500;
    return new NextResponse(error.message, { status, headers: { "Cache-Control": "no-store" } });
  }
  return new NextResponse("Something went wrong. Please try again.", { status: 500, headers: { "Cache-Control": "no-store" } });
}

export const exportFormat = (value: string | null): "csv" | "xlsx" => (value === "xlsx" ? "xlsx" : "csv");
