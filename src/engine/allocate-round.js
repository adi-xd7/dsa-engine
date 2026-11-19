import { E3Error } from "../errors.js";
import { MinHeap } from "../structures/min-heap.js";
import { buildSeatMap, findPool } from "../inventory/seat-map.js";
import { sortRules, resolveEligibleRules } from "../resolver/quota-resolver.js";

function checkRuleSet(ruleSet) {
  if (ruleSet.strategy !== "ORDERED_FIRST_FIT") {
    throw new E3Error(
      "UNSUPPORTED_STRATEGY",
      `Unsupported strategy ${ruleSet.strategy}`,
    );
  }
  if (ruleSet.inventoryMode !== "DISJOINT_POOLS") {
    throw new E3Error(
      "UNSUPPORTED_INVENTORY_MODE",
      `Unsupported inventory mode ${ruleSet.inventoryMode}`,
    );
  }
}

function checkCandidates(candidates) {
  const ids = new Set();
  const ranks = new Set();
  for (const candidate of candidates) {
    if (!Number.isFinite(candidate.rank) || candidate.rank <= 0) {
      throw new E3Error("INVALID_RANK", `Invalid rank for ${candidate.id}`, {
        candidateId: candidate.id,
        rank: candidate.rank,
      });
    }
    if (ids.has(candidate.id)) {
      throw new E3Error(
        "DUPLICATE_CANDIDATE_ID",
        `Duplicate candidate ${candidate.id}`,
        {
          candidateId: candidate.id,
        },
      );
    }
    if (ranks.has(candidate.rank)) {
      throw new E3Error("DUPLICATE_RANK", `Duplicate rank ${candidate.rank}`, {
        rank: candidate.rank,
      });
    }
    ids.add(candidate.id);
    ranks.add(candidate.rank);
  }
}

function result(candidate, outcome, reasonCode, allocation = null) {
  return {
    candidateId: candidate.id,
    rank: candidate.rank,
    outcome,
    reasonCode,
    allocation,
    previousAllocation: null,
  };
}

function decide(candidate, rules, seatMap) {
  if (candidate.status === "WITHDRAWN") {
    return result(
      candidate,
      "SKIPPED",
      candidate.currentHolding ? "WITHDRAWN_WITH_HOLDING" : "WITHDRAWN",
    );
  }
  if (candidate.currentHolding) {
    throw new E3Error(
      "UNSUPPORTED_HOLDING",
      `Candidate ${candidate.id} has a holding; upgrades are not implemented yet`,
      {
        candidateId: candidate.id,
      },
    );
  }
  if (!candidate.preferencesLocked) {
    return result(candidate, "SKIPPED", "PREFERENCES_NOT_LOCKED");
  }
  if (candidate.preferences.length === 0) {
    return result(candidate, "UNALLOCATED", "NO_PREFERENCES");
  }

  const eligibleRules = resolveEligibleRules(candidate, rules);
  if (eligibleRules.length === 0) {
    return result(candidate, "UNALLOCATED", "NO_ELIGIBLE_RULE");
  }

  for (let i = 0; i < candidate.preferences.length; i++) {
    const preference = candidate.preferences[i];
    for (const rule of eligibleRules) {
      const seatTypeCode = rule.claims.debits[0].seatTypeCode;
      const pool = findPool(
        seatMap,
        preference.collegeId,
        preference.branchId,
        seatTypeCode,
      );
      if (pool !== undefined && pool.available > 0) {
        pool.available -= 1;
        return result(candidate, "ALLOTTED", "SEAT_ALLOTTED", {
          seatPoolId: pool.id,
          collegeId: pool.collegeId,
          branchId: pool.branchId,
          seatTypeCode,
          preferenceIndex: i,
          preferenceOrder: preference.preferenceOrder,
          ruleCode: rule.code,
          rosterPriority: rule.rosterPriority,
          debits: [{ seatPoolId: pool.id, seatTypeCode, seats: 1 }],
        });
      }
    }
  }
  return result(candidate, "UNALLOCATED", "NO_AVAILABLE_SEAT");
}

export function allocateRound(context) {
  const { ruleSet, candidates, seatPools } = context;
  checkRuleSet(ruleSet);
  checkCandidates(candidates);

  const rules = sortRules(ruleSet.rules);
  const seatMap = buildSeatMap(seatPools);
  const queue = MinHeap.from(candidates, (a, b) => a.rank - b.rank);

  const decisions = [];
  const byOutcome = { ALLOTTED: 0, UNALLOCATED: 0, SKIPPED: 0 };

  while (queue.size > 0) {
    const decision = decide(queue.pop(), rules, seatMap);
    byOutcome[decision.outcome] += 1;
    decisions.push(decision);
  }

  return {
    roundId: context.roundId,
    academicYear: context.academicYear,
    ruleSetId: ruleSet.id,
    ruleSetVersion: ruleSet.version,
    snapshotId: context.snapshotId,
    decisions,
    remainingSeatPools: [...seatMap.values()].map((pool) => ({
      id: pool.id,
      collegeId: pool.collegeId,
      branchId: pool.branchId,
      seatTypeCode: pool.seatTypeCode,
      totalSeats: pool.totalSeats,
      availableSeats: pool.available,
    })),
    counters: { candidates: decisions.length, byOutcome },
  };
}
