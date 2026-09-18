/**
 * Ownership comes from Blob's own pathname, never from a parallel client field.
 */
export function assertOwnedBlobPath(
  meta: { pathname: string },
  opts: { userId: string; kind: "demo" | "delivery" },
) {
  const prefix = opts.kind === "demo" ? `demos/${opts.userId}/` : `deliveries/${opts.userId}/`;
  if (!meta.pathname.startsWith(prefix)) {
    throw new Error("Invalid upload.");
  }
}
