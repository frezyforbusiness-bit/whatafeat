import type {
  Artist,
  Application,
  Collaboration,
  Contribution,
  Delivery,
  Message,
  Offer,
  Proposal,
  Terms,
  Verse,
} from "@/domain/model";
import type {
  artistProfiles,
  applications,
  collaborations,
  contributions,
  featureOffers,
  messages,
  openVerses,
  proposals,
} from "@/db/schema";

type Profile = typeof artistProfiles.$inferSelect;
type OfferRow = typeof featureOffers.$inferSelect;
type VerseRow = typeof openVerses.$inferSelect;
type AppRow = typeof applications.$inferSelect;
type ProposalRow = typeof proposals.$inferSelect;
type CollabRow = typeof collaborations.$inferSelect;
type ContribRow = typeof contributions.$inferSelect;
type MessageRow = typeof messages.$inferSelect;

export function mapArtist(p: Profile): Artist {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    genre: p.genre,
    language: p.language,
    bio: p.bio,
    art: p.artIndex,
    price: p.priceCents,
    days: p.deliveryDays,
    trade: p.trade,
    demo: p.hasDemo,
  };
}

export function mapOffer(o: OfferRow): Offer {
  return {
    id: o.id,
    artist: o.artistId,
    title: o.title,
    mode: o.mode,
    price: o.priceCents,
    days: o.days,
    revisions: o.revisions,
    files: o.files,
    archived: o.archived,
  };
}

export function mapVerse(v: VerseRow): Verse {
  return {
    id: v.id,
    owner: v.ownerId,
    title: v.title,
    brief: v.brief,
    genre: v.genre,
    language: v.language,
    mode: v.mode,
    budget: v.budgetCents,
    bpm: v.bpm,
    key: v.key,
    art: v.artIndex,
    status: v.status,
  };
}

export function mapApplication(a: AppRow): Application {
  return {
    id: a.id,
    verse: a.verseId,
    artist: a.artistId,
    message: a.message,
    price: a.priceCents,
    status: a.status,
  };
}

export function mapProposal(p: ProposalRow): Proposal {
  return {
    id: p.id,
    from: p.fromArtistId,
    to: p.toArtistId,
    payer: p.payerArtistId,
    performer: p.performerArtistId,
    verse: p.verseId ?? undefined,
    application: p.applicationId ?? undefined,
    terms: p.terms as Terms,
    status: p.status,
    created: p.createdAt.toISOString(),
    expires: p.expiresAt.toISOString(),
  };
}

export function mapCollaboration(
  c: CollabRow,
  participantIds: string[],
  contribs: Contribution[],
): Collaboration {
  return {
    id: c.id,
    proposal: c.proposalId,
    participants: participantIds,
    payer: c.payerArtistId,
    agreement: c.agreement as Terms,
    accepted: c.acceptedAt.toISOString(),
    status: c.status,
    cancelBy: c.cancelByArtistId ?? undefined,
    contributions: contribs,
  };
}

export function mapContribution(
  t: ContribRow,
  deliveries: Delivery[] = [],
): Contribution {
  return {
    id: t.id,
    performer: t.performerArtistId,
    recipient: t.recipientArtistId,
    obligation: t.obligation,
    status: t.status,
    revisions: t.revisionsUsed,
    deadline: t.deadlineAt?.toISOString(),
    deliveries,
  };
}

export function mapMessage(m: MessageRow): Message {
  return {
    id: m.id,
    proposal: m.proposalId,
    author: m.authorArtistId,
    text: m.text,
    at: m.createdAt.toISOString(),
  };
}
