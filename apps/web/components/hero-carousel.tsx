"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

const slides = [
  { image: "/hero-silk.png", alt: "Model wearing a Kanchipuram silk saree" },
  { image: "/hero-salwar.png", alt: "Model wearing an embroidered churidhar salwar suit" },
  { image: "/hero-jewelry.png", alt: "Model wearing traditional gold jewelry" }
];

export function HeroCarousel() {
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => setActiveSlide((current) => (current + 1) % slides.length), 3000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <section className="hero">
      <div className="hero-track" style={{ transform: `translateX(-${activeSlide * 100}%)` }}>
        {slides.map((slide) => <div className="hero-slide" key={slide.image}><Image src={slide.image} alt={slide.alt} fill priority={slide.image === slides[0].image} sizes="100vw" /></div>)}
      </div>
      <div className="hero-copy"><div className="eyebrow">Vasritha presents</div><h1>Elegance woven for every story.</h1><p>Discover heirloom silks, luminous jewelry, graceful apparel, and handcrafted treasures curated with care.</p><Link className="btn" href="/sarees">Explore Sarees</Link><Link className="btn ghost" href="/jewelry">Discover Jewelry</Link></div>
      <div className="hero-thumbnails" aria-hidden="true">
        {slides.filter((_, index) => index !== activeSlide).map((slide) => <div className="hero-thumbnail" key={slide.image}><Image src={slide.image} alt="" fill sizes="100px" /></div>)}
      </div>
      <div className="hero-dots">{slides.map((slide, index) => <button key={slide.image} type="button" className={index === activeSlide ? "active" : ""} aria-label={`Show slide ${index + 1}`} onClick={() => setActiveSlide(index)} />)}</div>
    </section>
  );
}
