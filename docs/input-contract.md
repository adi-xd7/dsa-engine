## 2. RuleSet

| Field               | Type                 | Required | Rules                                                         |
| ------------------- | -------------------- | -------- | ------------------------------------------------------------- |
| id                  | string               | yes      | non-empty                                                     |
| version             | string               | yes      | non-empty                                                     |
| strategy            | string               | yes      | v1: only `"ORDERED_FIRST_FIT"`                                |
| inventoryMode       | string               | yes      | v1: only `"DISJOINT_POOLS"`                                   |
| candidateAttributes | { [key]: FieldType } | yes      | declares keys allowed in `candidate.attributes` (may be `{}`) |
| poolAttributes      | { [key]: FieldType } | yes      | declares keys allowed in `pool.attributes` (may be `{}`)      |
| rules               | Rule[]               | yes      | at least one                                                  |

`FieldType` is one of: `"string"`, `"boolean"`, `"stringSet"`.

## 3. Rule

| Field                | Type        | Required | Rules                                                      |
| -------------------- | ----------- | -------- | ---------------------------------------------------------- |
| code                 | string      | yes      | unique within the RuleSet                                  |
| dimension            | string      | yes      | rule family label, e.g. "VERTICAL"; informational only     |
| precedence           | integer     | yes      | ties broken by `code` ascending                            |
| requires             | Condition[] | yes      | candidate-only; `[]` = unconditional; AND across entries   |
| requiresVerification | boolean     | yes      | if true, candidate.verificationStatus must be `"VERIFIED"` |
| claims               | Claim       | yes      | see below                                                  |

### Claim

| Field                 | Type            | Required | Rules                                              |
| --------------------- | --------------- | -------- | -------------------------------------------------- |
| debits                | Debit[]         | yes      | v1: exactly one, else `UNSUPPORTED_CLAIM_SHAPE`    |
| destinationConditions | PoolCondition[] | yes      | tested against pool `attributes`; AND; `[]` = none |

`Debit = { seatTypeCode: string }`. The pool is found by
`(preference.collegeId, preference.branchId, debit.seatTypeCode)`. Seat codes are never synthesized.

### Derived: rosterPriority

The 0-based index of a rule after sorting by `(precedence, code)`. Lower = considered first.

## 4. Conditions

Candidate condition: `{ field, op, value }`, where `field` is one of:

- `"verticalCategory"` (string)
- `"horizontalGroups"` (stringSet)
- `"eligibilityGroups"` (stringSet)
- `"attributes.<key>"` (type declared in `candidateAttributes`)

Pool condition: `{ attribute, op, value }` (type declared in `poolAttributes`)

| op      | Field type | value                | True when             |
| ------- | ---------- | -------------------- | --------------------- |
| EQ      | string     | string               | actual === value      |
| EQ      | boolean    | boolean              | actual === value      |
| IN      | string     | string[] (non-empty) | value includes actual |
| HAS_ANY | stringSet  | string[] (non-empty) | actual ∩ value ≠ ∅    |
| HAS_ALL | stringSet  | string[] (non-empty) | value ⊆ actual        |

- Unknown op → `UNSUPPORTED_RULE_OPERATOR`
- Undeclared attribute or unknown field → `UNKNOWN_ATTRIBUTE`
- Operator/type mismatch → `INVALID_RULE`
- Rules test field NAMES; the engine never hardcodes category VALUES.

## 5. Candidate

| Field              | Type             | Required | Rules                                                    |
| ------------------ | ---------------- | -------- | -------------------------------------------------------- |
| id                 | string           | yes      | non-empty, unique                                        |
| rank               | number           | yes      | finite, > 0, may be decimal, unique                      |
| status             | string           | yes      | `"ACTIVE"` or `"WITHDRAWN"` (adapter maps E1 enums)      |
| verticalCategory   | string           | yes      |                                                          |
| horizontalGroups   | string[]         | yes      | verified/usable claims only, no duplicates [PROVISIONAL] |
| eligibilityGroups  | string[]         | yes      | no duplicates                                            |
| attributes         | { [key]: value } | yes      | policy-required extras only, e.g. region; may be `{}`    |
| verificationStatus | string           | yes      | `"VERIFIED"`, `"PENDING"` or `"REJECTED"`                |
| preferencesLocked  | boolean          | yes      |                                                          |
| preferences        | Preference[]     | yes      | may be empty                                             |
| currentHolding     | Holding \| null  | yes      | `null` = fresh candidate                                 |

### Preference

`{ collegeId, branchId, preferenceOrder }`; `preferences[i].preferenceOrder === i + 1`; `(collegeId, branchId)` unique per candidate.

### Holding

| Field            | Type                                                          | Required | Rules                                |
| ---------------- | ------------------------------------------------------------- | -------- | ------------------------------------ |
| allocationId     | string                                                        | yes      | unique across candidates             |
| seatPoolId       | string                                                        | yes      | must exist in seatPools              |
| collegeId        | string                                                        | yes      | must equal the held pool's collegeId |
| branchId         | string                                                        | yes      | must equal the held pool's branchId  |
| position         | { preferenceIndex: integer ≥ 0, rosterPriority: integer ≥ 0 } | yes      | see consistency check                |
| upgradeRequested | boolean                                                       | yes      | adapter maps E1 status → this flag   |

Consistency check (`INVALID_HOLDING`): if the held (collegeId, branchId) is in the
current preferences, `position.preferenceIndex` must equal its index there, and
`position.rosterPriority` must equal the priority of a rule whose debit code equals the
held pool's seatTypeCode. If the held branch is missing from the preferences, see the decision contract.

## 7. Error codes

INVALID_CONTEXT, INVALID_RANK, DUPLICATE_CANDIDATE_ID, DUPLICATE_RANK,
INVALID_PREFERENCES, DUPLICATE_PREFERENCE, INVALID_SEAT_POOL, DUPLICATE_POOL_ID,
DUPLICATE_POOL_KEY, INVALID_HOLDING, CAPACITY_MISMATCH, INVALID_RULE,
DUPLICATE_RULE_CODE, UNKNOWN_ATTRIBUTE, UNSUPPORTED_RULE_OPERATOR,
UNSUPPORTED_STRATEGY, UNSUPPORTED_INVENTORY_MODE, UNSUPPORTED_CLAIM_SHAPE
