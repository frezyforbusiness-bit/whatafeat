export const ARTIST_TYPES = [
  "rapper",
  "singer",
  "producer",
  "songwriter",
  "engineer",
  "other",
] as const;

export type ArtistType = (typeof ARTIST_TYPES)[number];

export const PROFILE_GENRES = [
  "trap",
  "hip-hop",
  "drill",
  "rage",
  "r&b",
  "melodic",
  "experimental",
  "pluggnb",
  "jersey",
  "afro",
  "pop",
  "electronic",
] as const;

export const FEAT_STATUS_OPTIONS = [
  { value: "open", label: "open for feats" },
  { value: "selective", label: "selective" },
  { value: "closed", label: "not taking feats rn" },
] as const;

export type FeatStatus = (typeof FEAT_STATUS_OPTIONS)[number]["value"];

export const COLLAB_TYPE_OPTIONS = [
  { value: "paid", label: "paid feats" },
  { value: "swap", label: "feat swaps" },
  { value: "free", label: "free collabs" },
  { value: "offers", label: "open to offers" },
] as const;

export type CollabType = (typeof COLLAB_TYPE_OPTIONS)[number]["value"];

export const PRICING_MODE_OPTIONS = [
  { value: "fixed", label: "fixed price" },
  { value: "starting_from", label: "starting from" },
  { value: "offer", label: "make an offer" },
] as const;

export type PricingMode = (typeof PRICING_MODE_OPTIONS)[number]["value"];

export const PROFILE_LANGUAGES = ["English", "Italian", "French", "Spanish"] as const;

export const CURRENCIES = ["EUR", "USD", "GBP"] as const;

export function featStatusLabel(status: string) {
  return FEAT_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

export function formatArtistTypes(types: string[] | undefined, limit?: number) {
  const list = types?.filter(Boolean) ?? [];
  const shown = typeof limit === "number" ? list.slice(0, limit) : list;
  return shown.join(" · ");
}

export function deriveTrade(featStatus: string, collaborationTypes: string[]) {
  return featStatus !== "closed" && collaborationTypes.includes("swap");
}

export function derivePrimaryGenre(genres: string[], fallback = "trap") {
  return genres[0]?.trim() || fallback;
}

export function formatFeatPrice(opts: {
  pricingMode: string;
  priceCents: number;
  currency?: string;
}) {
  const currency = opts.currency || "EUR";
  const amount = new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    minimumFractionDigits: opts.priceCents % 100 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(opts.priceCents / 100);
  if (opts.pricingMode === "offer") return "make an offer";
  if (opts.pricingMode === "starting_from") return `feat price starts at ${amount}`;
  return `feat price ${amount}`;
}

export function profileCta(opts: {
  featStatus: string;
  pricingMode: string;
  collaborationTypes: string[];
}): "hide" | "make an offer" | "request a feat" | "hit them up" {
  if (opts.featStatus === "closed") return "hide";
  if (opts.pricingMode === "offer") return "make an offer";
  if (opts.collaborationTypes.includes("paid")) return "request a feat";
  return "hit them up";
}
