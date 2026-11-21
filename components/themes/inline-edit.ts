/**
 * Editing text directly in the preview. The element holding the text becomes editable in place, the merchant types, and Enter or
 * clicking away keeps it while Escape puts the old words back. Nothing is written to the page's data here: `onDone` gets the
 * old and new text and the editor stores it (in the setting that holds the text, or as a text replacement).
 *
 * The preview page is React's. To leave React's view of the page intact, the text node React created is put back in its place
 * afterwards, with its old words, and React then writes the new ones through the saved document like any other change.
 */

export type InlineEditResult = { element: HTMLElement; original: string; value: string };

/** The text node under the pointer, if the click is on text. */
export function textNodeUnderPointer(event: { clientX: number; clientY: number }, target: HTMLElement): Text | null {
  const doc = target.ownerDocument as Document & { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node } | null; caretRangeFromPoint?: (x: number, y: number) => Range | null };
  const node = doc.caretPositionFromPoint?.(event.clientX, event.clientY)?.offsetNode ?? doc.caretRangeFromPoint?.(event.clientX, event.clientY)?.startContainer ?? null;
  if (node && node.nodeType === Node.TEXT_NODE && target.contains(node) && (node as Text).data.trim()) return node as Text;
  return null;
}

/** Can this text be edited in place? Its element must hold nothing but this text (no other tags or pieces of text inside). */
export function canEditInPlace(node: Text): boolean {
  const el = node.parentElement;
  return !!el && el.childNodes.length === 1 && !el.closest("[contenteditable]");
}

/**
 * Starts editing `node`'s text. Returns a function that ends the edit without keeping it. Only one edit runs at a time (the
 * caller ends the previous one first).
 */
export function beginInlineEdit(node: Text, onDone: (result: InlineEditResult | null) => void): () => void {
  const element = node.parentElement!;
  const original = node.data;
  const doc = element.ownerDocument;
  const win = doc.defaultView!;
  let finished = false;

  element.setAttribute("contenteditable", "plaintext-only");
  element.setAttribute("data-sf-inline-editing", "");
  element.focus({ preventScroll: true });
  const range = doc.createRange();
  range.selectNodeContents(element);
  const selection = win.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);

  const finish = (keep: boolean) => {
    if (finished) return;
    finished = true;
    element.removeEventListener("blur", onBlur);
    element.removeEventListener("keydown", onKey);
    element.removeEventListener("paste", onPaste);
    const value = (element.textContent ?? "").replace(/\r?\n/g, " ");
    element.removeAttribute("contenteditable");
    element.removeAttribute("data-sf-inline-editing");
    win.getSelection()?.removeAllRanges();
    // Put React's own text node back, with its old words.
    node.data = original;
    element.replaceChildren(node);
    onDone(keep && value.trim() !== original.trim() ? { element, original, value: value.trim() } : null);
  };
  const onBlur = () => finish(true);
  const onKey = (e: KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      finish(true);
    } else if (e.key === "Escape") {
      e.preventDefault();
      finish(false);
    }
  };
  // Pasting keeps plain text only.
  const onPaste = (e: ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData?.getData("text/plain") ?? "";
    doc.execCommand("insertText", false, text.replace(/\s+/g, " "));
  };
  element.addEventListener("blur", onBlur);
  element.addEventListener("keydown", onKey);
  element.addEventListener("paste", onPaste);
  return () => finish(false);
}
