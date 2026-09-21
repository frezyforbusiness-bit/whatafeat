import type { Artist, FeatStatus, PricingMode } from "@/domain/model";
import { Artwork } from "@/features/player";
import {
  featStatusLabel,
  formatArtistTypes,
  formatFeatPrice,
} from "@/lib/profile-constants";

/** Local wizard / editor state — priceCents mirrors Artist.price. */
export type ProfileDraft = {
  name: string;
  slug: string;
  location: string;
  artistTypes: string[];
  genres: string[];
  influences: string[];
  language: string;
  bio: string;
  description: string;
  spotifyUrl: string;
  appleMusicUrl: string;
  soundcloudUrl: string;
  youtubeUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  featuredTrackUrl: string;
  featStatus: FeatStatus;
  collaborationTypes: string[];
  pricingMode: PricingMode;
  priceCents: number;
  currency: string;
  art: number;
  avatarUrl?: string;
  demo?: boolean;
};

export function artistToDraft(a?: Partial<Artist> | null): ProfileDraft {
  return {
    name: a?.name ?? "",
    slug: a?.slug ?? "",
    location: a?.location ?? "",
    artistTypes: a?.artistTypes ?? [],
    genres: a?.genres?.length ? a.genres : a?.genre ? [a.genre] : [],
    influences: a?.influences ?? [],
    language: a?.language ?? "English",
    bio: a?.bio ?? "",
    description: a?.description ?? "",
    spotifyUrl: a?.spotifyUrl ?? "",
    appleMusicUrl: a?.appleMusicUrl ?? "",
    soundcloudUrl: a?.soundcloudUrl ?? "",
    youtubeUrl: a?.youtubeUrl ?? "",
    instagramUrl: a?.instagramUrl ?? "",
    tiktokUrl: a?.tiktokUrl ?? "",
    featuredTrackUrl: a?.featuredTrackUrl ?? "",
    featStatus: a?.featStatus ?? "open",
    collaborationTypes: a?.collaborationTypes ?? [],
    pricingMode: a?.pricingMode ?? "starting_from",
    priceCents: a?.price ?? 15000,
    currency: a?.currency ?? "EUR",
    art: a?.art ?? 0,
    avatarUrl: a?.avatarUrl,
    demo: a?.demo,
  };
}

function linkList(a: ProfileDraft) {
  return (
    [
      ["spotify", a.spotifyUrl],
      ["apple music", a.appleMusicUrl],
      ["soundcloud", a.soundcloudUrl],
      ["youtube", a.youtubeUrl],
      ["instagram", a.instagramUrl],
      ["tiktok", a.tiktokUrl],
    ] as const
  ).filter(([, url]) => !!url);
}

export function ProfilePreview({ draft }: { draft: ProfileDraft }) {
  const types = formatArtistTypes(draft.artistTypes);
  const pricing = formatFeatPrice({
    pricingMode: draft.pricingMode,
    priceCents: draft.priceCents,
    currency: draft.currency,
  });

  return (
    <div className="profile-preview">
      <div className="artist-header">
        <Artwork art={draft.art} src={draft.avatarUrl} alt={draft.name || "artist"} />
        <div>
          <h2>{draft.name || "your name"}</h2>
          <p className="byline-text">@{draft.slug || "username"}</p>
          {(draft.location || types) && (
            <p className="fine">{[draft.location, types].filter(Boolean).join(" · ")}</p>
          )}
          <div className="tags">
            {draft.genres.slice(0, 4).map((g) => (
              <span key={g}>{g}</span>
            ))}
            <span>{featStatusLabel(draft.featStatus)}</span>
          </div>
          {draft.bio ? <p>{draft.bio}</p> : null}
        </div>
      </div>
      {draft.featuredTrackUrl ? (
        <div className="panel">
          <h3>featured</h3>
          <a
            href={
              draft.featuredTrackUrl.startsWith("http")
                ? draft.featuredTrackUrl
                : `https://${draft.featuredTrackUrl}`
            }
            target="_blank"
            rel="noreferrer"
          >
            {draft.featuredTrackUrl}
          </a>
        </div>
      ) : null}
      <div className="panel">
        <h3>feats</h3>
        <p>{featStatusLabel(draft.featStatus)}</p>
        <p className="fine">{pricing}</p>
        {draft.collaborationTypes.length > 0 && (
          <p className="fine">{draft.collaborationTypes.join(" · ")}</p>
        )}
      </div>
      {linkList(draft).length > 0 && (
        <div className="panel">
          <h3>links</h3>
          <ul className="link-list">
            {linkList(draft).map(([label, url]) => (
              <li key={label}>
                <a href={url.startsWith("http") ? url : `https://${url}`} target="_blank" rel="noreferrer">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
