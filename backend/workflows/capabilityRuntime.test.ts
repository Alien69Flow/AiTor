import assert from "node:assert/strict";
import test from "node:test";
import { buildCapabilityPlan, detectCapabilities } from "./capabilityRuntime.ts";

test("detects development capability", () => {
  assert.deepEqual(detectCapabilities("fix a bug and design the API"), ["development"]);
});

test("detects security capability", () => {
  assert.deepEqual(detectCapabilities("run a security audit"), ["security"]);
});

test("detects social capability", () => {
  assert.deepEqual(detectCapabilities("generate LinkedIn posts"), ["social"]);
});

test("builds a multi-capability plan", () => {
  const plan = buildCapabilityPlan(
    "fix the code, run a security audit and create LinkedIn posts",
  );

  assert.deepEqual(
    plan.steps.map((step) => step.tool?.name),
    ["capability.development", "capability.security", "capability.social"],
  );
  assert.equal(plan.steps.length, 3);
});
