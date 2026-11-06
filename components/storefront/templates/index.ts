import type { ComponentType } from "react";
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
