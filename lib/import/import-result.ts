// lib/import/import-result.ts
import { z } from "zod";
const rowError = z.object({ row: z.number().int(), column: z.string(), message: z.string(), value: z.string() });
export const importDetailsSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("file"), errors: z.array(z.object({ code: z.string(), message: z.string() })).max(20) }),
  z.object({ kind: z.literal("rows"), total: z.number().int(), errors: z.array(rowError).max(500) }),
]);
export type ImportDetails = z.infer<typeof importDetailsSchema>;
export type RowErrorView = z.infer<typeof rowError>;
