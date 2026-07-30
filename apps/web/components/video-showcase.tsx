"use client";

import { Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const videos = [
  { title: "Fresh Arrivals", subtitle: "From the boutique floor", source: "/boutique-01.mp4" },
  { title: "Saree Stories", subtitle: "Timeless drapes", source: "/boutique-02.mp4" },
  { title: "The Festive Rack", subtitle: "Chosen for celebrations", source: "/boutique-03.mp4" },
  { title: "Curated for You", subtitle: "The Vasritha edit", source: "/boutique-04.mp4" }
];

export function VideoShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

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
    <section className="video-showcase">
      <div className="shell video-heading"><div><div className="eyebrow">Inside Vasritha</div><h2>Explore the boutique edit.</h2></div><p className="muted">A closer look at what&apos;s new in store.</p></div>
      <div className="video-stage">
        {videos.map((video, index) => {
          const offset = (index - activeIndex + videos.length) % videos.length;
          const position = offset > Math.floor(videos.length / 2) ? offset - videos.length : offset;
          const isActive = position === 0;

          return (
            <button key={video.title} className={`video-card video-position-${position} ${isActive ? "is-active" : ""}`} type="button" onClick={() => setActiveIndex(index)} aria-label={`Play ${video.title}`}>
              <video ref={(element) => { videoRefs.current[index] = element; }} src={video.source} muted playsInline autoPlay={isActive} preload="metadata" onCanPlay={(event) => { if (isActive) event.currentTarget.play().catch(() => undefined); }} onEnded={isActive ? advance : undefined} onError={isActive ? advance : undefined} />
              <span className="video-shade" />
              <span className="video-copy"><small>{video.subtitle}</small><strong>{video.title}</strong></span>
              {!isActive && <span className="video-play"><Play size={20} fill="currentColor" /></span>}
            </button>
          );
        })}
      </div>
      <div className="video-progress" aria-label={`Playing ${videos[activeIndex].title}`}>{videos.map((video, index) => <button type="button" key={video.title} className={index === activeIndex ? "active" : ""} onClick={() => setActiveIndex(index)} aria-label={`Show ${video.title}`} />)}</div>
    </section>
  );
}
