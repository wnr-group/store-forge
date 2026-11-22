import { t } from "@/lib/i18n/messages";

/**
 * The message shown when a countdown has ended. A PROTECTED part: the renderer draws it outside the section's style and display
 * wrappers (see `renderSectionComponent`), so a style override or a device rule cannot hide or restyle it. It has no style hook of
 * its own and no `data-sf-ov`; its colours come from fixed theme tokens.
 */
export function CountdownEndMessage({ message, sectionId, preview }: { message: string; sectionId?: string; preview?: boolean }) {
  return (
    <section className="w-full bg-[var(--surface,var(--muted))]" data-sf-protected="countdown-end-message" {...(preview && sectionId ? { "data-sf-section": sectionId } : {})}>
      <div className="mx-auto w-full max-w-[var(--sf-page-width,80rem)] px-4 py-6 text-center sm:px-6 lg:px-8">
        <p className="text-base font-medium text-foreground" role="status">{message}</p>
      </div>
    </section>
  );
}

export const COUNTDOWN_UNIT_KEYS = ["countdown.unit.days", "countdown.unit.hours", "countdown.unit.minutes", "countdown.unit.seconds"] as const;
export const unitLabel = (i: number): string => t(COUNTDOWN_UNIT_KEYS[i]);
