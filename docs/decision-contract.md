# E3 Decision Contract (v1)

Status: DRAFT. Rows marked PROVISIONAL/OPEN need KEA confirmation.

`allocateRound(context)` either throws an E3Error (validation failed, no partial
result) or returns an AllocationResult. Same input → deep-equal output.

## 1. AllocationResult

| Field              | Type        | Notes                                                    |
| ------------------ | ----------- | -------------------------------------------------------- |
| roundId            | string      | echoed                                                   |
| academicYear       | string      | echoed                                                   |
| ruleSetId          | string      | echoed                                                   |
| ruleSetVersion     | string      | echoed                                                   |
| snapshotId         | string      | echoed unchanged                                         |
| decisions          | Decision[]  | exactly one per input candidate, in ascending rank order |
| remainingSeatPools | PoolState[] | every input pool, in input order                         |
| counters           | Counters    | see §4                                                   |

No timestamps, random IDs, timings or references to input objects.

## 2. Decision

| Field              | Type                       | Notes                                  |
| ------------------ | -------------------------- | -------------------------------------- |
| candidateId        | string                     |                                        |
| rank               | number                     |                                        |
| outcome            | Outcome                    | see §3                                 |
| reasonCode         | string                     | see §3                                 |
| allocation         | Allocation \| null         | seat held AFTER this run; null if none |
| previousAllocation | PreviousAllocation \| null | set only when outcome = UPGRADED       |

### Allocation

`{ seatPoolId, collegeId, branchId, seatTypeCode, preferenceIndex, preferenceOrder, ruleCode, rosterPriority, debits: [{ seatPoolId, seatTypeCode, seats: 1 }] }`

For RETAINED, `allocation` describes the existing holding and `debits` is `[]`
(no new debit; the seat is already net of availableSeats).

### PreviousAllocation

`{ allocationId, seatPoolId, collegeId, branchId, preferenceIndex, rosterPriority }`

## 3. Outcomes and reason codes

| #   | Situation                                              | outcome     | reasonCode                     | Inventory effect                     | Status      |
| --- | ------------------------------------------------------ | ----------- | ------------------------------ | ------------------------------------ | ----------- |
| 1   | WITHDRAWN, no holding                                  | SKIPPED     | WITHDRAWN                      | none                                 | PROVISIONAL |
| 2   | WITHDRAWN, has holding                                 | SKIPPED     | WITHDRAWN_WITH_HOLDING         | none; seat NOT released (E1 decides) | OPEN        |
| 3   | ACTIVE, preferences not locked, no holding             | SKIPPED     | PREFERENCES_NOT_LOCKED         | none                                 | PROVISIONAL |
| 4   | ACTIVE, preferences not locked, has holding            | RETAINED    | PREFERENCES_NOT_LOCKED         | none                                 | PROVISIONAL |
| 5   | Fresh, locked, empty preference list                   | UNALLOCATED | NO_PREFERENCES                 | none                                 | PROVISIONAL |
| 6   | Fresh, meets no rule's candidate conditions            | UNALLOCATED | NO_ELIGIBLE_RULE               | none                                 | CONFIRMED   |
| 7   | Fresh, seat found                                      | ALLOTTED    | SEAT_ALLOTTED                  | consume 1                            | CONFIRMED   |
| 8   | Fresh, no available eligible seat                      | UNALLOCATED | NO_AVAILABLE_SEAT              | none                                 | CONFIRMED   |
| 9   | Holding, upgradeRequested = false                      | RETAINED    | UPGRADE_NOT_REQUESTED          | none                                 | CONFIRMED   |
| 10  | Holding, upgrade requested, strictly better seat found | UPGRADED    | BETTER_POSITION_FOUND          | consume new, then release old        | CONFIRMED   |
| 11  | Holding, upgrade requested, nothing better             | RETAINED    | NO_BETTER_POSITION             | none                                 | CONFIRMED   |
| 12  | Holding, held branch missing from new preferences      | RETAINED    | HELD_BRANCH_NOT_IN_PREFERENCES | none; no upgrade attempted           | OPEN        |

"Strictly better" = `(preferenceIndex, rosterPriority)` lexicographically smaller
than the held position. A same-preference, better-roster seat counts.

## 4. Counters

```
{
  candidates: number,
  byOutcome: { ALLOTTED, UNALLOCATED, RETAINED, UPGRADED, SKIPPED },
  seatsConsumed: number,
  seatsReleased: number
}
```

Invariant: the sum of byOutcome === candidates === decisions.length.
Invariant: seatsConsumed === ALLOTTED + UPGRADED; seatsReleased === UPGRADED.

## 5. PoolState

`{ id, collegeId, branchId, seatTypeCode, totalSeats, availableSeats }`
Invariant: 0 ≤ availableSeats ≤ totalSeats.

## 6. Pass semantics [PROVISIONAL]

One pass in ascending rank. A seat released by an upgrade is available only to
candidates processed after it. Earlier candidates are not revisited.

## 7. Not included in v1

Per-decision traces of rejected options [OPEN], special-category phases,
seat conversions, interlocking inventory, multi-pass iteration.
