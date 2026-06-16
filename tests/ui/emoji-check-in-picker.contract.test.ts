import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const pickerPath = resolve(process.cwd(), "src/components/emoji-check-in/EmojiCheckInPicker.astro");
const pickerSource = readFileSync(pickerPath, "utf8");

describe("EmojiCheckInPicker markup contract", () => {
  it("keeps the picker as a native checkbox form instead of a JS-only interaction surface", () => {
    expect(pickerSource).toContain('<label class="block cursor-pointer" for={optionId}>');
    expect(pickerSource).toContain('type="checkbox"');
    expect(pickerSource).toContain('name="emojis"');
    expect(pickerSource).toContain("data-emoji-checkbox");
    expect(pickerSource).toContain('querySelectorAll("input[data-emoji-checkbox]")');
  });

  it("does not render option descriptions in the picker cards", () => {
    expect(pickerSource).toContain("aria-label={option.label}");
    expect(pickerSource).not.toContain("option.description");
  });

  it("keeps the selection and submit guardrails in the inline enhancement script", () => {
    expect(pickerSource).toContain('data-max-selections="3"');
    expect(pickerSource).toContain("submitButton.disabled = count === 0;");
    expect(pickerSource).toContain("if (selectedCount > maxSelections)");
    expect(pickerSource).toContain("target.checked = false;");
  });
});
