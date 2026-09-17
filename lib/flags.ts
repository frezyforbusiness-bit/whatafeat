export function isDemoMode() {
  return process.env.NEXT_PUBLIC_DEMO !== "0";
}

export function paymentsEnabled() {
  return process.env.PAYMENTS_ENABLED === "1";
}
