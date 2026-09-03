import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/brain/index-db";
import { vaultsRoot } from "@/lib/brain/paths";
import { envValue } from "@/lib/setup/env-local";

export const dynamic = "force-dynamic";

interface ScheduledClient {
  slug: string;
  enabled: boolean;
  disabled_reason?: string | null;
  authority_status?: string;
  last_clean_review?: string | null;
  next_allowed_run?: string | null;
}

interface ReviewSummary {
  generated_at?: string;
  high_severity?: number;
  medium_severity?: number;
  verdict?: string;
}

export async function GET() {
  const checks: Record<string, unknown> = {};
  let coreHealthy = true;

  try {
    getDb().prepare("SELECT 1 AS ok").get();
    checks.database = { ok: true };
  } catch (error) {
    coreHealthy = false;
    checks.database = { ok: false, error: safeMessage(error) };
  }

  const root = vaultsRoot();
  const vaults = fs.existsSync(root)
    ? fs.readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory())
    : [];
  checks.vaults = { ok: fs.existsSync(root), count: vaults.length };
  if (!fs.existsSync(root)) coreHealthy = false;

  checks.providers = {
    dataforseo: Boolean(envValue("DATAFORSEO_LOGIN") && envValue("DATAFORSEO_PASSWORD")),
    google: Boolean(envValue("GOOGLE_API_KEY") || envValue("SEO_OFFICE_GCLOUD_CLIENT_ID_FILE")),
    llm: Boolean(envValue("SEO_OFFICE_LLM_PROVIDER") || envValue("ANTHROPIC_API_KEY")),
  };

  const schedulePath =
    process.env.SEO_OFFICE_SCHEDULE_CONFIG ?? "/etc/seo-office/scheduled-clients.json";
  const scheduled = readScheduledClients(schedulePath);
  checks.scheduler = scheduled
    ? {
        ok: true,
        config_path: schedulePath,
        enabled: scheduled.filter((client) => client.enabled).length,
        clients: scheduled.map((client) => ({
          ...client,
          semantic_review: readReview(client.slug),
        })),
      }
    : { ok: false, config_path: schedulePath };
  if (!scheduled) coreHealthy = false;

  const updateStatusPath =
    process.env.SEO_OFFICE_UPDATE_STATUS ??
    "/home/dane/.local/state/seo-office/update-status.json";
  checks.updates = readJsonFile(updateStatusPath) ?? {
    state: "not_checked",
    message: "The release monitor has not completed its first check.",
  };

  let latestRuns: unknown[] = [];
  try {
    latestRuns = getDb()
      .prepare(
        `SELECT client_slug, id, status, result_summary, created_at, updated_at
         FROM tasks
         WHERE kind = 'sweep' AND parent_task_id IS NULL
         ORDER BY created_at DESC
         LIMIT 8`,
      )
      .all() as unknown[];
  } catch {
    // The database check above reports the actionable failure.
  }

  return NextResponse.json(
    {
      ok: coreHealthy,
      service: "seo-office",
      release:
        process.env.SEO_OFFICE_RELEASE ??
        readTextFile(path.join(process.cwd(), ".release-id")) ??
        "unknown",
      checked_at: new Date().toISOString(),
      checks,
      latest_runs: latestRuns,
    },
    { status: coreHealthy ? 200 : 503 },
  );
}

function readScheduledClients(file: string): ScheduledClient[] | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as { clients?: unknown };
    return Array.isArray(parsed.clients) ? (parsed.clients as ScheduledClient[]) : null;
  } catch {
    return null;
  }
}

function readReview(slug: string): ReviewSummary | null {
  try {
    const file = path.join(vaultsRoot(), slug, "wiki", "meta", "brain-review.json");
    return JSON.parse(fs.readFileSync(file, "utf8")) as ReviewSummary;
  } catch {
    return null;
  }
}

function readJsonFile(file: string): unknown | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function readTextFile(file: string): string | null {
  try {
    return fs.readFileSync(file, "utf8").trim() || null;
  } catch {
    return null;
  }
}

function safeMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200);
}
