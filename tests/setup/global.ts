import type { TestProject } from "vitest/node";
import { ensureLocalSupabaseTestEnv } from "../helpers/supabase-env";

export default function globalSetup(_project: TestProject) {
  ensureLocalSupabaseTestEnv();
}
