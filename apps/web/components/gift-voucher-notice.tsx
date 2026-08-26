"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { claimOpeningVoucher, dismissVoucher, wasVoucherDismissed } from "../lib/applied-coupon";

type OpeningVoucher = {
  id: string;
  code: string;
  headline: string;
  description: string;
  discountType: string;
  discountValue: number;
  minOrderAmount: number;
};

function LaurelWreath() {
  return (
    <svg className="voucher-wreath" viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <linearGradient id="voucher-gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fff8d6" />
          <stop offset="35%" stopColor="#e8c86a" />
          <stop offset="70%" stopColor="#c9a227" />
          <stop offset="100%" stopColor="#8a6018" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="url(#voucher-gold)" strokeWidth="2.6" strokeLinecap="round">
        <path d="M60 104c-20-2-36-18-40-38-3-16 3-33 16-44" />
        <path d="M60 104c20-2 36-18 40-38 3-16-3-33-16-44" />
      </g>
      <g fill="url(#voucher-gold)">
        <ellipse cx="26" cy="80" rx="4.5" ry="8.5" transform="rotate(-30 26 80)" />
        <ellipse cx="22" cy="66" rx="4.5" ry="8.5" transform="rotate(-20 22 66)" />
        <ellipse cx="22" cy="52" rx="4.5" ry="8.5" transform="rotate(-8 22 52)" />
        <ellipse cx="27" cy="38" rx="4.5" ry="8.5" transform="rotate(10 27 38)" />
        <ellipse cx="36" cy="27" rx="4.5" ry="8.5" transform="rotate(26 36 27)" />
        <ellipse cx="94" cy="80" rx="4.5" ry="8.5" transform="rotate(30 94 80)" />
        <ellipse cx="98" cy="66" rx="4.5" ry="8.5" transform="rotate(20 98 66)" />
        <ellipse cx="98" cy="52" rx="4.5" ry="8.5" transform="rotate(8 98 52)" />
        <ellipse cx="93" cy="38" rx="4.5" ry="8.5" transform="rotate(-10 93 38)" />
        <ellipse cx="84" cy="27" rx="4.5" ry="8.5" transform="rotate(-26 84 27)" />
        <circle cx="60" cy="106" r="2.8" />
      </g>
    </svg>
  );
}

function CornerFlourish({ corner }: { corner: "tl" | "tr" | "bl" | "br" }) {
  return (
    <svg className={`voucher-corner voucher-corner--${corner}`} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id={`corner-gold-${corner}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fff8d6" />
          <stop offset="55%" stopColor="#e8c86a" />
          <stop offset="100%" stopColor="#9a6f24" />
        </linearGradient>
      </defs>
      <path
        fill="none"
        stroke={`url(#corner-gold-${corner})`}
        strokeWidth="1.4"
        d="M8 40 C8 18 18 8 40 8 M14 40 C14 22 22 14 40 14"
      />
      <circle cx="8" cy="40" r="1.6" fill="#e8c86a" />
      <circle cx="40" cy="8" r="1.6" fill="#e8c86a" />
    </svg>
  );
}

function OrnamentBand({ position }: { position: "top" | "bottom" }) {
  return (
    <div className={`voucher-ornament voucher-ornament--${position}`} aria-hidden="true">
      <svg viewBox="0 0 480 28" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={`band-gold-${position}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fff0b8" />
            <stop offset="45%" stopColor="#d4af37" />
            <stop offset="100%" stopColor="#8d6520" />
          </linearGradient>
        </defs>
        {Array.from({ length: 12 }).map((_, i) => {
          const x = 20 + i * 40;
          return (
            <g key={i} fill={`url(#band-gold-${position})`}>
              <path d={`M${x} 4 L${x + 8} 14 L${x} 24 L${x - 8} 14 Z`} />
              <path
                d={`M${x} 8 L${x + 4.5} 14 L${x} 20 L${x - 4.5} 14 Z`}
                fill="#2b1b17"
                opacity="0.35"
              />
              <circle cx={x + 20} cy="14" r="1.4" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function CelebrateBurst({ active }: { active: boolean }) {
  const bits = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        id: i,
        left: 8 + ((i * 37) % 84),
        delay: (i % 8) * 0.04,
        duration: 0.85 + (i % 5) * 0.12,
        size: 4 + (i % 4) * 2,
        drift: -40 + ((i * 17) % 80),
        kind: i % 4 === 0 ? "star" : i % 3 === 0 ? "ribbon" : "dot"
      })),
    []
  );

  if (!active) return null;

  return (
    <div className="voucher-celebrate" aria-hidden="true">
      <div className="voucher-burst-ring" />
      <div className="voucher-burst-rays" />
      <div className="voucher-sparkle voucher-sparkle--a" />
      <div className="voucher-sparkle voucher-sparkle--b" />
      <div className="voucher-sparkle voucher-sparkle--c" />
      {bits.map((bit) => (
        <span
          key={bit.id}
          className={`voucher-confetti voucher-confetti--${bit.kind}`}
          style={{
            left: `${bit.left}%`,
            width: bit.size,
            height: bit.kind === "ribbon" ? bit.size * 2.2 : bit.size,
            animationDelay: `${bit.delay}s`,
            animationDuration: `${bit.duration}s`,
            ["--drift" as string]: `${bit.drift}px`
          }}
        />
      ))}
      <div className="voucher-seal">
        <span>CLAIMED</span>
      </div>
    </div>
  );
}

export function GiftVoucherNotice() {
  const pathname = usePathname();
  const ticketRef = useRef<HTMLDivElement>(null);
  const [voucher, setVoucher] = useState<OpeningVoucher | null>(null);
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [flying, setFlying] = useState(false);

  useEffect(() => {
    if (window.location.pathname.startsWith("/admin")) return;

    let cancelled = false;
    fetch("/api/gift-vouchers/opening", { cache: "no-store" })
      .then((res) => res.json())
      .then((payload) => {
        if (cancelled) return;
        const next = payload?.data?.voucher as OpeningVoucher | null;
        if (!next?.id || wasVoucherDismissed(next.id)) return;
        setVoucher(next);
        setOpen(true);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  const flyToHeader = useCallback(() => {
    const ticket = ticketRef.current;
    const dock =
      document.getElementById("header-voucher-dock") ||
      document.querySelector(".bag-link");
    if (!ticket) {
      setOpen(false);
      return;
    }

    const from = ticket.getBoundingClientRect();
    const to = dock?.getBoundingClientRect();
    const targetX = to ? to.left + to.width / 2 : window.innerWidth - 48;
    const targetY = to ? to.top + to.height / 2 : 56;
    const dx = targetX - (from.left + from.width / 2);
    const dy = targetY - (from.top + from.height / 2);

    ticket.style.setProperty("--voucher-fly-x", `${dx}px`);
    ticket.style.setProperty("--voucher-fly-y", `${dy}px`);
    setFlying(true);

    window.setTimeout(() => {
      setOpen(false);
      setFlying(false);
      setCelebrating(false);
    }, 820);
  }, []);

  const claimAndClose = useCallback(
    (current: OpeningVoucher) => {
      setRevealed(true);
      setCelebrating(true);
      window.setTimeout(() => {
        claimOpeningVoucher({
          id: current.id,
          code: current.code,
          headline: current.headline
        });
      }, 180);
      window.setTimeout(() => {
        flyToHeader();
      }, 1280);
    },
    [flyToHeader]
  );

  if (!open || !voucher || pathname?.startsWith("/admin")) return null;

  const discountLabel =
    voucher.discountType === "percentage"
      ? `${voucher.discountValue}% off`
      : `₹${voucher.discountValue.toLocaleString("en-IN")} off`;

  return (
    <div
      className={`voucher-overlay${flying ? " is-flying" : ""}${celebrating ? " is-celebrating" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="voucher-title"
    >
      <div
        ref={ticketRef}
        className={`voucher-ticket${flying ? " is-flying" : ""}${revealed ? " is-revealed" : ""}${celebrating ? " is-celebrating" : ""}`}
      >
        <div className="voucher-glow" aria-hidden="true" />
        <div className="voucher-frame">
          <OrnamentBand position="top" />

          <div className="voucher-certificate">
            <CornerFlourish corner="tl" />
            <CornerFlourish corner="tr" />
            <CornerFlourish corner="bl" />
            <CornerFlourish corner="br" />

            <p className="voucher-eyebrow">Vasritha · Gift Certificate</p>

            <div className="voucher-title-block">
              <div className="voucher-title-main">
                <span className="voucher-dot-line" aria-hidden="true" />
                <h2 id="voucher-title" className="voucher-word">
                  VOUCHER
                </h2>
                <span className="voucher-dot-line" aria-hidden="true" />
              </div>
              <LaurelWreath />
            </div>

            <p className="voucher-headline">{voucher.headline || "A gift for you"}</p>
            <p className="voucher-hint">
              {celebrating
                ? "Gift unlocked · saving to your vouchers"
                : revealed
                  ? `${voucher.code} claimed`
                  : "Scratch the foil to claim your gift"}
            </p>

            <ScratchPanel
              revealed={revealed}
              celebrating={celebrating}
              onRevealed={() => claimAndClose(voucher)}
              code={voucher.code}
              discountLabel={discountLabel}
              minOrderAmount={voucher.minOrderAmount}
            />

            <div className="voucher-footer">
              {!revealed ? (
                <button
                  type="button"
                  className="voucher-skip"
                  onClick={() => {
                    dismissVoucher(voucher.id);
                    setOpen(false);
                  }}
                >
                  Close
                </button>
              ) : (
                <p className="voucher-claimed">{celebrating ? "Celebrating…" : "Claimed"}</p>
              )}
            </div>
          </div>

          <OrnamentBand position="bottom" />
        </div>
        <CelebrateBurst active={celebrating && !flying} />
      </div>
    </div>
  );
}

function ScratchPanel({
  revealed,
  celebrating,
  onRevealed,
  code,
  discountLabel,
  minOrderAmount
}: {
  revealed: boolean;
  celebrating: boolean;
  onRevealed: () => void;
  code: string;
  discountLabel: string;
  minOrderAmount: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const done = useRef(false);

  const paintFoil = useCallback((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;

    const base = ctx.createLinearGradient(0, 0, w, 0);
    base.addColorStop(0, "#6b4214");
    base.addColorStop(0.16, "#b8892f");
    base.addColorStop(0.48, "#f7e7a8");
    base.addColorStop(0.55, "#fff6d0");
    base.addColorStop(0.84, "#b8892f");
    base.addColorStop(1, "#6b4214");
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);

    const shine = ctx.createLinearGradient(0, 0, 0, h);
    shine.addColorStop(0, "rgba(255,255,255,0.22)");
    shine.addColorStop(0.45, "rgba(255,255,255,0.03)");
    shine.addColorStop(1, "rgba(80,45,10,0.22)");
    ctx.fillStyle = shine;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(90, 55, 18, 0.2)";
    ctx.lineWidth = Math.max(2, w * 0.003);
    for (let x = -h; x < w + h; x += Math.max(11, w * 0.02)) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + h, h);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(43, 27, 23, 0.78)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${Math.round(h * 0.15)}px Georgia, "Times New Roman", serif`;
    ctx.fillText("SCRATCH HERE", w / 2, h / 2 - h * 0.1);
    ctx.font = `600 ${Math.round(h * 0.065)}px sans-serif`;
    ctx.fillText("Reveal your gift code", w / 2, h / 2 + h * 0.14);

    // Foil flecks
    ctx.fillStyle = "rgba(255, 248, 210, 0.35)";
    for (let i = 0; i < 18; i += 1) {
      const fx = (i * 97) % w;
      const fy = (i * 53) % h;
      ctx.beginPath();
      ctx.arc(fx, fy, 1.2 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
  }, []);

  const sizeCanvas = useCallback(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas || done.current) return;
    const rect = wrap.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    paintFoil(canvas);
  }, [paintFoil]);

  useEffect(() => {
    sizeCanvas();
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => sizeCanvas());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [sizeCanvas]);

  const scratchPercent = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return 0;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let cleared = 0;
    const step = 16;
    for (let i = 3; i < data.length; i += 4 * step) {
      if (data[i] < 40) cleared += 1;
    }
    return cleared / (data.length / (4 * step));
  };

  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  };

  const erase = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(canvas.width, canvas.height) * 0.13;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  };

  const finishIfReady = () => {
    if (done.current) return;
    if (scratchPercent() < 0.32) return;
    done.current = true;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    onRevealed();
  };

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (done.current) return;
    drawing.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    last.current = point(event);
    erase(last.current, last.current);
  };

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return;
    const next = point(event);
    erase(last.current, next);
    last.current = next;
  };

  const onPointerUp = () => {
    drawing.current = false;
    last.current = null;
    finishIfReady();
  };

  return (
    <div
      ref={wrapRef}
      className={`voucher-scratch${revealed ? " is-open" : ""}${celebrating ? " is-celebrate" : ""}`}
    >
      <div className="voucher-prize">
        <span>Your code</span>
        <strong>{code}</strong>
        <em>
          {discountLabel}
          {minOrderAmount > 0 ? ` · min ₹${minOrderAmount.toLocaleString("en-IN")}` : ""}
        </em>
      </div>
      <canvas
        ref={canvasRef}
        className="voucher-foil"
        aria-label="Scratch to reveal gift voucher"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
    </div>
  );
}
