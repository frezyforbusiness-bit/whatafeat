import { z } from "zod";

/**
 * Runtime validation for every Server Action input.
 *
 * TypeScript types are erased at runtime, so actions invoked directly (outside
 * the UI) would otherwise accept negative prices, NaN dates or unknown enums.
 */

const trimmed = (max: number) => z.string().trim().max(max);
const required = (max: number, msg: string) => trimmed(max).min(1, msg);

export const modeSchema = z.enum(["Paid", "Trade"]);
export const verseStatusSchema = z.enum(["Draft", "Published", "Closed"]);

/** Euro amount typed by a human, converted to integer cents by the caller. */
const euros = z
  .number()
  .finite("Enter a valid amount.")
  .min(0, "Amount cannot be negative.")
  .max(100000, "Amount is too large.");

const futureDate = z
  .string()
  .refine((v) => {
    const t = Date.parse(v);
    return Number.isFinite(t) && t > Date.now();
  }, "Choose a future deadline.");

export const termsSchema = z
  .object({
    title: required(120, "Add a title."),
    brief: required(4000, "Add a brief."),
    mode: modeSchema,
    price: z.number().int("Price must be a whole number of cents.").min(0).max(10000000),
    days: z.number().int().min(1, "Choose 1–90 days.").max(90, "Choose 1–90 days."),
    revisions: z.number().int().min(0).max(10, "Invalid revision allowance."),
    files: trimmed(500),
    yourContribution: trimmed(1000),
    theirContribution: required(1000, "Describe their contribution."),
    credits: trimmed(500),
    rights: trimmed(2000),
    promotion: trimmed(1000),
    demoName: trimmed(300).optional(),
    tradeDate: z.string().optional(),
    theirTradeDate: z.string().optional(),
  })
  .superRefine((t, ctx) => {
    if (t.mode !== "Trade") return;
    if (!t.yourContribution.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["yourContribution"],
        message: "Describe both contributions.",
      });
    }
    // Both deadlines matter: the original code only checked the first one, and a
    // value like "not-a-date" produced NaN which slipped past a `<= Date.now()` test.
    for (const key of ["tradeDate", "theirTradeDate"] as const) {
      const parsed = futureDate.safeParse(t[key]);
      if (!parsed.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: "Set a future deadline for both contributions.",
        });
      }
    }
  });

export const sendProposalSchema = z.object({
  toArtistId: z.string().uuid("Unknown artist."),
  terms: termsSchema,
  verseId: z.string().uuid().optional(),
  applicationId: z.string().uuid().optional(),
  offerId: z.string().uuid().optional(),
});

export const onboardingSchema = z.object({
  name: required(80, "Add your artist name."),
  slug: z
    .string()
    .trim()
    .min(1, "Choose a slug.")
    .max(60)
    .transform((v) => v.toLowerCase())
    .refine(
      (v) => /^[a-z0-9-]+$/.test(v),
      "Use lowercase letters, numbers and hyphens for your slug.",
    ),
  bio: trimmed(2000).optional(),
  genre: required(40, "Choose a sound."),
  language: required(40, "Choose a language."),
  trade: z.boolean(),
});

const slugSchema = z
  .string()
  .trim()
  .min(1, "pick a username.")
  .max(60)
  .transform((v) => v.toLowerCase())
  .refine((v) => /^[a-z0-9-]+$/.test(v), "use lowercase letters, numbers and hyphens.");

const optionalUrl = trimmed(500)
  .optional()
  .transform((v) => v ?? "")
  .refine((v) => {
    if (!v) return true;
    try {
      const href = v.includes("://") ? v : `https://${v}`;
      new URL(href);
      return true;
    } catch {
      return false;
    }
  }, "enter a valid link.");

const stringList = z.array(z.string().trim().min(1).max(60)).max(20).optional();

export const profileBasicSchema = z.object({
  name: required(80, "add your artist name."),
  slug: slugSchema,
  location: trimmed(120).optional(),
  artistTypes: z.array(z.string().trim().min(1).max(40)).min(1, "pick at least one artist type."),
});

export const profileSoundSchema = z.object({
  genres: stringList,
  influences: stringList,
  language: trimmed(40).optional(),
});

export const profileMusicSchema = z.object({
  spotifyUrl: optionalUrl,
  appleMusicUrl: optionalUrl,
  soundcloudUrl: optionalUrl,
  youtubeUrl: optionalUrl,
  instagramUrl: optionalUrl,
  tiktokUrl: optionalUrl,
  featuredTrackUrl: optionalUrl,
});

export const profileFeatSchema = z.object({
  featStatus: z.enum(["open", "selective", "closed"]),
  collaborationTypes: z.array(z.enum(["paid", "swap", "free", "offers"])).optional(),
  pricingMode: z.enum(["fixed", "starting_from", "offer"]).optional(),
  price: euros.optional(),
  currency: z.enum(["EUR", "USD", "GBP"]).optional(),
});

export const profileAboutSchema = z.object({
  bio: trimmed(160).optional(),
  description: trimmed(4000).optional(),
});

export const saveProfileDraftSchema = z
  .object({
    name: trimmed(80).optional(),
    slug: slugSchema.optional(),
    location: trimmed(120).optional(),
    artistTypes: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
    genres: stringList,
    influences: stringList,
    language: trimmed(40).optional(),
    bio: trimmed(160).optional(),
    description: trimmed(4000).optional(),
    spotifyUrl: optionalUrl,
    appleMusicUrl: optionalUrl,
    soundcloudUrl: optionalUrl,
    youtubeUrl: optionalUrl,
    instagramUrl: optionalUrl,
    tiktokUrl: optionalUrl,
    featuredTrackUrl: optionalUrl,
    featStatus: z.enum(["open", "selective", "closed"]).optional(),
    collaborationTypes: z.array(z.enum(["paid", "swap", "free", "offers"])).optional(),
    pricingMode: z.enum(["fixed", "starting_from", "offer"]).optional(),
    price: euros.optional(),
    currency: z.enum(["EUR", "USD", "GBP"]).optional(),
  })
  .strict();

export const finalizeOnboardingSchema = z.object({
  name: required(80, "add your artist name."),
  slug: slugSchema,
  artistTypes: z.array(z.string().trim().min(1).max(40)).min(1, "pick at least one artist type."),
});

export const profileSectionSchema = z.enum(["profile", "sound", "music", "feat", "socials"]);

export const updateProfileSectionSchema = z.object({
  section: profileSectionSchema,
  data: z.record(z.string(), z.unknown()),
});


export const saveOfferSchema = z.object({
  id: z.string().uuid().optional(),
  title: required(120, "Add a title."),
  mode: modeSchema,
  price: euros,
  days: z.number().int().min(1).max(90, "Choose 1–90 days."),
  revisions: z.number().int().min(0).max(10),
  files: trimmed(500),
});

export const saveVerseSchema = z.object({
  id: z.string().uuid().optional(),
  title: required(120, "Add a title."),
  brief: required(4000, "Describe what you are looking for."),
  genre: required(40, "Choose a sound."),
  language: required(40, "Choose a language."),
  mode: modeSchema,
  price: euros,
  bpm: z.number().int().min(0).max(300),
  key: trimmed(40),
  status: verseStatusSchema,
});

export const applySchema = z.object({
  verseId: z.string().uuid(),
  message: required(4000, "Add a message."),
  price: euros.optional(),
});

export const reviewSchema = z.object({
  collaborationId: z.string().uuid(),
  rating: z.number().int().min(1, "Rate from 1 to 5.").max(5, "Rate from 1 to 5."),
  text: trimmed(4000),
});

export const uploadedFileSchema = z.object({
  pathname: z.string().min(1).max(600),
  url: z.string().url(),
  name: required(300, "Missing file name."),
});

export const contributionSchema = z.object({
  collaborationId: z.string().uuid(),
  contributionId: z.string().uuid(),
  action: z.enum(["deliver", "approve", "revise"]),
  notes: trimmed(4000).optional(),
  uploads: z.array(uploadedFileSchema).max(20).optional(),
});

export const applicationStatusSchema = z.enum(["Shortlisted", "Rejected", "Withdrawn"]);
export const proposalActionSchema = z.enum(["Accepted", "Declined", "Withdrawn"]);

/** Turns a Zod failure into the first human-readable message. */
export function parseOrThrow<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "Invalid input.");
  }
  return result.data;
}
