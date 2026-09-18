// NOTE: deliberately NOT a "use server" module. These helpers read privileged
// rows and must only be reachable from server code that has already resolved
// the viewer from the session — never callable directly from the browser.
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  applications,
  artistProfiles,
  assets,
  audioSamples,
  blocks,
  collaborationParticipants,
  collaborations,
  contributions,
  deliveries,
  deliveryFiles,
  featureOffers,
  messages,
  openVerses,
  proposals,
  reports,
  reviews,
} from "@/db/schema";
import type { Store, Track } from "@/domain/model";
import {
  mapApplication,
  mapArtist,
  mapCollaboration,
  mapContribution,
  mapMessage,
  mapOffer,
  mapProposal,
  mapVerse,
} from "@/server/mappers";

/** Private slices collapse to empty for signed-out visitors. */
function emptyPrivate(): Pick<
  Store,
  "applications" | "proposals" | "collaborations" | "messages" | "blocked" | "reports"
> {
  return {
    applications: [],
    proposals: [],
    collaborations: [],
    messages: [],
    blocked: [],
    reports: [],
  };
}

/**
 * Builds the client store for a viewer.
 *
 * Public rows (artists, published verses, active offers, reviews) are visible to
 * everyone. Everything else is scoped to the viewer: applications they sent or
 * received, proposals they are party to, collaborations they participate in, and
 * the deliveries/messages hanging off those collaborations.
 */
export async function loadCatalogStore(viewerArtistId?: string): Promise<Store> {
  const db = getDb();

  const [artistRows, offerRows, verseRows, reviewRows, sampleRows, publicAssetRows] =
    await Promise.all([
      db.select().from(artistProfiles).where(eq(artistProfiles.onboardingComplete, true)),
      db
        .select()
        .from(featureOffers)
        .where(
          viewerArtistId
            ? or(eq(featureOffers.archived, false), eq(featureOffers.artistId, viewerArtistId))
            : eq(featureOffers.archived, false),
        ),
      db
        .select()
        .from(openVerses)
        .where(
          viewerArtistId
            ? or(eq(openVerses.status, "Published"), eq(openVerses.ownerId, viewerArtistId))
            : eq(openVerses.status, "Published"),
        ),
      db.select().from(reviews),
      db.select().from(audioSamples).orderBy(audioSamples.sortOrder),
      db.select().from(assets).where(eq(assets.visibility, "public")),
    ]);

  const publicAssetById = new Map(publicAssetRows.map((a) => [a.id, a]));
  const tracksByArtist = new Map<string, Track[]>();
  for (const s of sampleRows) {
    const asset = publicAssetById.get(s.assetId);
    if (!asset) continue;
    const list = tracksByArtist.get(s.profileId) ?? [];
    list.push({ id: s.id, title: s.title, url: `/api/assets/${asset.id}` });
    tracksByArtist.set(s.profileId, list);
  }

  const versePreviewUrl = (previewAssetId: string | null) => {
    if (!previewAssetId) return undefined;
    return publicAssetById.has(previewAssetId) ? `/api/assets/${previewAssetId}` : undefined;
  };

  const publicStore = {
    version: 1 as const,
    artists: artistRows.map((a) => ({ ...mapArtist(a), tracks: tracksByArtist.get(a.id) ?? [] })),
    offers: offerRows.map(mapOffer),
    verses: verseRows.map((v) => ({ ...mapVerse(v), previewUrl: versePreviewUrl(v.previewAssetId) })),
    reviews: reviewRows.map((r) => ({
      collaboration: r.collaborationId,
      author: r.authorArtistId,
      rating: r.rating,
      text: r.text,
    })),
  };

  if (!viewerArtistId) {
    return { ...publicStore, ...emptyPrivate() };
  }

  // --- Viewer-scoped private data ---------------------------------------
  const myVerseIds = verseRows.filter((v) => v.ownerId === viewerArtistId).map((v) => v.id);

  const participantRows = await db
    .select()
    .from(collaborationParticipants)
    .where(eq(collaborationParticipants.artistId, viewerArtistId));
  const myCollabIds = participantRows.map((p) => p.collaborationId);

  const [appRows, proposalRows, collabRows, blockRows, reportRows] = await Promise.all([
    db
      .select()
      .from(applications)
      .where(
        myVerseIds.length
          ? or(
              eq(applications.artistId, viewerArtistId),
              inArray(applications.verseId, myVerseIds),
            )
          : eq(applications.artistId, viewerArtistId),
      ),
    db
      .select()
      .from(proposals)
      .where(
        or(
          eq(proposals.fromArtistId, viewerArtistId),
          eq(proposals.toArtistId, viewerArtistId),
        ),
      ),
    myCollabIds.length
      ? db.select().from(collaborations).where(inArray(collaborations.id, myCollabIds))
      : Promise.resolve([]),
    db.select().from(blocks).where(eq(blocks.blockerArtistId, viewerArtistId)),
    db.select().from(reports).where(eq(reports.authorArtistId, viewerArtistId)),
  ]);

  const myProposalIds = proposalRows.map((p) => p.id);
  const [msgRows, allParticipantRows, contribRows] = await Promise.all([
    myProposalIds.length
      ? db
          .select()
          .from(messages)
          .where(inArray(messages.proposalId, myProposalIds))
          .orderBy(desc(messages.createdAt))
      : Promise.resolve([]),
    myCollabIds.length
      ? db
          .select()
          .from(collaborationParticipants)
          .where(inArray(collaborationParticipants.collaborationId, myCollabIds))
      : Promise.resolve([]),
    myCollabIds.length
      ? db.select().from(contributions).where(inArray(contributions.collaborationId, myCollabIds))
      : Promise.resolve([]),
  ]);

  const contribIds = contribRows.map((c) => c.id);
  const deliveryRows = contribIds.length
    ? await db.select().from(deliveries).where(inArray(deliveries.contributionId, contribIds))
    : [];
  const deliveryIds = deliveryRows.map((d) => d.id);
  const fileRows = deliveryIds.length
    ? await db.select().from(deliveryFiles).where(inArray(deliveryFiles.deliveryId, deliveryIds))
    : [];
  const deliveryAssetIds = fileRows.map((f) => f.assetId);
  const deliveryAssetRows = deliveryAssetIds.length
    ? await db.select().from(assets).where(inArray(assets.id, deliveryAssetIds))
    : [];
  const assetById = new Map(deliveryAssetRows.map((a) => [a.id, a]));

  const filesByDelivery = new Map<string, typeof fileRows>();
  for (const f of fileRows) {
    const list = filesByDelivery.get(f.deliveryId) ?? [];
    list.push(f);
    filesByDelivery.set(f.deliveryId, list);
  }

  const deliveriesByContrib = new Map<
    string,
    {
      id: string;
      version: number;
      at: string;
      author: string;
      notes: string;
      files: { name: string; size: number; type: string; url?: string }[];
    }[]
  >();
  for (const d of deliveryRows) {
    const files = (filesByDelivery.get(d.id) ?? []).map((f) => {
      const asset = assetById.get(f.assetId);
      return {
        name: f.name,
        size: asset?.size ?? 0,
        type: asset?.mime ?? "application/octet-stream",
        url: asset ? `/api/assets/${asset.id}` : undefined,
      };
    });
    const list = deliveriesByContrib.get(d.contributionId) ?? [];
    list.push({
      id: d.id,
      version: d.version,
      at: d.createdAt.toISOString(),
      author: d.authorArtistId,
      notes: d.notes,
      files,
    });
    deliveriesByContrib.set(d.contributionId, list);
  }

  const contribsByCollab = new Map<string, ReturnType<typeof mapContribution>[]>();
  for (const c of contribRows) {
    const list = contribsByCollab.get(c.collaborationId) ?? [];
    list.push(mapContribution(c, deliveriesByContrib.get(c.id) ?? []));
    contribsByCollab.set(c.collaborationId, list);
  }

  const partsByCollab = new Map<string, string[]>();
  for (const p of allParticipantRows) {
    const list = partsByCollab.get(p.collaborationId) ?? [];
    list.push(p.artistId);
    partsByCollab.set(p.collaborationId, list);
  }

  return {
    ...publicStore,
    applications: appRows.map(mapApplication),
    proposals: proposalRows.map(mapProposal),
    collaborations: collabRows.map((c) =>
      mapCollaboration(c, partsByCollab.get(c.id) ?? [], contribsByCollab.get(c.id) ?? []),
    ),
    messages: msgRows.map(mapMessage),
    blocked: blockRows.map((b) => b.blockedArtistId),
    reports: reportRows.map((r) => ({
      target: r.target,
      reason: r.reason,
      author: r.authorArtistId,
    })),
  };
}

export async function searchArtists(input: {
  q?: string;
  genre?: string;
  language?: string;
  mode?: string;
  maxPrice?: number;
  maxDays?: number;
}) {
  const db = getDb();
  const conditions = [eq(artistProfiles.onboardingComplete, true)];
  if (input.q) {
    conditions.push(
      or(
        ilike(artistProfiles.name, `%${input.q}%`),
        ilike(artistProfiles.bio, `%${input.q}%`),
      )!,
    );
  }
  if (input.genre && input.genre !== "All sounds") {
    conditions.push(eq(artistProfiles.genre, input.genre));
  }
  if (input.language && input.language !== "All languages") {
    conditions.push(eq(artistProfiles.language, input.language));
  }
  if (input.mode === "Trade") conditions.push(eq(artistProfiles.trade, true));
  if (input.maxPrice != null) {
    conditions.push(sql`${artistProfiles.priceCents} <= ${Math.round(input.maxPrice * 100)}`);
  }
  if (input.maxDays != null) {
    conditions.push(sql`${artistProfiles.deliveryDays} <= ${input.maxDays}`);
  }
  const rows = await db
    .select()
    .from(artistProfiles)
    .where(and(...conditions))
    .orderBy(desc(artistProfiles.createdAt));
  return rows.map(mapArtist);
}
