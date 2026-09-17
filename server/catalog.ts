"use server";

import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  applications,
  artistProfiles,
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
  assets,
} from "@/db/schema";
import type { Store } from "@/domain/model";
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

export async function loadCatalogStore(viewerArtistId?: string): Promise<Store> {
  const db = getDb();
  const [
    artists,
    offers,
    verses,
    apps,
    props,
    collabs,
    msgs,
    reviewRows,
    reportRows,
  ] = await Promise.all([
    db.select().from(artistProfiles).where(eq(artistProfiles.onboardingComplete, true)),
    db.select().from(featureOffers),
    db.select().from(openVerses),
    db.select().from(applications),
    db.select().from(proposals),
    db.select().from(collaborations),
    db.select().from(messages).orderBy(desc(messages.createdAt)),
    db.select().from(reviews),
    db.select().from(reports),
  ]);

  const contribRows = await db.select().from(contributions);
  const deliveryRows = await db.select().from(deliveries);
  const fileRows = await db.select().from(deliveryFiles);
  const assetRows = await db.select().from(assets);
  const participantRows = await db.select().from(collaborationParticipants);
  const blockRows = viewerArtistId
    ? await db.select().from(blocks).where(eq(blocks.blockerArtistId, viewerArtistId))
    : [];

  const assetById = new Map(assetRows.map((a) => [a.id, a]));
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
  for (const p of participantRows) {
    const list = partsByCollab.get(p.collaborationId) ?? [];
    list.push(p.artistId);
    partsByCollab.set(p.collaborationId, list);
  }

  return {
    version: 1,
    artists: artists.map(mapArtist),
    offers: offers.map(mapOffer),
    verses: verses.map(mapVerse),
    applications: apps.map(mapApplication),
    proposals: props.map(mapProposal),
    collaborations: collabs.map((c) =>
      mapCollaboration(c, partsByCollab.get(c.id) ?? [], contribsByCollab.get(c.id) ?? []),
    ),
    messages: msgs.map(mapMessage),
    blocked: blockRows.map((b) => b.blockedArtistId),
    reports: reportRows.map((r) => ({
      target: r.target,
      reason: r.reason,
      author: r.authorArtistId,
    })),
    reviews: reviewRows.map((r) => ({
      collaboration: r.collaborationId,
      author: r.authorArtistId,
      rating: r.rating,
      text: r.text,
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
