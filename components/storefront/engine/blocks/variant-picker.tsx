"use client";

import { useState } from "react";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext, ProductDetailData } from "../types";
import { resolveVariant } from "@/lib/templates/variant-selection";
import { blockMarkers } from "../markers";

interface VariantPickerProps {
  node: ComponentNode;
  context: RenderContext;
  blockId?: string;
}

export function VariantPickerBlock({ node, context, blockId }: VariantPickerProps) {
  const product = context.resource as ProductDetailData | undefined;
  const options = product?.options ?? [];
  const variants = product?.variants ?? [];

  const [internalSelection, setInternalSelection] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const opt of options) {
      if (opt.values && opt.values.length > 0) {
        initial[opt.name] = opt.values[0];
      }
    }
    return initial;
  });

  const selectedOptions = context.selectedOptions ?? internalSelection;
  const pickerType = (node.settings?.pickerType as string) ?? "pills";
  const showSku = Boolean(node.settings?.showSku ?? true);

  const matchedVariant = resolveVariant(variants, selectedOptions);
  const activeSku = matchedVariant?.sku ?? product?.sku;

  const handleSelect = (optionName: string, value: string) => {
    const updated = { ...selectedOptions, [optionName]: value };
    setInternalSelection(updated);
    if (context.onSelectOption) {
      context.onSelectOption(optionName, value);
    }
  };

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = blockMarkers(blockId, isPreview, node);

  if (!options || options.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4 py-2" {...sfProps}>
      {options.map((option) => (
        <div key={option.id || option.name} className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            {option.name}: <span className="font-normal text-muted-foreground">{selectedOptions[option.name] ?? "None"}</span>
          </label>

          {pickerType === "dropdown" ? (
            <select
              value={selectedOptions[option.name] ?? ""}
              onChange={(e) => handleSelect(option.name, e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus:outline-hidden focus:ring-1 focus:ring-ring"
            >
              {option.values.map((val) => (
                <option key={val} value={val}>
                  {val}
                </option>
              ))}
            </select>
          ) : (
            <div className="flex flex-wrap gap-2">
              {option.values.map((val) => {
                const isSelected = selectedOptions[option.name] === val;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleSelect(option.name, val)}
                    className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:bg-muted"
                    }`}
                  >
                    {val}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}

      {showSku && activeSku ? (
        <p className="text-xs text-muted-foreground">
          SKU: <span className="font-mono">{activeSku}</span>
        </p>
      ) : null}
    </div>
  );
}
