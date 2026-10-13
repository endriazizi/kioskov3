import type { KioskBannerDto } from '../interfaces/kiosk-api.interfaces';
import type { KioskApiService } from '../providers/kiosk-api.service';

export interface V2Poster {
  key: string;
  kind: 'image' | 'video';
  src: string;
  /** Immagine di riserva (cover o logo dell'attività) se il poster non si carica. */
  fallbackSrc: string;
  slug: string | null;
  businessName: string;
  title: string;
  subtitle: string;
}

/** Stesso vincolo slug del backend e della home attuale: solo navigazione interna sicura. */
export function safeBusinessSlug(raw: unknown): string | null {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s || s.length > 160) return null;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) ? s : null;
}

function slugFromBanner(b: KioskBannerDto): string | null {
  const o = b as Record<string, unknown>;
  const candidates = [
    String(b.target_type ?? '').toLowerCase() === 'business_detail' ? b.target_value : null,
    b.slug,
    b.activitySlug,
    b.businessSlug,
    b.business_slug,
    o['target_value'],
  ];
  for (const c of candidates) {
    const s = safeBusinessSlug(c);
    if (s) return s;
  }
  return null;
}

/**
 * Poster home da GET /api/public-kiosk/banners (o /home-posters).
 * Riusa le regole della home attuale: solo poster approvati, attivi, nella finestra di validità
 * e di attività Premium. Gli URL esterni del payload sono ignorati (il tap porta alla scheda interna).
 */
export function mapBannersToPosters(list: KioskBannerDto[], api: KioskApiService): V2Poster[] {
  const seen = new Set<string>();
  const out: V2Poster[] = [];
  for (const b of list) {
    if (!api.isEligibleKioskHomePoster(b) || !api.isPremiumKioskHomePoster(b)) continue;
    const o = b as Record<string, unknown>;
    const mediaPublic = String(b.public_url ?? o['media_public_url'] ?? b.video_url ?? b.media_url ?? '').trim();
    const mt = String(b.mediaType ?? b.media_type ?? b.poster_media_type ?? '').toLowerCase();
    const mime = String(b.mime_type ?? b.mimeType ?? '').toLowerCase();
    const image = b.image_url ?? b.imageUrl ?? b.poster?.image_url ?? b.poster?.imageUrl ?? b.homePosterUrl ?? b.posterUrl ?? b.src ?? '';
    const isVideo =
      mt === 'video' ||
      mime.startsWith('video/') ||
      api.isLikelyVideoAssetUrl(mediaPublic) ||
      api.isLikelyVideoAssetUrl(String(image));
    const raw = isVideo ? mediaPublic || String(image) : String(image) || mediaPublic;
    const src = raw ? api.resolveAssetUrl(raw) : '';
    if (!src || seen.has(src)) continue;
    seen.add(src);
    const fallbackRaw = b.business_cover_url ?? b.business_logo_url ?? '';
    out.push({
      key: String(b.id ?? src),
      kind: isVideo ? 'video' : 'image',
      src,
      fallbackSrc: fallbackRaw ? api.resolveAssetUrl(fallbackRaw) : '',
      slug: slugFromBanner(b),
      businessName: String(b.businessName ?? b.business_name ?? '').trim(),
      title: String(b.title ?? '').trim(),
      subtitle: String(b.subtitle ?? '').trim(),
    });
  }
  return out;
}
