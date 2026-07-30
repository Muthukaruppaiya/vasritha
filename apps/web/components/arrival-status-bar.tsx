"use client";

import Image from "next/image";
import Link from "next/link";
import { X } from "lucide-react";
import { useState } from "react";

const statuses = [
  { label: "New Sarees", image: "/hero-silk.png", href: "/sarees" },
  { label: "Festive Edit", image: "/hero-salwar.png", href: "/churidhars-salwars" },
  { label: "Jewelry Drop", image: "/hero-jewelry.png", href: "/jewelry" },
  { label: "Exclusive Offers", image: "/vasritha-logo.png", href: "/checkout" }
];

export function ArrivalStatusBar() {
  const [selected, setSelected] = useState<(typeof statuses)[number] | null>(null);

  return (
    <section className="status-section">
      <div className="shell">
        <div className="status-head"><div><div className="eyebrow">Fresh from Vasritha</div><h2>New arrivals & updates</h2></div><span className="muted">Tap a story to explore</span></div>
        <div className="status-list">
          {statuses.map((status) => (
            <button className="status-item" type="button" onClick={() => setSelected(status)} key={status.label}>
              <span className="status-ring"><span className="status-image"><Image src={status.image} alt="" fill sizes="118px" /></span></span>
              <span>{status.label}</span>
            </button>
          ))}
        </div>
      </div>
      {selected && <div className="status-modal" role="dialog" aria-modal="true" aria-label={selected.label}>
        <button className="status-modal-backdrop" aria-label="Close preview" onClick={() => setSelected(null)} />
        <div className="status-modal-card">
          <button className="status-modal-close" aria-label="Close preview" onClick={() => setSelected(null)}><X size={20} /></button>
          <Image src={selected.image} alt={selected.label} width={546} height={819} />
          <div><div className="eyebrow">Vasritha update</div><h3>{selected.label}</h3><Link className="btn" href={selected.href} onClick={() => setSelected(null)}>Explore now</Link></div>
        </div>
      </div>}
    </section>
  );
}
