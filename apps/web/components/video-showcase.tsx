"use client";

import { Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "../lib/i18n/provider";
import type { MessageKey } from "../lib/i18n/translate";

const VIDEO_DEFS: Array<{ titleKey: MessageKey; subtitleKey: MessageKey; source: string }> = [
  { titleKey: "home.videoFresh", subtitleKey: "home.videoFreshSub", source: "/boutique-01.mp4" },
  { titleKey: "home.videoSaree", subtitleKey: "home.videoSareeSub", source: "/boutique-02.mp4" },
  { titleKey: "home.videoFestive", subtitleKey: "home.videoFestiveSub", source: "/boutique-03.mp4" },
  { titleKey: "home.videoCurated", subtitleKey: "home.videoCuratedSub", source: "/boutique-04.mp4" }
];

export function VideoShowcase() {
  const t = useT();
  const [activeIndex, setActiveIndex] = useState(0);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  const videos = useMemo(
    () =>
      VIDEO_DEFS.map((item) => ({
        title: t(item.titleKey),
        subtitle: t(item.subtitleKey),
        source: item.source
      })),
    [t]
  );

  useEffect(() => {
    videoRefs.current.forEach((video, index) => {
      if (!video) return;
      if (index === activeIndex) {
        video.currentTime = 0;
        video.play().catch(() => undefined);
      } else {
        video.pause();
      }
    });
  }, [activeIndex]);

  const advance = () => setActiveIndex((current) => (current + 1) % videos.length);

  return (
    <section className="video-showcase" data-reveal>
      <div className="shell video-heading">
        <div>
          <div className="eyebrow">{t("home.insideVasritha")}</div>
          <h2>{t("home.videoTitle")}</h2>
        </div>
        <p className="muted">{t("home.videoLead")}</p>
      </div>
      <div className="video-stage">
        {videos.map((video, index) => {
          const offset = (index - activeIndex + videos.length) % videos.length;
          const position = offset > Math.floor(videos.length / 2) ? offset - videos.length : offset;
          const isActive = position === 0;

          return (
            <button
              key={video.source}
              className={`video-card video-position-${position} ${isActive ? "is-active" : ""}`}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={video.title}
            >
              <video
                ref={(element) => {
                  videoRefs.current[index] = element;
                }}
                src={video.source}
                muted
                playsInline
                autoPlay={isActive}
                preload="metadata"
                onCanPlay={(event) => {
                  if (isActive) event.currentTarget.play().catch(() => undefined);
                }}
                onEnded={isActive ? advance : undefined}
                onError={isActive ? advance : undefined}
              />
              <span className="video-shade" />
              <span className="video-copy">
                <small>{video.subtitle}</small>
                <strong>{video.title}</strong>
              </span>
              {!isActive && (
                <span className="video-play">
                  <Play size={20} fill="currentColor" />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="video-progress" aria-label={videos[activeIndex]?.title}>
        {videos.map((video, index) => (
          <button
            type="button"
            key={video.source}
            className={index === activeIndex ? "active" : ""}
            onClick={() => setActiveIndex(index)}
            aria-label={video.title}
          />
        ))}
      </div>
    </section>
  );
}
