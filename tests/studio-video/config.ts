import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export const CONFIG = {
  // Local endpoints
  baseUrl: process.env.E2E_BASE_URL || "http://localhost:3100",
  fallbackBaseUrl: "http://localhost:3000",
  apiUrl: process.env.API_BASE_URL || "http://localhost:4000/api/v1",

  // Test credentials (local development / demo environment only)
  ownerEmail: process.env.E2E_OWNER_EMAIL || "owner@demo.test",
  ownerPassword: process.env.E2E_DEMO_PASSWORD || "Demo1234",
  designEmail: "design-only@demo.test",
  readOnlyEmail: "read-only@demo.test",
  platformAdminEmail: process.env.E2E_PLATFORM_ADMIN_EMAIL || "platform@demo.test",

  // Demo store information
  storeSlug: "urban-nest-demo",
  storeName: "Urban Nest",

  // Artifact directories
  artifactsDir: join(process.cwd(), "artifacts", "studio-e2e"),
  videosDir: join(process.cwd(), "artifacts", "studio-e2e", "videos"),
  shotsDir: join(process.cwd(), "artifacts", "studio-e2e", "screenshots"),
  tracesDir: join(process.cwd(), "artifacts", "studio-e2e", "traces"),
  reportsDir: join(process.cwd(), "artifacts", "studio-e2e", "reports"),

  // Recording specifications
  viewport: { width: 1920, height: 1080 },
  fps: 30,
  videoCodec: "libx264",
  pixelFormat: "yuv420p",
};

export function ensureDirectories(): void {
  for (const dir of [
    CONFIG.artifactsDir,
    CONFIG.videosDir,
    CONFIG.shotsDir,
    CONFIG.tracesDir,
    CONFIG.reportsDir,
  ]) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}
