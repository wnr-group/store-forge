import type { z } from "zod";
import { AppError } from "@/lib/errors";

/** Validates untrusted input (server actions receive arbitrary client data). */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  const fieldErrors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "_";
    fieldErrors[key] ??= issue.message;
  }
  throw new AppError("VALIDATION", "Please correct the highlighted fields.", fieldErrors);
}
