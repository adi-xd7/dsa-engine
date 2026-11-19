import { E3Error } from "../errors.js";

const OPERATORS = new Set(["EQ", "IN", "HAS_ANY", "HAS_ALL"]);
const BASE_FIELDS = new Set([
  "verticalCategory",
  "horizontalGroups",
  "eligibilityGroups",
]);

function compareCodes(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function validateCondition(rule, condition) {
  if (!OPERATORS.has(condition.op)) {
    throw new E3Error(
      "UNSUPPORTED_RULE_OPERATOR",
      `Rule ${rule.code} uses unsupported operator ${condition.op}`,
      {
        ruleCode: rule.code,
        op: condition.op,
      },
    );
  }
  if (
    !BASE_FIELDS.has(condition.field) &&
    !condition.field.startsWith("attributes.")
  ) {
    throw new E3Error(
      "UNKNOWN_ATTRIBUTE",
      `Rule ${rule.code} uses unknown field ${condition.field}`,
      {
        ruleCode: rule.code,
        field: condition.field,
      },
    );
  }
}

export function sortRules(rules) {
  const codes = new Set();
  for (const rule of rules) {
    if (codes.has(rule.code)) {
      throw new E3Error(
        "DUPLICATE_RULE_CODE",
        `Duplicate rule code ${rule.code}`,
        { ruleCode: rule.code },
      );
    }
    codes.add(rule.code);
    if (rule.claims.debits.length !== 1) {
      throw new E3Error(
        "UNSUPPORTED_CLAIM_SHAPE",
        `Rule ${rule.code} must have exactly one debit`,
        {
          ruleCode: rule.code,
        },
      );
    }
    if (rule.claims.destinationConditions.length > 0) {
      throw new E3Error(
        "UNSUPPORTED_DESTINATION_CONDITION",
        `Rule ${rule.code} uses destination conditions`,
        {
          ruleCode: rule.code,
        },
      );
    }
    for (const condition of rule.requires) {
      validateCondition(rule, condition);
    }
  }
  return [...rules]
    .sort((a, b) => a.precedence - b.precedence || compareCodes(a.code, b.code))
    .map((rule, index) => ({ ...rule, rosterPriority: index }));
}

function readField(candidate, field) {
  if (field.startsWith("attributes.")) {
    return candidate.attributes?.[field.slice("attributes.".length)];
  }
  return candidate[field];
}

function matches(candidate, condition) {
  const actual = readField(candidate, condition.field);
  switch (condition.op) {
    case "EQ":
      return actual === condition.value;
    case "IN":
      return condition.value.includes(actual);
    case "HAS_ANY":
      return (
        Array.isArray(actual) && condition.value.some((v) => actual.includes(v))
      );
    case "HAS_ALL":
      return (
        Array.isArray(actual) &&
        condition.value.every((v) => actual.includes(v))
      );
  }
}

export function resolveEligibleRules(candidate, sortedRules) {
  return sortedRules.filter((rule) => {
    if (
      rule.requiresVerification &&
      candidate.verificationStatus !== "VERIFIED"
    )
      return false;
    return rule.requires.every((condition) => matches(candidate, condition));
  });
}
