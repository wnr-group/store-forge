import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

// queries.tsx imports the server actions; none is called here.
vi.mock("@/app/(dashboard)/dashboard/templates/actions", () => ({}));

import { publicationStatus, refetchTemplateStatesOnOpen, refreshTemplateStates } from "@/lib/themes/refresh";
import { themeKeys } from "@/lib/themes/queries";

/**
 * The list of pages and their publication states must be read again after a draft is saved, and when the Publish dialog
 * opens; and the badge must say one of three distinct things.
 */

type Row = { id: string; publicationState: "published" | "published_with_changes" };
const clients: QueryClient[] = [];
const newClient = () => {
  // The editor's own provider settings: a long staleTime and no refetch on focus, so only an explicit refresh reads again.
  const c = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: false } } });
  clients.push(c);
  return c;
};
afterEach(() => {
  clients.splice(0).forEach((c) => c.clear());
});

/** A mounted `useTemplates()`: an active observer on the same key, reading `server.state`. */
function mount(client: QueryClient, server: { state: Row["publicationState"] }, queryFn?: () => Promise<Row[]>) {
  const fn = vi.fn(queryFn ?? (async () => [{ id: "product", publicationState: server.state }]));
  const observer = new QueryObserver<Row[]>(client, { queryKey: themeKeys.templates, queryFn: fn });
  const unsubscribe = observer.subscribe(() => {});
  return { fn, observer, unsubscribe };
}
const settle = () => new Promise((r) => setTimeout(r, 0));

describe("refreshTemplateStates", () => {
  it("reads the list again even though it is still fresh, so the saved page shows its new state", async () => {
    const client = newClient();
    const server = { state: "published" as Row["publicationState"] };
    const { fn, observer, unsubscribe } = mount(client, server);
    await settle();
    expect(observer.getCurrentResult().data?.[0].publicationState).toBe("published");
    expect(fn).toHaveBeenCalledTimes(1);

    // The autosave stored a draft: the server now says published-with-changes. Without a refresh the cache (fresh for 30 s) keeps saying "published".
    server.state = "published_with_changes";
    await settle();
    expect(observer.getCurrentResult().data?.[0].publicationState).toBe("published");

    await refreshTemplateStates(client);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(observer.getCurrentResult().data?.[0].publicationState).toBe("published_with_changes");
    unsubscribe();
  });

  it("goes back to published when the page was edited back to its live content", async () => {
    const client = newClient();
    const server = { state: "published_with_changes" as Row["publicationState"] };
    const { observer, unsubscribe } = mount(client, server);
    await settle();
    server.state = "published";
    await refreshTemplateStates(client);
    expect(observer.getCurrentResult().data?.[0].publicationState).toBe("published");
    unsubscribe();
  });

  it("a burst of saves ends with the latest state; an older read never wins", async () => {
    const client = newClient();
    let calls = 0;
    const slowFirst = async (): Promise<Row[]> => {
      calls += 1;
      const n = calls;
      // the second read answers quickly, the earlier ones slowly and with an older state
      await new Promise((r) => setTimeout(r, n === 1 ? 5 : n === 2 ? 40 : 1));
      return [{ id: "product", publicationState: n === 3 ? "published_with_changes" : "published" }];
    };
    const { observer, unsubscribe } = mount(client, { state: "published" }, slowFirst);
    await new Promise((r) => setTimeout(r, 15));
    void refreshTemplateStates(client); // read 2 (slow, older)
    await refreshTemplateStates(client); // read 3 (fast, newest) cancels read 2
    await new Promise((r) => setTimeout(r, 60));
    expect(observer.getCurrentResult().data?.[0].publicationState).toBe("published_with_changes");
    expect(observer.getCurrentResult().isFetching).toBe(false);
    unsubscribe();
  });

  it("leaves every other query alone", async () => {
    const client = newClient();
    const other = vi.fn(async () => ["x"]);
    const otherObserver = new QueryObserver(client, { queryKey: themeKeys.presentations, queryFn: other });
    const stop = otherObserver.subscribe(() => {});
    const { unsubscribe } = mount(client, { state: "published" });
    await settle();
    other.mockClear();
    await refreshTemplateStates(client);
    expect(other).not.toHaveBeenCalled();
    stop();
    unsubscribe();
  });
});

describe("refetchTemplateStatesOnOpen", () => {
  it("reads the list when the dialog opens", async () => {
    const client = newClient();
    const server = { state: "published" as Row["publicationState"] };
    const { fn, observer, unsubscribe } = mount(client, server);
    await settle();
    server.state = "published_with_changes"; // changed elsewhere (another tab or a teammate)
    await refetchTemplateStatesOnOpen(client);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(observer.getCurrentResult().data?.[0].publicationState).toBe("published_with_changes");
    unsubscribe();
  });

  it("joins a read that is already running instead of starting a second one", async () => {
    const client = newClient();
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const fn = vi.fn(async (): Promise<Row[]> => {
      await gate;
      return [{ id: "product", publicationState: "published_with_changes" }];
    });
    const { unsubscribe } = mount(client, { state: "published" }, fn);
    await settle();
    expect(fn).toHaveBeenCalledTimes(1); // the autosave refresh is running
    const open = refetchTemplateStatesOnOpen(client); // the dialog opens meanwhile
    await settle();
    expect(fn).toHaveBeenCalledTimes(1);
    release();
    await open;
    expect(fn).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("does nothing when the list is not mounted", async () => {
    const client = newClient();
    const fn = vi.fn(async () => [] as Row[]);
    await client.prefetchQuery({ queryKey: themeKeys.templates, queryFn: fn });
    fn.mockClear();
    await refetchTemplateStatesOnOpen(client);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("publicationStatus: three distinct states", () => {
  it("published only when nothing is pending and nothing is being checked", () => {
    expect(publicationStatus(false, false)).toBe("published");
  });
  it("changes not published whenever something is pending, checking or not: a refresh never hides a known change", () => {
    expect(publicationStatus(true, false)).toBe("unpublished");
    expect(publicationStatus(true, true)).toBe("unpublished");
  });
  it("checking only when nothing is known to be pending and the answer is not in yet: a refresh alone never makes a page unpublished", () => {
    expect(publicationStatus(false, true)).toBe("checking");
  });
});

import { productLayoutState } from "@/lib/themes/refresh";

describe("productLayoutState: what is known about the shared product page layout", () => {
  const page = (publicationState: string, over: Record<string, unknown> = {}) => ({ kind: "product" as const, isDefault: true, status: "active" as const, publicationState: publicationState as never, ...over });
  const idle = { fetching: false, failed: false, pageDocDirty: false };

  it("pending when the saved layout has unpublished changes, or was never published", () => {
    expect(productLayoutState({ ...idle, templates: [page("published_with_changes")] })).toBe("pending");
    expect(productLayoutState({ ...idle, templates: [page("draft")] })).toBe("pending");
  });

  it("clear only when the layout is confirmed published and nothing is being read", () => {
    expect(productLayoutState({ ...idle, templates: [page("published")] })).toBe("clear");
  });

  it("pending when edited here and not yet saved, whatever the list says", () => {
    expect(productLayoutState({ ...idle, templates: [page("published")], pageDocDirty: true })).toBe("pending");
    expect(productLayoutState({ ...idle, templates: undefined, pageDocDirty: true })).toBe("pending");
  });

  it("while the list is being read, published is not claimed: it is 'checking'", () => {
    expect(productLayoutState({ ...idle, templates: [page("published")], fetching: true })).toBe("checking");
    expect(productLayoutState({ ...idle, templates: undefined, fetching: true })).toBe("checking");
  });

  it("a refresh never hides a pending change that is known", () => {
    expect(productLayoutState({ ...idle, templates: [page("published_with_changes")], fetching: true })).toBe("pending");
  });

  it("with no list and no read going (or a failed read) nothing can be confirmed: 'unavailable', never 'clear'", () => {
    expect(productLayoutState({ ...idle, templates: undefined })).toBe("unavailable");
    expect(productLayoutState({ ...idle, templates: [page("published")], failed: true })).toBe("unavailable");
    expect(productLayoutState({ ...idle, templates: [page("published_with_changes")], failed: true })).toBe("unavailable");
  });

  it("only the default, active product page counts; shared parts and other pages have their own state", () => {
    const others = [page("published_with_changes", { kind: "index" }), page("published_with_changes", { kind: "group_header" }), page("published_with_changes", { isDefault: false }), page("published_with_changes", { status: "archived" }), page("published")];
    expect(productLayoutState({ ...idle, templates: others })).toBe("clear");
  });
});
