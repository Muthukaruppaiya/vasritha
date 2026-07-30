"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { categories } from "../lib/mock-data";

export function NavigationBar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="header-nav" aria-label="Primary navigation">
      <button className="nav-trigger" type="button" aria-label="Open navigation" aria-expanded={open} onClick={() => setOpen(true)}>
        <Menu size={22} />
      </button>
      <button className={`nav-backdrop ${open ? "is-open" : ""}`} aria-label="Close navigation" onClick={() => setOpen(false)} />
      <div className={`nav-drawer ${open ? "is-open" : ""}`}>
        <div className="drawer-head"><span>Explore Vasritha</span><button type="button" aria-label="Close navigation" onClick={() => setOpen(false)}><X size={22} /></button></div>
        <div className="drawer-links">
          <Link href="/" onClick={() => setOpen(false)}>Home</Link>
          <Link href="/collections" onClick={() => setOpen(false)}>All Collections</Link>
          {categories.map((category) => <Link key={category.slug} href={`/${category.slug}`} onClick={() => setOpen(false)}>{category.name}</Link>)}
          <Link href="/sarees" onClick={() => setOpen(false)}>Saree Collections</Link>
          <Link href="/checkout" onClick={() => setOpen(false)}>Offers</Link>
        </div>
      </div>
    </nav>
  );
}
