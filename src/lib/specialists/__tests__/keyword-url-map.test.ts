import { test } from "node:test";
import assert from "node:assert/strict";

import {
  assignKeywordUrl,
  isExcludedKeyword,
} from "@/lib/specialists/_lib/keyword-rules.ts";

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

test("an approved map prevents token-overlap from inventing page ownership", () => {
  const approved = [{
    keyword: "party bus",
    match: "contains" as const,
    url: "/party-bus-las-vegas/",
  }];
  const candidates = ["/party-bus-las-vegas/", "/wedding-limo-las-vegas/"];
  assert.equal(
    assignKeywordUrl("las vegas party bus", candidates, approved),
    "/party-bus-las-vegas/",
  );
  assert.equal(
    assignKeywordUrl("las vegas stretch limo service", candidates, approved),
    "/",
  );
});
