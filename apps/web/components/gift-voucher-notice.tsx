"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { dismissVoucher, setAppliedCoupon, wasVoucherDismissed } from "../lib/applied-coupon";

type OpeningVoucher = {
  id: string;
  code: string;
  headline: string;
  description: string;
  discountType: string;
  discountValue: number;
  minOrderAmount: number;
};

export function GiftVoucherNotice() {
  const pathname = usePathname();
  const router = useRouter();
  const [voucher, setVoucher] = useState<OpeningVoucher | null>(null);
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (window.location.pathname.startsWith("/admin")) return;

    fetch("/api/gift-vouchers/opening")
      .then((res) => res.json())
      .then((payload) => {
        const next = payload?.data?.voucher as OpeningVoucher | null;
        if (!next?.id || wasVoucherDismissed(next.id)) return;
        setVoucher(next);
        setOpen(true);
      })
      .catch(() => undefined);
  }, []);

  if (!open || !voucher || pathname?.startsWith("/admin")) return null;

  const discountLabel =
    voucher.discountType === "percentage"
      ? `${voucher.discountValue}% off`
      : `₹${voucher.discountValue.toLocaleString("en-IN")} off`;

  const close = () => {
    dismissVoucher(voucher.id);
    setOpen(false);
  };

  const useIt = () => {
    setAppliedCoupon({ id: voucher.id, code: voucher.code });
    dismissVoucher(voucher.id);
    setOpen(false);
    router.push("/cart");
  };

  return (
    <div className="voucher-overlay" role="dialog" aria-modal="true" aria-labelledby="voucher-title">
      <div className="voucher-ticket">
        <p className="voucher-kicker">Gift voucher</p>
        <h2 id="voucher-title">{voucher.headline}</h2>
        {voucher.description ? <p className="voucher-desc">{voucher.description}</p> : null}
        <p className="voucher-hint">
          {revealed ? "Your gift is ready." : "Scratch the gold foil to reveal your code."}
        </p>

        <ScratchPanel
          revealed={revealed}
          onRevealed={() => setRevealed(true)}
          code={voucher.code}
          discountLabel={discountLabel}
          minOrderAmount={voucher.minOrderAmount}
        />

        <div className="voucher-actions">
          <button type="button" className="btn" onClick={useIt} disabled={!revealed}>
            Use this voucher
          </button>
          <button type="button" className="btn ghost" onClick={close}>
            Close and continue
          </button>
        </div>
      </div>
    </div>
  );
}

function ScratchPanel({
  revealed,
  onRevealed,
  code,
  discountLabel,
  minOrderAmount
}: {
  revealed: boolean;
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
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#8a5a22");
    g.addColorStop(0.35, "#e8c36a");
    g.addColorStop(0.55, "#f6e2a2");
    g.addColorStop(0.75, "#c79b6c");
    g.addColorStop(1, "#6f4230");
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(255,248,220,0.28)";
    ctx.lineWidth = 6;
    for (let x = -h; x < w + h; x += 28) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + h, h);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(62, 36, 24, 0.82)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${Math.round(h * 0.09)}px sans-serif`;
    ctx.fillText("SCRATCH HERE", w / 2, h / 2 - h * 0.08);
    ctx.font = `600 ${Math.round(h * 0.055)}px sans-serif`;
    ctx.fillText("to reveal your gift", w / 2, h / 2 + h * 0.08);
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
    ctx.lineWidth = Math.max(canvas.width, canvas.height) * 0.14;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  };

  const finishIfReady = () => {
    if (done.current) return;
    if (scratchPercent() < 0.42) return;
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
    <div ref={wrapRef} className={`voucher-scratch${revealed ? " is-open" : ""}`}>
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
