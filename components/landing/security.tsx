import { Activity, ArrowRight, Check, Database, KeyRound, Lock, Minus, Server, ShieldCheck, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Fade, LineDraw, SlideIn, Wipe } from "./effects";
import { Container, Section } from "./ui";

const HIGHLIGHTS: { icon: LucideIcon; text: string }[] = [
  { icon: KeyRound, text: "Secure authentication for every account" },
  { icon: Users, text: "Access that follows each person's role" },
  { icon: Database, text: "Business data kept separate and protected" },
];

/** The six areas, written without certifications, uptime figures, encryption standards or backup claims. */
const FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: KeyRound, title: "Secure Authentication", text: "Help protect access to business accounts through secure authentication mechanisms." },
  { icon: ShieldCheck, title: "Role-Based Access Control", text: "Give team members access according to their responsibilities, where supported by the platform." },
  { icon: Database, title: "Protected Business Data", text: "Keep important store and operational information protected through appropriate application and database security practices." },
  { icon: Lock, title: "Secure API Communication", text: "Use secure communication between the frontend and backend services." },
  { icon: Users, title: "Controlled Team Access", text: "Make it easier to manage who can access different areas of your business." },
  { icon: Server, title: "Reliable Infrastructure", text: "Build on a dependable technical foundation designed to support everyday store operations." },
];

const SUPPORT: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Users, title: "Access Management", text: "Control access according to user responsibilities." },
  { icon: Database, title: "Data Protection", text: "Apply appropriate safeguards to business information." },
  { icon: Activity, title: "Operational Reliability", text: "Support consistent day-to-day store management." },
];

const Dot = ({ className }: { className?: string }) => <span aria-hidden className={cn("size-1.5 rounded-full bg-emerald-500", className)} />;

function Panel({ title, icon: Icon, children, className }: { title: string; icon: LucideIcon; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-lp-border bg-white p-4 shadow-[0_1px_2px_rgba(18,40,31,0.04)] sm:p-5", className)}>
      <div className="flex items-center gap-2.5">
        <span className="grid size-8 place-items-center rounded-lg bg-lp-soft text-lp-primary">
          <Icon className="size-4" strokeWidth={1.75} />
        </span>
        <p className="text-sm font-semibold text-lp-heading">{title}</p>
      </div>
      {children}
    </div>
  );
}

/**
 * A product-style security panel. It only illustrates things the app really does: accounts that must sign in, the
 * Owner / Manager / Staff roles, and each company's data kept apart from every other company's. Labels are samples.
 */
function SecurityVisual() {
  const protection = ["Secure sign-in", "Role-based access", "Company data isolation"];
  const team: { role: string; initials: string; settings: boolean; team: boolean }[] = [
    { role: "Owner", initials: "O", settings: true, team: true },
    { role: "Manager", initials: "M", settings: true, team: false },
    { role: "Staff", initials: "S", settings: false, team: false },
  ];
  return (
    <div aria-hidden className="rounded-2xl border border-lp-border bg-lp-bg p-3 sm:p-5">
      <SlideIn x={0} y={-28}>
      <Panel title="Access protection" icon={ShieldCheck}>
        <ul className="mt-4 divide-y divide-lp-border">
          {protection.map((p) => (
            <li key={p} className="flex items-center justify-between py-2.5 text-[13px] text-lp-heading">
              {p}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-600/15 ring-inset">
                <Dot />
                Enabled
              </span>
            </li>
          ))}
        </ul>
      </Panel>
      </SlideIn>

      {/* Connectors from the overview down to the two panels below */}
      <div className="grid grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="flex flex-col items-center">
            <LineDraw axis="y" delay={0.35} className="h-5 w-px" lineClassName="bg-lp-border" />
            <Fade as="span" delay={0.7} className="size-1.5 rounded-full bg-lp-primary/40" />
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <SlideIn x={0} y={36} delay={0.55}>
        <Panel title="Team access" icon={Users}>
          <div className="mt-4 grid grid-cols-[1fr_auto_auto] items-center gap-x-4 gap-y-2.5 text-[12px]">
            <span />
            <span className="text-center text-[10px] text-lp-text">Settings</span>
            <span className="text-center text-[10px] text-lp-text">Team</span>
            {team.map((m) => (
              <div key={m.role} className="contents">
                <span className="flex items-center gap-2 font-medium text-lp-heading">
                  <span className="grid size-6 place-items-center rounded-full bg-lp-soft text-[10px] font-semibold text-lp-primary">{m.initials}</span>
                  {m.role}
                </span>
                {[m.settings, m.team].map((on, i) => (
                  <span key={i} className={cn("mx-auto grid size-5 place-items-center rounded-full", on ? "bg-lp-primary/10 text-lp-primary" : "bg-lp-soft text-lp-text/50")}>
                    {on ? <Check className="size-3" strokeWidth={2.5} /> : <Minus className="size-3" strokeWidth={2} />}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </Panel>
        </SlideIn>

        <SlideIn x={0} y={36} delay={0.7}>
        <Panel title="Protected data" icon={Database}>
          <ul className="mt-4 space-y-2.5 text-[12px]">
            <li className="flex items-center justify-between rounded-lg border border-lp-border px-3 py-2.5">
              <span className="font-medium text-lp-heading">Your company</span>
              <span className="inline-flex items-center gap-1.5 text-emerald-700">
                <Dot />
                Accessible
              </span>
            </li>
            <li className="flex items-center justify-between rounded-lg border border-dashed border-lp-border bg-lp-bg/60 px-3 py-2.5">
              <span className="text-lp-text">Other companies</span>
              <span className="inline-flex items-center gap-1.5 text-lp-text">
                <Lock className="size-3" strokeWidth={2} />
                Separate
              </span>
            </li>
          </ul>
          <p className="mt-3 text-[11px] leading-4 text-lp-text">Each company&apos;s data stays apart from every other company&apos;s.</p>
        </Panel>
        </SlideIn>
      </div>
    </div>
  );
}

export function Security() {
  return (
    <Section id="security" className="bg-white py-24 sm:py-32">
      <Container>
        <div className="grid items-center gap-14 lg:grid-cols-[5fr_6fr] lg:gap-16">
          <Fade duration={1.4}>
            <p className="text-sm font-medium tracking-wide text-lp-primary">SECURITY &amp; RELIABILITY</p>
            <h2 className="mt-3 text-4xl leading-[1.1] font-semibold tracking-tight text-balance text-lp-heading sm:text-[2.6rem]">Your business deserves a secure foundation.</h2>
            <span aria-hidden className="mt-6 block h-0.5 w-14 bg-lp-primary" />
            <p className="mt-6 max-w-md text-base leading-7 text-pretty text-lp-text sm:text-lg sm:leading-8">
              Your store operations and business information matter. StoreForge is designed with security-conscious architecture and controlled access to help you manage your business with confidence.
            </p>
            <ul className="mt-8 space-y-4">
              {HIGHLIGHTS.map((h) => (
                <li key={h.text} className="flex items-center gap-3.5 text-[15px] font-medium text-lp-heading">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-lp-border bg-lp-bg text-lp-primary">
                    <h.icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
                  </span>
                  {h.text}
                </li>
              ))}
            </ul>
            <a
              href="#features"
              className="group mt-8 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-lp-primary outline-none transition-colors duration-300 hover:text-lp-primary-hover focus-visible:ring-2 focus-visible:ring-lp-primary focus-visible:ring-offset-2"
            >
              Explore how StoreForge works
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" aria-hidden />
            </a>
          </Fade>
          <SecurityVisual />
        </div>

        <ul className="mt-20 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:mt-28 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <li key={f.title} className="relative pt-6">
              <LineDraw delay={(i % 3) * 0.12} className="absolute top-0 left-0 h-px w-full" lineClassName="bg-lp-border" />
              <Fade delay={0.3 + (i % 3) * 0.12}>
              <span className="grid size-10 place-items-center rounded-lg border border-lp-border bg-lp-bg text-lp-primary">
                <f.icon className="size-5" strokeWidth={1.75} aria-hidden />
              </span>
              <h3 className="mt-4 text-lg font-semibold tracking-tight text-lp-heading">{f.title}</h3>
              <p className="mt-2 text-[15px] leading-6 text-lp-text">{f.text}</p>
              </Fade>
            </li>
          ))}
        </ul>

        <Wipe className="mt-16 lg:mt-20">
          <ul className="grid divide-y divide-lp-border overflow-hidden rounded-2xl border border-lp-border bg-lp-bg sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {SUPPORT.map((s) => (
              <li key={s.title} className="flex items-start gap-4 p-6 sm:p-7">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white text-lp-primary ring-1 ring-lp-border">
                  <s.icon className="size-5" strokeWidth={1.75} aria-hidden />
                </span>
                <div>
                  <h3 className="text-[15px] font-semibold text-lp-heading">{s.title}</h3>
                  <p className="mt-1 text-sm leading-5 text-lp-text">{s.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </Wipe>
      </Container>
    </Section>
  );
}
