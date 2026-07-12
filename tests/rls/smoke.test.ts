import { describe, expect, it } from "vitest";
import { adminClient } from "../helpers/clients";

const REQUIRED_TEMPLATE_SLUGS = ["emoji-check-in", "rose-thorn-bud", "two-truths-and-a-lie", "how-i-work"] as const;

interface GameTemplateSlugRow {
  slug: string;
}

describe("local supabase smoke", () => {
  it("exposes the seeded game template catalog", async () => {
    const supabase = adminClient();

    const { data, error } = await supabase.from("game_templates").select("slug").order("slug");
    const rows = (data ?? []) as GameTemplateSlugRow[];
    const slugs = rows.map((row) => row.slug);

    expect(error).toBeNull();
    expect(slugs).toEqual(expect.arrayContaining([...REQUIRED_TEMPLATE_SLUGS]));
    expect(rows).toHaveLength(REQUIRED_TEMPLATE_SLUGS.length);
  });
});
