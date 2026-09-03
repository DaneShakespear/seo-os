import { after, before, test } from "node:test";
import assert from "node:assert/strict";

let originalFetch: typeof globalThis.fetch;

before(() => {
  originalFetch = globalThis.fetch;
  process.env.DATAFORSEO_LOGIN = "test-login";
  process.env.DATAFORSEO_PASSWORD = "test-password";
});

after(() => {
  globalThis.fetch = originalFetch;
  delete process.env.DATAFORSEO_LOGIN;
  delete process.env.DATAFORSEO_PASSWORD;
});

test("rejects a failed DataForSEO task even when the response status is OK", async () => {
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        status_code: 20000,
        status_message: "Ok.",
        cost: 0,
        tasks: [{
          id: "task-1",
          status_code: 40501,
          status_message: "Invalid Field: location_name",
          cost: 0,
          result: null,
        }],
      }),
      { status: 200 },
    );
  const { post } = await import("@/lib/integrations/dataforseo.ts");
  await assert.rejects(
    post("/v3/test", { location_name: "invalid" }),
    /task.*40501.*Invalid Field/i,
  );
});

test("uses per-task cost when the top-level response omits cost", async () => {
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        status_code: 20000,
        status_message: "Ok.",
        cost: 0,
        tasks: [{
          id: "task-1",
          status_code: 20000,
          status_message: "Ok.",
          cost: 0.0042,
          result: [],
        }],
      }),
      { status: 200 },
    );
  const { post } = await import("@/lib/integrations/dataforseo.ts");
  const result = await post("/v3/test", {});
  assert.equal(result.cost, 0.0042);
});
