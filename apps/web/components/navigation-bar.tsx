"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { categories } from "../lib/mock-data";

const links = [
  { href: "/", label: "Home" },
  { href: "/collections", label: "Collections" },
  ...categories.map((category) => ({ href: `/${category.slug}`, label: category.name })),
  { href: "/checkout", label: "Offers" }
];

export function NavigationBar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="header-nav" aria-label="Primary navigation">
      <button className="nav-trigger" type="button" aria-label="Open navigation" aria-expanded={open} onClick={() => setOpen(true)}>
        <Menu size={22} />
      </button>
      <div className="menu-bar" aria-label="Desktop menu">
        {links.map((link) => (
          <Link key={link.href + link.label} href={link.href}>{link.label}</Link>
        ))}
      </div>
      <button className={`nav-backdrop ${open ? "is-open" : ""}`} aria-label="Close navigation" onClick={() => setOpen(false)} />
      <div className={`nav-drawer ${open ? "is-open" : ""}`}>
        <div className="drawer-head"><span>Explore Vasritha</span><button type="button" aria-label="Close navigation" onClick={() => setOpen(false)}><X size={22} /></button></div>
        <div className="drawer-links">
          {links.map((link) => (
            <Link key={link.href + link.label} href={link.href} onClick={() => setOpen(false)}>{link.label}</Link>
          ))}
          <Link href="/sarees" onClick={() => setOpen(false)}>Saree Collections</Link>
          <Link href="/login" onClick={() => setOpen(false)}>Login</Link>
        </div>
      </div>
    </nav>
  );
}
