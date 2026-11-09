import React from "react";
import { parseRichtext, type BlockNode, type InlineNode, type ListItemNode } from "@/lib/templates/engine/richtext";

function renderInlineNode(node: InlineNode, key: number | string): React.ReactNode {
  switch (node.type) {
    case "text":
      return node.value;
    case "bold":
      return (
        <strong key={key} className="font-semibold">
          {node.children.map((child, i) => renderInlineNode(child, i))}
        </strong>
      );
    case "italic":
      return (
        <em key={key} className="italic">
          {node.children.map((child, i) => renderInlineNode(child, i))}
        </em>
      );
    case "link":
      return (
        <a
          key={key}
          href={node.href}
          className="underline hover:text-primary transition-colors"
          rel="noopener noreferrer"
        >
          {node.children.map((child, i) => renderInlineNode(child, i))}
        </a>
      );
    default:
      return null;
  }
}

function renderListItem(item: ListItemNode, key: number | string): React.ReactNode {
  return <li key={key}>{item.children.map((child, i) => renderInlineNode(child, i))}</li>;
}

function renderBlockNode(block: BlockNode, key: number | string): React.ReactNode {
  switch (block.type) {
    case "paragraph":
      return (
        <p key={key} className="leading-relaxed">
          {block.children.map((child, i) => renderInlineNode(child, i))}
        </p>
      );
    case "list":
      if (block.ordered) {
        return (
          <ol key={key} className="list-decimal pl-6 space-y-1">
            {block.items.map((item, i) => renderListItem(item, i))}
          </ol>
        );
      }
      return (
        <ul key={key} className="list-disc pl-6 space-y-1">
          {block.items.map((item, i) => renderListItem(item, i))}
        </ul>
      );
    default:
      return null;
  }
}

export function RichText({ content, className }: { content: string; className?: string }) {
  if (!content) return null;
  const nodes = parseRichtext(content);
  return (
    <div className={`space-y-3 ${className ?? ""}`}>
      {nodes.map((node, i) => renderBlockNode(node, i))}
    </div>
  );
}
