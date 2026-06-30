import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const BONDIFY_SRC = fileURLToPath(new URL("../../src/lib/services/bondify.ts", import.meta.url));

// Sanctioned inline .select("...") string literals that contain removed_at.
// These live inside the seam helpers and are deliberately allowed.
// Any new inline removed_at select outside these helpers must go through
// findActiveMembershipByTeamAndProfile (bondify.ts:452) or
// hasActiveMembershipForNormalizedEmail (bondify.ts:487) instead.
const SANCTIONED_INLINE_SELECTS = new Set(["id, removed_at, profile:profiles!inner(normalized_email)"]);

describe("team-membership-query-guard", () => {
  it("all removed_at membership selects use the sanctioned seam helpers", () => {
    const source = readFileSync(BONDIFY_SRC, "utf-8");

    // Find every .select("...") call whose argument is an inline string literal
    // containing removed_at. Variable-reference selects (e.g. .select(CONSTANT))
    // are not matched and are implicitly safe — the constants themselves are the seam.
    const pattern = /\.select\("([^"]+)"\)/g;
    const violations: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(source)) !== null) {
      const arg = match[1];
      if (arg.includes("removed_at") && !SANCTIONED_INLINE_SELECTS.has(arg)) {
        violations.push(arg);
      }
    }

    expect(
      violations,
      violations.length > 0
        ? `Found ${violations.length} unsanctioned removed_at membership select(s):\n` +
            violations.map((v) => `  • "${v}"`).join("\n") +
            "\n\nDo not query removed_at directly. Use the compatibility seam instead:\n" +
            "  • findActiveMembershipByTeamAndProfile (bondify.ts:452)\n" +
            "  • hasActiveMembershipForNormalizedEmail (bondify.ts:487)"
        : "",
    ).toHaveLength(0);
  });
});
