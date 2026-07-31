import Image from "next/image";
import Link from "next/link";
import { spotlightSections } from "../lib/mock-data";

export function SpotlightCollections() {
  return (
    <div className="spotlight-stack">
      {spotlightSections.map((section) => (
        <section
          key={section.id}
          className={`shell section spotlight-section spotlight-section--${section.id}`}
          data-reveal
        >
          <div className="spotlight-head">
            <div className="eyebrow">{section.eyebrow}</div>
            <h2>{section.title}</h2>
            <div className="spotlight-rule" aria-hidden="true" />
            <div className="spotlight-meta">
              <p className="muted">{section.lead}</p>
              <Link className="spotlight-link" href={section.href}>
                View all <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>

          <div className="overlay-card-grid spotlight-grid">
            {section.items.map((item, index) => (
              <Link
                key={item.name}
                href={item.href}
                className="overlay-card"
                data-reveal
                data-reveal-delay={String((index % 4) + 1)}
              >
                <Image src={item.image} alt={item.name} fill sizes="(max-width:800px) 48vw, 24vw" />
                <span className="overlay-card-veil" aria-hidden="true" />
                <span className="overlay-card-title">
                  {item.lines.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
