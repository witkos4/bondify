import { createClient } from "@supabase/supabase-js";
import process from "node:process";
import { describe, expect, it } from "vitest";

const REQUIRED_TEMPLATE_SLUGS = ["emoji-check-in", "rose-thorn-bud", "two-truths-and-a-lie", "how-i-work"] as const;

interface GameTemplateSlugRow {
  slug: string;
}

function requireEnv(name: "BONDIFY_TEST_SERVICE_ROLE_KEY" | "BONDIFY_TEST_SUPABASE_URL") {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required test environment variable: ${name}`);
  }

  return value;
}

describe("local supabase smoke", () => {
  it("exposes the seeded game template catalog", async () => {
    const supabase = createClient(requireEnv("BONDIFY_TEST_SUPABASE_URL"), requireEnv("BONDIFY_TEST_SERVICE_ROLE_KEY"));

    const { data, error } = await supabase.from("game_templates").select("slug").order("slug");
    const rows = (data ?? []) as GameTemplateSlugRow[];
    const slugs = rows.map((row) => row.slug);

    expect(error).toBeNull();
    expect(slugs).toEqual(expect.arrayContaining([...REQUIRED_TEMPLATE_SLUGS]));
    expect(rows).toHaveLength(REQUIRED_TEMPLATE_SLUGS.length);
  });
});
