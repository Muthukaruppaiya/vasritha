"use client";

import Image from "next/image";
import Link from "next/link";
import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { useT } from "../lib/i18n/provider";
import type { MessageKey } from "../lib/i18n/translate";

const STATUS_DEFS: Array<{ labelKey: MessageKey; image: string; href: string }> = [
  { labelKey: "home.statusNewSarees", image: "/hero-silk.png", href: "/sarees" },
  { labelKey: "home.statusFestive", image: "/hero-salwar.png", href: "/churidhars-salwars" },
  { labelKey: "home.statusJewelry", image: "/hero-jewelry.png", href: "/jewelry" },
  { labelKey: "home.statusCottons", image: "/catalog-cotton-saree.png", href: "/sarees" },
  { labelKey: "home.statusBangles", image: "/catalog-bangles.png", href: "/jewelry" },
  { labelKey: "home.statusHandcrafted", image: "/catalog-wooden-item.png", href: "/handcrafted" },
  { labelKey: "home.statusOffers", image: "/catalog-earrings.png", href: "/checkout" }
];

export function ArrivalStatusBar() {
  const t = useT();
  const statuses = useMemo(
    () =>
      STATUS_DEFS.map((item) => ({
        label: t(item.labelKey),
        image: item.image,
        href: item.href
      })),
    [t]
  );
  const [selected, setSelected] = useState<(typeof statuses)[number] | null>(null);

  return (
    <section className="status-section" data-reveal>
      <div className="shell">
        <div className="status-head">
          <div>
            <div className="eyebrow">{t("home.freshFrom")}</div>
            <h2>{t("home.newArrivalsUpdates")}</h2>
          </div>
          <span className="muted">{t("home.arrivalHint")}</span>
        </div>
        <div className="status-list">
          {statuses.map((status) => (
            <button
              className="status-item"
              type="button"
              onClick={() => setSelected(status)}
              key={status.label}
            >
              <span className="status-ring">
                <span className="status-image">
                  <Image src={status.image} alt="" fill sizes="118px" />
                </span>
              </span>
              <span>{status.label}</span>
            </button>
          ))}
        </div>
      </div>
      {selected && (
        <div className="status-modal" role="dialog" aria-modal="true" aria-label={selected.label}>
          <button
            className="status-modal-backdrop"
            aria-label={t("home.closePreview")}
            onClick={() => setSelected(null)}
          />
          <div className="status-modal-card">
            <button
              className="status-modal-close"
              aria-label={t("home.closePreview")}
              onClick={() => setSelected(null)}
            >
              <X size={20} />
            </button>
            <Image src={selected.image} alt={selected.label} width={546} height={819} />
            <div>
              <div className="eyebrow">{t("home.arrivalUpdate")}</div>
              <h3>{selected.label}</h3>
              <Link className="btn" href={selected.href} onClick={() => setSelected(null)}>
                {t("home.exploreNow")}
              </Link>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
