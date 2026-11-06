import { createElement, type ComponentType } from "react";
import type { TemplateKey } from "@/lib/templates/registry";
import { resolveTemplateKey } from "@/lib/templates/resolve";
import type { TemplateProps } from "@/lib/templates/types";
import { ClassicTemplate } from "./classic-template";
import { SpotlightTemplate } from "./spotlight-template";

/** Record<TemplateKey, ...> makes the compiler fail when a registry key has no component. */
const COMPONENTS: Record<TemplateKey, ComponentType<TemplateProps>> = {
  classic: ClassicTemplate,
  spotlight: SpotlightTemplate,
};

/** Unknown or removed keys render the default template instead of crashing the storefront. */
export function getTemplateComponent(key: string | null | undefined): ComponentType<TemplateProps> {
  return COMPONENTS[resolveTemplateKey(key)];
}

/**
 * Renders the template for `templateKey`. Callers use this instead of picking a component during render
 * (which React's static-components rule forbids); it is the one place that maps a key to its component.
 */
export function TemplateView({ templateKey, store, settings }: TemplateProps & { templateKey: string | null | undefined }) {
  return createElement(COMPONENTS[resolveTemplateKey(templateKey)], { store, settings });
}
