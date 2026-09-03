import { test } from "node:test";
import assert from "node:assert/strict";

import { resolveLocale } from "@/lib/specialists/_lib/locale.ts";
import type { ClientManifest } from "@/lib/brain/types.ts";

test("normalizes DataForSEO city location names", () => {
  const manifest = {
    locale: {
      location_code: 1022639,
      labs_location_code: 2840,
      location_name: "Las Vegas, Nevada, United States",
      language_name: "English",
    },
  } as ClientManifest;
  assert.equal(
    resolveLocale(manifest).location_name,
    "Las Vegas,Nevada,United States",
  );
  assert.equal(resolveLocale(manifest).location_code, 1022639);
  assert.equal(resolveLocale(manifest).labs_location_code, 2840);
});
