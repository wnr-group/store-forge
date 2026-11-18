"use client";

import { RotateCcw, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MAX_TEXT_LENGTH, readTextOverrides } from "@/lib/editor/text";
import type { ComponentNode } from "@/lib/templates/document";

type Props = {
  section: ComponentNode;
  /** The original text the merchant clicked in the preview (a word the theme writes itself), if any. */
  clicked: { text: string; nonce: number } | null;
  disabled: boolean;
  onChange: (from: string, to: string | undefined) => void;
};

/**
 * Words the theme writes into its own components (menu labels, footer lines, "Add to bag" ...) have no setting. Clicking one in
 * the preview offers it here; the replacement shows everywhere that exact text appears in this section, on the live page too.
 */
export function TextOnPage({ section, clicked, disabled, onChange }: Props) {
  const overrides = readTextOverrides(section.settings);
  const current = clicked ? (overrides.find((o) => o.from === clicked.text)?.to ?? clicked.text) : "";
  const others = overrides.filter((o) => o.from !== clicked?.text);
  if (!clicked && others.length === 0) return null;
  return (
    <section className="space-y-3 rounded-md border bg-muted/30 p-3" aria-label="Text on the page">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold"><Type className="size-3.5" aria-hidden /> Text on the page</h3>
      {clicked ? (
        <div className="space-y-1.5" key={clicked.nonce}>
          <Label htmlFor="sf-clicked-text" className="text-xs font-medium">Replace &ldquo;{clicked.text.length > 40 ? `${clicked.text.slice(0, 40)}…` : clicked.text}&rdquo;</Label>
          <Textarea id="sf-clicked-text" rows={2} maxLength={MAX_TEXT_LENGTH} defaultValue={current} disabled={disabled} onChange={(e) => onChange(clicked.text, e.target.value)} />
          <p className="text-xs text-muted-foreground">Changes this text everywhere it appears in this section.</p>
        </div>
      ) : null}
      {others.length > 0 ? (
        <ul className="space-y-1">
          {others.map((o) => (
            <li key={o.from} className="flex items-center gap-2 text-xs">
              <span className="min-w-0 flex-1 truncate"><span className="text-muted-foreground line-through">{o.from}</span> → {o.to || "(blank)"}</span>
              <Button type="button" size="xs" variant="ghost" disabled={disabled} onClick={() => onChange(o.from, undefined)} aria-label={`Put back "${o.from}"`}><RotateCcw aria-hidden /> Reset</Button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
