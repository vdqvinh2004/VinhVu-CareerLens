import { describe, expect, it } from "vitest";

import {
  evaluateToolPolicy,
  type ToolPolicyMetadata,
} from "@/lib/ai/agent/tools";

const publicWebPolicy: ToolPolicyMetadata = {
  networkAccess: "public_web",
  sideEffect: "read",
  acceptsDataClasses: ["public"],
  producesDataClass: "public",
};

describe("agent tool data policy", () => {
  it("denies tool execution when input data has no classification", () => {
    expect(evaluateToolPolicy(publicWebPolicy, [])).toEqual({
      allowed: false,
      reason: "data_classification_required",
    });
  });

  it("allows public data to reach a public-web tool", () => {
    expect(evaluateToolPolicy(publicWebPolicy, ["public"])).toEqual({
      allowed: true,
    });
  });

  it.each(["personal_data", "private_document"] as const)(
    "blocks %s from public-web tools even if metadata claims to accept it",
    (dataClass) => {
      expect(
        evaluateToolPolicy(
          {
            ...publicWebPolicy,
            acceptsDataClasses: ["public", dataClass],
          },
          [dataClass],
        ),
      ).toEqual({
        allowed: false,
        reason: "sensitive_data_to_public_web",
        dataClass,
      });
    },
  );

  it("supports private-document tools that have no public network access", () => {
    expect(
      evaluateToolPolicy(
        {
          networkAccess: "none",
          sideEffect: "read",
          acceptsDataClasses: ["private_document"],
          producesDataClass: "private_document",
        },
        new Set(["private_document"] as const),
      ),
    ).toEqual({ allowed: true });
  });

  it("rejects an undeclared input data class", () => {
    expect(evaluateToolPolicy(publicWebPolicy, ["personal_data"])).toEqual({
      allowed: false,
      reason: "sensitive_data_to_public_web",
      dataClass: "personal_data",
    });

    expect(
      evaluateToolPolicy(
        {
          ...publicWebPolicy,
          networkAccess: "none",
        },
        ["private_document"],
      ),
    ).toEqual({
      allowed: false,
      reason: "data_class_not_accepted",
      dataClass: "private_document",
    });
  });
});
