import { CategoryImage, ImagePlaceholder } from "./category-image";

export type IndustryCategory = {
  name: string;
  text: string;
  /** Leave out to show the "Image Coming Soon" placeholder. */
  image?: string;
  alt: string;
  /** Keeps the subject in frame when the photo is cropped to the card. */
  position?: string;
};

const pad = (n: number) => String(n).padStart(2, "0");

function IndustryCard({ c, index }: { c: IndustryCategory; index: number }) {
  return (
    <article className="group relative aspect-[3/4] w-[17.5rem] shrink-0 overflow-hidden rounded-2xl border border-lp-border bg-lp-soft sm:w-80">
      {c.image ? <CategoryImage src={c.image} alt={c.alt} sizes="(min-width: 640px) 760px, 660px" position={c.position} eager /> : <ImagePlaceholder />}
      {c.image ? <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/75 via-black/30 to-transparent" /> : null}
      <span className="absolute top-4 left-4 rounded-full bg-white px-3 py-1 text-xs font-medium text-lp-heading tabular-nums shadow-sm">{pad(index + 1)}</span>
      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
        <h3 className={c.image ? "text-xl font-semibold tracking-tight text-white" : "text-xl font-semibold tracking-tight text-lp-heading"}>{c.name}</h3>
        <p className={c.image ? "mt-1.5 max-w-[16rem] text-sm leading-5 text-white/85" : "mt-1.5 max-w-[16rem] text-sm leading-5 text-lp-text"}>{c.text}</p>
      </div>
    </article>
  );
}

/**
 * Full-width strip of industry cards drifting right to left. It pauses while hovered or focused. With reduced motion
 * it does not move: it becomes a normal horizontal scroller.
 */
export function IndustriesMarquee({ categories }: { categories: readonly IndustryCategory[] }) {
  const group = (hidden: boolean) => (
    <ul aria-hidden={hidden || undefined} className={hidden ? "flex shrink-0 gap-5 pr-5 motion-reduce:hidden" : "flex shrink-0 gap-5 pr-5"}>
      {categories.map((c, i) => (
        <li key={c.name}>
          <IndustryCard c={c} index={i} />
        </li>
      ))}
    </ul>
  );

  return (
    <div>
      <div className="lp-marquee-wrap overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_7%,black_93%,transparent)] motion-reduce:snap-x motion-reduce:overflow-x-auto motion-reduce:px-4 motion-reduce:[mask-image:none]">
        <div className="lp-marquee flex w-max will-change-transform">
          {group(false)}
          {group(true)}
        </div>
      </div>
    </div>
  );
}
