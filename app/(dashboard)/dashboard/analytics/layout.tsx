import { FeatureGate } from "@/components/billing/feature-gate";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <FeatureGate feature="advanced_reports">{children}</FeatureGate>;
}
