/**
 * Database access is not wired for the Vercel Phase 1 demo.
 * Local fixtures live in mocks/ + localStorage. Phase 2 will replace this.
 */
export function getDb(): never {
  throw new Error(
    "Database is not configured in this deployment. Whatafeat Phase 1 uses local demo data only."
  );
}
