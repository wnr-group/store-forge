"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { run } from "@/lib/actions/run";
import { parseInput } from "@/lib/validations/parse";
import {
  createReview,
  deleteReview,
  importReviews,
  listReviews,
  publishReview,
  unpublishReview,
  updateReview,
} from "@/services/reviews.service";

const idSchema = z.string().uuid();

export const listReviewsAction = async (input?: unknown) =>
  run(() => {
    const query = input
      ? parseInput(
          z.object({
            productId: z.string().uuid().optional(),
            status: z.enum(["published", "unpublished"]).optional(),
            source: z.enum(["merchant_entered", "imported"]).optional(),
            limit: z.number().int().min(1).max(50).optional(),
            offset: z.number().int().min(0).optional(),
            sort: z.string().optional(),
          }),
          input,
        )
      : undefined;
    return listReviews(query);
  });

export const createReviewAction = async (input: unknown) =>
  run(async () => {
    const v = parseInput(
      z.object({
        productId: idSchema,
        authorName: z.string().trim().min(1).max(80),
        rating: z.number().int().min(1).max(5),
        title: z.string().trim().min(1).max(120),
        body: z.string().trim().min(1).max(5000),
        originLabel: z.string().trim().max(60).optional(),
        status: z.enum(["published", "unpublished"]).optional(),
      }),
      input,
    );
    const result = await createReview(v);
    revalidatePath("/dashboard/reviews");
    return result;
  });

export const updateReviewAction = async (input: unknown) =>
  run(async () => {
    const v = parseInput(
      z.object({
        id: idSchema,
        authorName: z.string().trim().min(1).max(80).optional(),
        rating: z.number().int().min(1).max(5).optional(),
        title: z.string().trim().min(1).max(120).optional(),
        body: z.string().trim().min(1).max(5000).optional(),
        originLabel: z.string().trim().max(60).optional(),
        status: z.enum(["published", "unpublished"]).optional(),
      }),
      input,
    );
    const result = await updateReview(v.id, v);
    revalidatePath("/dashboard/reviews");
    return result;
  });

export const publishReviewAction = async (id: unknown) =>
  run(async () => {
    const result = await publishReview(parseInput(idSchema, id));
    revalidatePath("/dashboard/reviews");
    return result;
  });

export const unpublishReviewAction = async (id: unknown) =>
  run(async () => {
    const result = await unpublishReview(parseInput(idSchema, id));
    revalidatePath("/dashboard/reviews");
    return result;
  });

export const deleteReviewAction = async (id: unknown) =>
  run(async () => {
    const result = await deleteReview(parseInput(idSchema, id));
    revalidatePath("/dashboard/reviews");
    return result;
  });

export const importReviewsAction = async (input: unknown) =>
  run(async () => {
    const v = parseInput(
      z.object({
        csvContent: z.string().min(1),
        attestationId: z.string().uuid().optional(),
        validateOnly: z.boolean().optional(),
      }),
      input,
    );
    const result = await importReviews(v);
    if (!v.validateOnly) {
      revalidatePath("/dashboard/reviews");
    }
    return result;
  });
