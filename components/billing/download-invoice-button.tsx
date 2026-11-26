"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Saves an invoice PDF without leaving the page. A plain link would navigate the tab to the download route, which shows the browser's
 * loading state while the PDF is built and replaces the page with plain text if the download fails. This fetches the file in the
 * background, saves it, and reports a failure as a message instead. `href` is the same session-checked download route the link used.
 */
export function DownloadInvoiceButton({ href, fileName }: { href: string; fileName: string }) {
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const res = await fetch(href, { credentials: "same-origin" });
      if (!res.ok) throw new Error(res.status === 403 ? "You do not have access to this invoice." : res.status === 404 ? "This invoice could not be found." : "Could not download the invoice. Please try again.");
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Could not download the invoice. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" variant="outline" onClick={download} disabled={busy}>
      {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />} {busy ? "Preparing…" : "Download PDF"}
    </Button>
  );
}
