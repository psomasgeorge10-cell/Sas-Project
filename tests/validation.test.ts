/**
 * Validation rules.
 *
 * These schemas are the only thing standing between a request body and the
 * database, and the same schemas run in the browser, so they are worth pinning
 * down precisely.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  fieldErrors,
  listQuerySchema,
  parseListQuery,
  projectInputSchema,
  projectPatchSchema,
} from "../src/lib/validation";

const validProject = {
  name: "Customer portal redesign",
  client: "Northwind Trading",
  description: "Rebuild the self-service portal.",
  status: "active",
  deadline: "2027-03-15",
  budget: 25000,
  assigneeId: 3,
};

function errorsFor(input: unknown) {
  const result = projectInputSchema.safeParse(input);
  assert.equal(result.success, false, "expected the input to be rejected");
  return fieldErrors(result.error);
}

describe("projectInputSchema", () => {
  it("accepts a complete project", () => {
    const result = projectInputSchema.parse(validProject);
    assert.equal(result.name, "Customer portal redesign");
    assert.equal(result.budget, 25000);
    assert.equal(result.assigneeId, 3);
  });

  it("defaults the optional fields", () => {
    const { client, description, assigneeId, ...required } = validProject;
    void client;
    void description;
    void assigneeId;

    const result = projectInputSchema.parse(required);
    assert.equal(result.client, "");
    assert.equal(result.description, "");
    assert.equal(result.assigneeId, null);
  });

  it("trims whitespace off text fields", () => {
    const result = projectInputSchema.parse({ ...validProject, name: "  Spaced out  " });
    assert.equal(result.name, "Spaced out");
  });

  it("rejects a short name", () => {
    assert.match(errorsFor({ ...validProject, name: "x" }).name, /at least 2 characters/);
  });

  it("rejects a status outside the enum", () => {
    assert.ok(errorsFor({ ...validProject, status: "archived" }).status);
  });

  it("rejects a malformed deadline", () => {
    assert.match(errorsFor({ ...validProject, deadline: "15/03/2027" }).deadline, /YYYY-MM-DD/);
  });

  it("rejects a date that does not exist", () => {
    assert.ok(errorsFor({ ...validProject, deadline: "2027-02-31" }).deadline);
  });

  describe("budget", () => {
    it("accepts a numeric string, as an HTML input produces", () => {
      assert.equal(projectInputSchema.parse({ ...validProject, budget: "2500.75" }).budget, 2500.75);
    });

    it("accepts zero", () => {
      assert.equal(projectInputSchema.parse({ ...validProject, budget: 0 }).budget, 0);
    });

    // Regression: z.coerce.number() turns "" into 0, which would silently
    // create a zero-budget project for anyone who left the field blank.
    it("requires a value rather than coercing an empty string to zero", () => {
      assert.match(errorsFor({ ...validProject, budget: "" }).budget, /required/i);
    });

    it("rejects a negative budget", () => {
      assert.match(errorsFor({ ...validProject, budget: -1 }).budget, /negative/i);
    });

    it("rejects more precision than the column stores", () => {
      assert.match(errorsFor({ ...validProject, budget: "10.999" }).budget, /2 decimal places/);
    });

    it("keeps two-decimal values that float arithmetic would distort", () => {
      assert.equal(projectInputSchema.parse({ ...validProject, budget: 0.07 }).budget, 0.07);
    });
  });
});

describe("projectPatchSchema", () => {
  // Regression: `.partial()` on a schema whose fields carry defaults still
  // applies those defaults, so patching only the status used to blank out the
  // client and the description.
  it("returns only the keys that were sent", () => {
    const result = projectPatchSchema.parse({ status: "completed" });
    assert.deepEqual(result, { status: "completed" });
    assert.ok(!("client" in result));
    assert.ok(!("description" in result));
  });

  it("allows clearing the assignee", () => {
    assert.deepEqual(projectPatchSchema.parse({ assigneeId: null }), { assigneeId: null });
  });

  it("rejects an empty patch", () => {
    const result = projectPatchSchema.safeParse({});
    assert.equal(result.success, false);
  });

  it("applies the same field rules as create", () => {
    const result = projectPatchSchema.safeParse({ budget: -5 });
    assert.equal(result.success, false);
  });
});

describe("listQuerySchema", () => {
  it("fills in the default filters", () => {
    const result = listQuerySchema.parse({});
    assert.deepEqual(result, {
      search: "",
      sort: "deadline",
      order: "asc",
      page: 1,
      pageSize: 10,
    });
  });

  it("coerces numeric query-string values", () => {
    const result = listQuerySchema.parse({ page: "3", pageSize: "25", assigneeId: "7" });
    assert.equal(result.page, 3);
    assert.equal(result.pageSize, 25);
    assert.equal(result.assigneeId, 7);
  });

  it("caps the page size so a client cannot ask for the whole table", () => {
    assert.equal(listQuerySchema.safeParse({ pageSize: "5000" }).success, false);
  });

  it("only allows whitelisted sort fields", () => {
    // The sort key is interpolated into SQL, so this is a security boundary.
    assert.equal(listQuerySchema.safeParse({ sort: "budget; DROP TABLE projects" }).success, false);
  });

  it("treats a blank query-string value as absent", () => {
    const result = parseListQuery(new URLSearchParams("status=&search=&page="));
    assert.equal(result.success, true);
    assert.equal(result.success && result.data.status, undefined);
    assert.equal(result.success && result.data.page, 1);
  });

  it("reads a full filter set off a URL", () => {
    const result = parseListQuery(
      new URLSearchParams("search=portal&status=on_hold&assigneeId=2&sort=budget&order=desc&page=2"),
    );
    assert.equal(result.success, true);
    assert.deepEqual(result.success && result.data, {
      search: "portal",
      status: "on_hold",
      assigneeId: 2,
      sort: "budget",
      order: "desc",
      page: 2,
      pageSize: 10,
    });
  });
});
