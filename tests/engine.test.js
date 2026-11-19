import test from "node:test";
import assert from "node:assert/strict";
import { MinHeap } from "../src/structures/min-heap.js";
import { allocateRound } from "../src/engine/allocate-round.js";

// Fixture rules only — NOT KEA policy.
const OPEN_RULE = {
  code: "OPEN",
  dimension: "VERTICAL",
  precedence: 10,
  requires: [],
  requiresVerification: false,
  claims: { debits: [{ seatTypeCode: "OPEN" }], destinationConditions: [] },
};
const CAT_A_RULE = {
  code: "CAT_A",
  dimension: "VERTICAL",
  precedence: 20,
  requires: [{ field: "verticalCategory", op: "EQ", value: "A" }],
  requiresVerification: false,
  claims: { debits: [{ seatTypeCode: "CAT_A" }], destinationConditions: [] },
};

function context(candidates, seatPools, rules = [OPEN_RULE, CAT_A_RULE]) {
  return {
    roundId: "R1",
    academicYear: "2026-27",
    snapshotId: "snap-1",
    ruleSet: {
      id: "fixture",
      version: "1",
      strategy: "ORDERED_FIRST_FIT",
      inventoryMode: "DISJOINT_POOLS",
      candidateAttributes: {},
      poolAttributes: {},
      rules,
    },
    candidates,
    seatPools,
  };
}

function candidate(id, rank, prefs, overrides = {}) {
  return {
    id,
    rank,
    status: "ACTIVE",
    verticalCategory: "GM",
    horizontalGroups: [],
    eligibilityGroups: [],
    attributes: {},
    verificationStatus: "VERIFIED",
    preferencesLocked: true,
    preferences: prefs.map(([collegeId, branchId], i) => ({
      collegeId,
      branchId,
      preferenceOrder: i + 1,
    })),
    currentHolding: null,
    ...overrides,
  };
}

function seat(id, collegeId, branchId, seatTypeCode, total, available = total) {
  return {
    id,
    collegeId,
    branchId,
    seatTypeCode,
    totalSeats: total,
    availableSeats: available,
    attributes: {},
  };
}

test("min-heap pops in ascending order", () => {
  const heap = MinHeap.from([5, 1, 4, 2, 3], (a, b) => a - b);
  heap.push(0);
  const out = [];
  while (heap.size > 0) out.push(heap.pop());
  assert.deepEqual(out, [0, 1, 2, 3, 4, 5]);
});

test("better rank gets the last seat regardless of input order", () => {
  const ctx = context(
    [
      candidate("S2", 200, [["C1", "CS"]]),
      candidate("S1", 100.5, [["C1", "CS"]]),
    ],
    [seat("P1", "C1", "CS", "OPEN", 1)],
  );
  const out = allocateRound(ctx);
  assert.deepEqual(
    out.decisions.map((d) => [d.candidateId, d.outcome]),
    [
      ["S1", "ALLOTTED"],
      ["S2", "UNALLOCATED"],
    ],
  );
  assert.equal(out.decisions[1].reasonCode, "NO_AVAILABLE_SEAT");
  assert.equal(out.remainingSeatPools[0].availableSeats, 0);
  assert.deepEqual(out.counters, {
    candidates: 2,
    byOutcome: { ALLOTTED: 1, UNALLOCATED: 1, SKIPPED: 0 },
  });
});

test("falls through to the next preference when the first is full", () => {
  const ctx = context(
    [
      candidate("S1", 100, [
        ["C1", "CS"],
        ["C2", "CS"],
      ]),
    ],
    [seat("P1", "C1", "CS", "OPEN", 1, 0), seat("P2", "C2", "CS", "OPEN", 1)],
  );
  const d = allocateRound(ctx).decisions[0];
  assert.equal(d.allocation.seatPoolId, "P2");
  assert.equal(d.allocation.preferenceOrder, 2);
});

test("reserved seat at preference 1 beats open seat at preference 2", () => {
  const ctx = context(
    [
      candidate(
        "S1",
        100,
        [
          ["C1", "CS"],
          ["C2", "CS"],
        ],
        { verticalCategory: "A" },
      ),
    ],
    [
      seat("P1", "C1", "CS", "OPEN", 1, 0),
      seat("P2", "C1", "CS", "CAT_A", 1),
      seat("P3", "C2", "CS", "OPEN", 1),
    ],
  );
  const d = allocateRound(ctx).decisions[0];
  assert.equal(d.allocation.seatPoolId, "P2");
  assert.equal(d.allocation.ruleCode, "CAT_A");
});

test("within one preference, rule precedence decides", () => {
  const ctx = context(
    [candidate("S1", 100, [["C1", "CS"]], { verticalCategory: "A" })],
    [seat("P1", "C1", "CS", "OPEN", 1), seat("P2", "C1", "CS", "CAT_A", 1)],
  );
  const d = allocateRound(ctx).decisions[0];
  assert.equal(d.allocation.ruleCode, "OPEN");
  assert.equal(d.allocation.rosterPriority, 0);
});

test("candidate meeting no rule is UNALLOCATED with NO_ELIGIBLE_RULE", () => {
  const ctx = context(
    [candidate("S1", 100, [["C1", "CS"]])],
    [seat("P1", "C1", "CS", "CAT_A", 1)],
    [CAT_A_RULE],
  );
  const d = allocateRound(ctx).decisions[0];
  assert.equal(d.outcome, "UNALLOCATED");
  assert.equal(d.reasonCode, "NO_ELIGIBLE_RULE");
});

test("withdrawn and unlocked candidates are SKIPPED and use no seat", () => {
  const ctx = context(
    [
      candidate("S1", 100, [["C1", "CS"]], { status: "WITHDRAWN" }),
      candidate("S2", 200, [["C1", "CS"]], { preferencesLocked: false }),
    ],
    [seat("P1", "C1", "CS", "OPEN", 1)],
  );
  const out = allocateRound(ctx);
  assert.deepEqual(
    out.decisions.map((d) => d.reasonCode),
    ["WITHDRAWN", "PREFERENCES_NOT_LOCKED"],
  );
  assert.equal(out.remainingSeatPools[0].availableSeats, 1);
});

test("does not mutate input and is deterministic", () => {
  const ctx = context(
    [
      candidate("S2", 200, [["C1", "CS"]]),
      candidate("S1", 100, [["C1", "CS"]]),
    ],
    [seat("P1", "C1", "CS", "OPEN", 1)],
  );
  const before = structuredClone(ctx);
  const first = allocateRound(ctx);
  const second = allocateRound(ctx);
  assert.deepEqual(ctx, before);
  assert.deepEqual(first, second);
});

test("rejects invalid and duplicate ranks", () => {
  const pools = [seat("P1", "C1", "CS", "OPEN", 1)];
  assert.throws(
    () => allocateRound(context([candidate("S1", "100", [])], pools)),
    { code: "INVALID_RANK" },
  );
  assert.throws(() => allocateRound(context([candidate("S1", 0, [])], pools)), {
    code: "INVALID_RANK",
  });
  assert.throws(
    () =>
      allocateRound(
        context([candidate("S1", 100, []), candidate("S2", 100, [])], pools),
      ),
    { code: "DUPLICATE_RANK" },
  );
});

test("rejects candidates with holdings until upgrades are implemented", () => {
  const ctx = context(
    [
      candidate("S1", 100, [["C1", "CS"]], {
        currentHolding: { allocationId: "A1" },
      }),
    ],
    [seat("P1", "C1", "CS", "OPEN", 1, 0)],
  );
  assert.throws(() => allocateRound(ctx), { code: "UNSUPPORTED_HOLDING" });
});
