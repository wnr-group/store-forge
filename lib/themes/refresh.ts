import type { QueryClient } from "@tanstack/react-query";
import { themeKeys } from "./queries";
import type { TemplateSummary } from "./types";

/**
 * The editor decides what is "not published" from the list of pages and their publication states (`useTemplates`). Saving a
 * draft changes a page's state on the server (published becomes published-with-changes), so the list has to be read again
 * after a save, or the badge and the Publish summary go on describing the state from when the editor opened.
 */

/**
 * After a page draft was saved: mark the list stale and read it again. The editor keeps `useTemplates` mounted, so the read
 * starts at once. Several calls close together restart one read, never run several at the same time.
 */
export function refreshTemplateStates(client: QueryClient): Promise<void> {
  return client.invalidateQueries({ queryKey: themeKeys.templates });
}

/**
 * When the Publish dialog opens: read the list again unless a read is already running (`cancelRefetch: false` joins that
 * read instead of starting a second one), so the dialog shows the real state even after changes made elsewhere.
 */
export function refetchTemplateStatesOnOpen(client: QueryClient): Promise<void> {
  return client.refetchQueries({ queryKey: themeKeys.templates, type: "active" }, { cancelRefetch: false });
}

/** What the publication badge says. */
export type PublicationStatus = "published" | "unpublished" | "checking";

/**
 * Three separate states. Pending changes always win: a refresh in progress never hides a change that is known, and never
 * turns a page into "unpublished" by itself. Only when nothing is known to be pending does an unfinished refresh say
 * "checking" instead of "published", because the answer is not yet known.
 */
export function publicationStatus(pending: boolean, checking: boolean): PublicationStatus {
  if (pending) return "unpublished";
  return checking ? "checking" : "published";
}

/**
 * What is known about the shared product-page layout (the default product template, used by every product):
 *  - `pending`: it has unpublished changes (saved but not published, or edited here and not yet saved);
 *  - `clear`: confirmed published;
 *  - `checking`: the list of publication states is being read, so it is not known yet;
 *  - `unavailable`: the last read failed or never arrived, so it cannot be confirmed either way.
 * Only `clear` means published. An unknown state is never shown as published, and a known pending change is never hidden
 * by a refresh in progress.
 */
export type LayoutState = "pending" | "clear" | "checking" | "unavailable";

export function productLayoutState(input: {
  templates: readonly Pick<TemplateSummary, "kind" | "isDefault" | "status" | "publicationState">[] | undefined;
  /** A read of the list is running. */
  fetching: boolean;
  /** The last read of the list failed. */
  failed: boolean;
  /** The product page is edited here and not saved yet. */
  pageDocDirty: boolean;
}): LayoutState {
  if (input.pageDocDirty) return "pending";
  // A failed read cannot confirm anything, in either direction (its data may be older than the last publish).
  if (input.failed) return "unavailable";
  const page = input.templates?.find((t) => t.kind === "product" && t.isDefault && t.status === "active");
  if (page && page.publicationState !== "published") return "pending";
  if (!input.templates) return input.fetching ? "checking" : "unavailable";
  return input.fetching ? "checking" : "clear";
}
