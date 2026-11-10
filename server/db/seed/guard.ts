type SeedEnvironment = Readonly<Record<string, string | undefined>>;

/** The seed replaces every expense, category, and spending with demo data. */
export function assertDevelopmentDatabaseResetAllowed(env: SeedEnvironment) {
  if (env.NODE_ENV !== "development" || env.VERCEL_ENV === "production") {
    throw new Error(
      "Database reset refused: seeding is only allowed with NODE_ENV=development outside production deployments.",
    );
  }

  if (env.REDFUNDS_ALLOW_DATABASE_RESET !== "true") {
    throw new Error(
      "Database reset refused: this seed deletes ALL expenses, categories, and spendings. Only target a disposable development database and explicitly set REDFUNDS_ALLOW_DATABASE_RESET=true for this command.",
    );
  }
}
