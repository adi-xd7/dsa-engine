import test from "node:test";
import assert from "node:assert/strict";
import { E3Error } from "../src/errors.js";

test("E3Error stores a stable code and message", () => {
  const error = new E3Error("INVALID_CONTEXT", "Invalid allocation context");
  assert.equal(error.name, "E3Error");
  assert.equal(error.code, "INVALID_CONTEXT");
  assert.equal(error.message, "Invalid allocation context");
  assert.equal(error.details, undefined);
  assert.ok(error instanceof Error);
  assert.ok(error instanceof E3Error);
});

test("E3Error carries structured details", () => {
  const error = new E3Error("DUPLICATE_RANK", "Duplicate rank", { rank: 42 });
  assert.deepEqual(error.details, { rank: 42 });
});
