import { test } from "node:test";
import assert from "node:assert/strict";

import { isExcludedKeyword } from "@/lib/specialists/_lib/keyword-rules.ts";

test("competitor brand exclusions do not remove generic service keywords", () => {
  const exclusions = [
    { keyword: "bell limo", match: "contains" as const },
    { keyword: "las vegas party bus limo", match: "exact" as const },
  ];
  assert.equal(isExcludedKeyword("bell limo las vegas", exclusions), true);
  assert.equal(isExcludedKeyword("las vegas party bus limo", exclusions), true);
  assert.equal(isExcludedKeyword("las vegas party bus", exclusions), false);
  assert.equal(isExcludedKeyword("las vegas limo service", exclusions), false);
});
