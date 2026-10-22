import assert from "node:assert/strict";
import test from "node:test";
import { assertDevelopmentDatabaseResetAllowed } from "./seed-guard";

test("refuses a reset by default", () => {
  assert.throws(() => assertDevelopmentDatabaseResetAllowed({}), /reset refused/);
  assert.throws(
    () => assertDevelopmentDatabaseResetAllowed({ NODE_ENV: "development" }),
    /deletes ALL/,
  );
});

test("requires exact opt-in and explicit development environment", () => {
  for (const value of [undefined, "false", "1", "TRUE"]) {
    assert.throws(() =>
      assertDevelopmentDatabaseResetAllowed({
        NODE_ENV: "development",
        REDFUNDS_ALLOW_DATABASE_RESET: value,
      }),
    );
  }

  for (const value of [undefined, "test", "production"]) {
    assert.throws(() =>
      assertDevelopmentDatabaseResetAllowed({
        NODE_ENV: value,
        REDFUNDS_ALLOW_DATABASE_RESET: "true",
      }),
    );
  }
});

test("rejects production deployments even with development and reset flags", () => {
  assert.throws(() =>
    assertDevelopmentDatabaseResetAllowed({
      NODE_ENV: "development",
      VERCEL_ENV: "production",
      REDFUNDS_ALLOW_DATABASE_RESET: "true",
    }),
  );
});

test("allows an explicitly opted-in development reset", () => {
  assert.doesNotThrow(() =>
    assertDevelopmentDatabaseResetAllowed({
      NODE_ENV: "development",
      REDFUNDS_ALLOW_DATABASE_RESET: "true",
    }),
  );
});
