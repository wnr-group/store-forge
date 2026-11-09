import { safeUrl } from "./bindings";

export type InlineNode =
  | { type: "text"; value: string }
  | { type: "bold"; children: InlineNode[] }
  | { type: "italic"; children: InlineNode[] }
  | { type: "link"; href: string; children: InlineNode[] };

export type ListItemNode = {
  type: "listItem";
  children: InlineNode[];
};

export type BlockNode =
  | { type: "paragraph"; children: InlineNode[] }
  | { type: "list"; ordered: boolean; items: ListItemNode[] };

export type RichNode = BlockNode | InlineNode | ListItemNode;

const isAsciiLetter = (code: number) => (code >= 65 && code <= 90) || (code >= 97 && code <= 122);

/**
 * Sanitizes input text: strips HTML tags (`<tag ...>` and `</tag ...>`, up to the next `>`) so raw HTML is
 * inert. A single linear scan: when no `>` is left after a `<`, no later tag can close either, so it stops.
 * (The equivalent regex `/<\/?[a-zA-Z][^>]*>/g` is quadratic on input such as "<a" repeated.)
 */
function stripHtml(input: string): string {
  const lastClose = input.lastIndexOf(">");
  if (lastClose === -1) return input;

  let out = "";
  let copyFrom = 0;
  let open = input.indexOf("<");
  while (open !== -1 && open < lastClose) {
    const nameAt = input.charCodeAt(open + 1) === 47 ? open + 2 : open + 1;
    if (isAsciiLetter(input.charCodeAt(nameAt))) {
      out += input.slice(copyFrom, open);
      copyFrom = input.indexOf(">", nameAt) + 1;
      open = input.indexOf("<", copyFrom);
    } else {
      open = input.indexOf("<", open + 1);
    }
  }
  return out + input.slice(copyFrom);
}

/**
 * `indexOf(char, from)` for forward-moving queries, in linear time overall: a hit stays valid for any later
 * `from` up to it, and one miss answers every later query. Without this, an input such as "[" repeated would
 * rescan the rest of the text for every marker.
 */
function createFinder(text: string, char: string): (from: number) => number {
  let hitFrom = 0;
  let hit = -2;
  let missFrom = Infinity;
  return (from) => {
    if (from >= missFrom) return -1;
    if (hit >= from && from >= hitFrom) return hit;
    const found = text.indexOf(char, from);
    if (found === -1) {
      missFrom = from;
      return -1;
    }
    hitFrom = from;
    hit = found;
    return found;
  };
}

/**
 * Parses inline formatting: bold (**), italic (*), links ([text](url)). Linear in the text length (no
 * backtracking): link text runs to the first `]`, its url to the first `)`, bold/italic text to the next `*`.
 * An unbalanced marker stays literal text; adjacent literal text is one node.
 */
function parseInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  const nextBracket = createFinder(text, "]");
  const nextParen = createFinder(text, ")");
  const nextStar = createFinder(text, "*");
  let runStart = 0;
  let i = 0;

  const flushText = (end: number) => {
    if (end > runStart) nodes.push({ type: "text", value: text.slice(runStart, end) });
  };
  const resumeAt = (next: number) => {
    i = next;
    runStart = next;
  };

  while (i < text.length) {
    const ch = text[i];

    // Markdown link: [text](url)
    if (ch === "[") {
      const close = nextBracket(i + 1);
      if (close > i + 1 && text[close + 1] === "(") {
        const end = nextParen(close + 2);
        if (end > close + 2) {
          flushText(i);
          const linkText = text.slice(i + 1, close);
          const validHref = safeUrl(text.slice(close + 2, end));
          if (validHref) {
            nodes.push({ type: "link", href: validHref, children: parseInline(linkText) });
          } else {
            // If href is unsafe (e.g. javascript: or data:), render as plain text
            nodes.push(...parseInline(linkText));
          }
          resumeAt(end + 1);
          continue;
        }
      }
    } else if (ch === "*") {
      // Bold: **text**
      if (text[i + 1] === "*") {
        const close = nextStar(i + 2);
        if (close > i + 2 && text[close + 1] === "*") {
          flushText(i);
          nodes.push({ type: "bold", children: parseInline(text.slice(i + 2, close)) });
          resumeAt(close + 2);
          continue;
        }
      }
      // Italic: *text*
      const close = nextStar(i + 1);
      if (close > i + 1) {
        flushText(i);
        nodes.push({ type: "italic", children: parseInline(text.slice(i + 1, close)) });
        resumeAt(close + 1);
        continue;
      }
    }

    // Plain character, or a stray unbalanced marker kept literally
    i++;
  }

  flushText(text.length);
  return nodes;
}

/**
 * Pure parser that converts input richtext string into an AST of permitted safe nodes (D20).
 * Never emits raw HTML or executable scripts.
 */
export function parseRichtext(src: string): BlockNode[] {
  if (!src || typeof src !== "string") return [];

  // Sanitize out raw HTML to prevent injection
  const sanitized = stripHtml(src);
  const lines = sanitized.split(/\r?\n/);
  const blocks: BlockNode[] = [];

  let currentList: { ordered: boolean; items: ListItemNode[] } | null = null;
  let currentParagraphLines: string[] = [];

  const flushParagraph = () => {
    if (currentParagraphLines.length > 0) {
      const pText = currentParagraphLines.join(" ").trim();
      if (pText.length > 0) {
        blocks.push({
          type: "paragraph",
          children: parseInline(pText),
        });
      }
      currentParagraphLines = [];
    }
  };

  const flushList = () => {
    if (currentList) {
      blocks.push({
        type: "list",
        ordered: currentList.ordered,
        items: currentList.items,
      });
      currentList = null;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    // Unordered list item: - or *
    const unorderedMatch = line.match(/^(\s*)[-*]\s+(.+)$/);
    if (unorderedMatch) {
      flushParagraph();
      if (!currentList || currentList.ordered) {
        flushList();
        currentList = { ordered: false, items: [] };
      }
      currentList.items.push({
        type: "listItem",
        children: parseInline(unorderedMatch[2]),
      });
      continue;
    }

    // Ordered list item: 1. 2.
    const orderedMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);
    if (orderedMatch) {
      flushParagraph();
      if (!currentList || !currentList.ordered) {
        flushList();
        currentList = { ordered: true, items: [] };
      }
      currentList.items.push({
        type: "listItem",
        children: parseInline(orderedMatch[2]),
      });
      continue;
    }

    // Standard text line for paragraph
    flushList();
    currentParagraphLines.push(trimmed);
  }

  flushParagraph();
  flushList();

  return blocks;
}
