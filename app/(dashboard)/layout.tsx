import type { Metadata } from "next";
import { getActiveTenant } from "@/lib/tenant/context";

/**
 * Page titles and meta for everything a company's members see: "<Page> | <Company>" instead of the platform's
 * "<Page> | StoreForge". The company comes from the DB-verified active membership (never from the URL), and the
 * lookup is shared with the dashboard layout for the same request, so it costs no extra query.
 *
 * Signed-out visitors and users without a workspace keep the platform defaults from the root layout.
 */
export async function generateMetadata(): Promise<Metadata> {
  let company: string | null = null;
  try {
    company = (await getActiveTenant())?.tenant.name ?? null;
  } catch {
    return {};
  }
  if (!company) return {};
  return {
    title: { default: company, template: `%s | ${company}` },
    description: `${company} store dashboard`,
    applicationName: company,
    openGraph: { siteName: company },
  };
}

export default function CompanyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
