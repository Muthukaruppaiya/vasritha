"use client";

import { FaWhatsapp } from "react-icons/fa";
import { useRef, useState, type CSSProperties, type PointerEvent } from "react";

const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "919000000000";

export function WhatsAppFloat() {
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const drag = useRef<{ offsetX: number; offsetY: number } | null>(null);
  const didDrag = useRef(false);

  const move = (event: PointerEvent<HTMLAnchorElement>) => {
    if (!drag.current) return;
    const { width, height } = event.currentTarget.getBoundingClientRect();
    const left = Math.max(10, Math.min(window.innerWidth - width - 10, event.clientX - drag.current.offsetX));
    const top = Math.max(10, Math.min(window.innerHeight - height - 10, event.clientY - drag.current.offsetY));
    didDrag.current = true;
    setPosition({ left, top });
  };

  const style: CSSProperties | undefined = position ? { left: position.left, top: position.top, right: "auto", bottom: "auto" } : undefined;

  return (
    <a className="whatsapp-float" style={style} href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noreferrer" draggable={false} aria-label="Chat with Vasritha on WhatsApp"
      onDragStart={(event) => event.preventDefault()}
      onPointerDown={(event) => { if (event.button !== 0) return; event.preventDefault(); const rect = event.currentTarget.getBoundingClientRect(); drag.current = { offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top }; event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={move}
      onPointerUp={(event) => { drag.current = null; event.currentTarget.releasePointerCapture(event.pointerId); }}
      onPointerCancel={() => { drag.current = null; }}
      onClick={(event) => { if (didDrag.current) { event.preventDefault(); didDrag.current = false; } }}>
      <FaWhatsapp size={29} />
      <span>WhatsApp us</span>
    </a>
  );
}
