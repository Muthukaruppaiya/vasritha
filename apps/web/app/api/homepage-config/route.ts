import { NextRequest } from "next/server";
import { cachedOk } from "../../../lib/auth/api";
import { query } from "../../../lib/db/pool";

export async function GET() {
  const today = new Date().toISOString().slice(0, 10);

  const [offers, heroSlides, statusStories, showcase] = await Promise.all([
    query<{
      id: string;
      message: string;
      link_url: string | null;
      sort_order: number;
    }>(
      `select id, message, link_url, sort_order
       from offer_ticker_items
       where is_active = true
       order by sort_order asc, created_at asc`
    ).catch(() => []),
    query<{
      id: string;
      image_path: string;
      alt_text: string | null;
      title: string | null;
      subtitle: string | null;
      cta_label: string | null;
      cta_href: string | null;
      cta2_label: string | null;
      cta2_href: string | null;
      sort_order: number;
    }>(
      `select id, image_path, alt_text, title, subtitle,
              cta_label, cta_href, cta2_label, cta2_href, sort_order
       from hero_slides
       where is_active = true
       order by sort_order asc, created_at asc
       limit 5`
    ).catch(() => []),
    query<{
      id: string;
      label: string;
      image_path: string;
      href: string | null;
      display_date: string;
      sort_order: number;
    }>(
      `select id, label, image_path, href, display_date::text, sort_order
       from status_stories
       where is_active = true
         and display_date = $1::date
       order by sort_order asc, created_at asc`,
      [today]
    ).catch(() => []),
    query<{
      id: string;
      title: string;
      subtitle: string | null;
      media_path: string;
      media_type: string;
      sort_order: number;
    }>(
      `select id, title, subtitle, media_path, media_type, sort_order
       from showcase_media
       where is_active = true
       order by sort_order asc, created_at asc
       limit 8`
    ).catch(() => [])
  ]);

  return cachedOk(
    {
      offers: offers.map((row) => ({
        id: row.id,
        message: row.message,
        linkUrl: row.link_url,
        sortOrder: row.sort_order
      })),
      heroSlides: heroSlides.map((row) => ({
        id: row.id,
        image: row.image_path,
        alt: row.alt_text || row.title || "Vasritha",
        title: row.title,
        subtitle: row.subtitle,
        ctaLabel: row.cta_label,
        ctaHref: row.cta_href,
        cta2Label: row.cta2_label,
        cta2Href: row.cta2_href,
        sortOrder: row.sort_order
      })),
      statusStories: statusStories.map((row) => ({
        id: row.id,
        label: row.label,
        image: row.image_path,
        href: row.href || "/collections",
        displayDate: row.display_date,
        sortOrder: row.sort_order
      })),
      showcase: showcase.map((row) => ({
        id: row.id,
        title: row.title,
        subtitle: row.subtitle,
        source: row.media_path,
        mediaType: row.media_type,
        sortOrder: row.sort_order
      }))
    },
    15
  );
}
