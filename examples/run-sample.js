import { allocateRound } from "../src/engine/allocate-round.js";

// Fixture data only — NOT KEA policy.
const rule = (code, precedence, requires) => ({
  code,
  dimension: "VERTICAL",
  precedence,
  requires,
  requiresVerification: false,
  claims: { debits: [{ seatTypeCode: code }], destinationConditions: [] },
});

const candidate = (id, rank, verticalCategory, prefs) => ({
  id,
  rank,
  status: "ACTIVE",
  verticalCategory,
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
});

const seat = (id, collegeId, branchId, seatTypeCode, total) => ({
  id,
  collegeId,
  branchId,
  seatTypeCode,
  totalSeats: total,
  availableSeats: total,
  attributes: {},
});

const context = {
  roundId: "R1",
  academicYear: "2026-27",
  snapshotId: "sample-001",
  ruleSet: {
    id: "sample",
    version: "1",
    strategy: "ORDERED_FIRST_FIT",
    inventoryMode: "DISJOINT_POOLS",
    candidateAttributes: {},
    poolAttributes: {},
    rules: [
      rule("OPEN", 10, []),
      rule("CAT_A", 20, [{ field: "verticalCategory", op: "EQ", value: "A" }]),
    ],
  },
  candidates: [
    candidate("S3", 300, "GM", [
      ["C1", "CS"],
      ["C2", "CS"],
    ]),
    candidate("S1", 100, "GM", [["C1", "CS"]]),
    candidate("S4", 400, "A", [["C1", "CS"]]),
    candidate("S2", 200, "A", [
      ["C1", "CS"],
      ["C2", "CS"],
    ]),
  ],
  seatPools: [
    seat("P1", "C1", "CS", "OPEN", 1),
    seat("P2", "C1", "CS", "CAT_A", 1),
    seat("P3", "C2", "CS", "OPEN", 2),
  ],
};

const result = allocateRound(context);

console.log("Decisions (processed in rank order):");
console.table(
  result.decisions.map((d) => ({
    candidate: d.candidateId,
    rank: d.rank,
    outcome: d.outcome,
    reason: d.reasonCode,
    pool: d.allocation?.seatPoolId ?? "-",
    seatType: d.allocation?.seatTypeCode ?? "-",
    preference: d.allocation?.preferenceOrder ?? "-",
  })),
);

console.log("Remaining seats:");
console.table(result.remainingSeatPools);

console.log("Counters:", JSON.stringify(result.counters));
