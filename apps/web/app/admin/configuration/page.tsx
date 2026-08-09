"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AdminAlert,
  AdminBadge,
  AdminEmpty,
  AdminLoading,
  AdminPageHeader,
  AdminPanel
} from "../../../components/admin/admin-ui";
import { AdminFormModal } from "../../../components/admin/admin-form-modal";
import { adminFetch, adminUpload, formatDate } from "../../../lib/admin-api";
import { useAdminQuery } from "../../../hooks/use-admin-query";

type Tab = "offers" | "hero" | "status" | "showcase";

type OfferRow = {
  id: string;
  message: string;
  link_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

type HeroRow = {
  id: string;
  image_path: string;
  alt_text: string | null;
  title: string | null;
  subtitle: string | null;
  cta_label: string | null;
  cta_href: string | null;
  cta2_label: string | null;
  cta2_href: string | null;
  sort_order: number;
  is_active: boolean;
};

type StatusRow = {
  id: string;
  label: string;
  image_path: string;
  href: string | null;
  display_date: string;
  sort_order: number;
  is_active: boolean;
};

type ShowcaseRow = {
  id: string;
  title: string;
  subtitle: string | null;
  media_path: string;
  media_type: "video" | "image";
  sort_order: number;
  is_active: boolean;
  created_at?: string;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function AdminConfigurationPage() {
  const [tab, setTab] = useState<Tab>("offers");
  const offers = useAdminQuery<OfferRow[]>("/api/admin/config/offers");
  const hero = useAdminQuery<HeroRow[]>("/api/admin/config/hero");
  const status = useAdminQuery<StatusRow[]>("/api/admin/config/status");
  const showcase = useAdminQuery<ShowcaseRow[]>("/api/admin/config/showcase");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [uploading, setUploading] = useState(false);

  const [offerForm, setOfferForm] = useState({
    message: "",
    link_url: "",
    sort_order: "0",
    is_active: true
  });
  const [heroForm, setHeroForm] = useState({
    image_path: "",
    alt_text: "",
    title: "",
    subtitle: "",
    cta_label: "Explore sarees",
    cta_href: "/sarees",
    cta2_label: "Discover jewelry",
    cta2_href: "/jewelry",
    sort_order: "0",
    is_active: true
  });
  const [statusForm, setStatusForm] = useState({
    label: "",
    image_path: "",
    href: "/collections",
    display_date: todayIso(),
    sort_order: "0",
    is_active: true
  });
  const [showcaseForm, setShowcaseForm] = useState({
    title: "",
    subtitle: "",
    media_path: "",
    media_type: "video" as "video" | "image",
    sort_order: "0",
    is_active: true
  });

  useEffect(() => {
    setActionError("");
  }, [tab]);

  const activeQuery = tab === "offers" ? offers : tab === "hero" ? hero : tab === "status" ? status : showcase;

  const openCreate = () => {
    setEditingId(null);
    setFormError("");
    if (tab === "offers") {
      setOfferForm({ message: "", link_url: "", sort_order: "0", is_active: true });
    } else if (tab === "hero") {
      setHeroForm({
        image_path: "",
        alt_text: "",
        title: "",
        subtitle: "",
        cta_label: "Explore sarees",
        cta_href: "/sarees",
        cta2_label: "Discover jewelry",
        cta2_href: "/jewelry",
        sort_order: String((hero.data || []).length),
        is_active: true
      });
    } else if (tab === "status") {
      setStatusForm({
        label: "",
        image_path: "",
        href: "/collections",
        display_date: todayIso(),
        sort_order: "0",
        is_active: true
      });
    } else {
      setShowcaseForm({
        title: "",
        subtitle: "",
        media_path: "",
        media_type: "video",
        sort_order: String((showcase.data || []).length),
        is_active: true
      });
    }
    setModalOpen(true);
  };

  const openEdit = (row: OfferRow | HeroRow | StatusRow | ShowcaseRow) => {
    setEditingId(row.id);
    setFormError("");
    if (tab === "offers") {
      const item = row as OfferRow;
      setOfferForm({
        message: item.message,
        link_url: item.link_url || "",
        sort_order: String(item.sort_order),
        is_active: item.is_active
      });
    } else if (tab === "hero") {
      const item = row as HeroRow;
      setHeroForm({
        image_path: item.image_path,
        alt_text: item.alt_text || "",
        title: item.title || "",
        subtitle: item.subtitle || "",
        cta_label: item.cta_label || "",
        cta_href: item.cta_href || "",
        cta2_label: item.cta2_label || "",
        cta2_href: item.cta2_href || "",
        sort_order: String(item.sort_order),
        is_active: item.is_active
      });
    } else if (tab === "status") {
      const item = row as StatusRow;
      setStatusForm({
        label: item.label,
        image_path: item.image_path,
        href: item.href || "",
        display_date: item.display_date.slice(0, 10),
        sort_order: String(item.sort_order),
        is_active: item.is_active
      });
    } else {
      const item = row as ShowcaseRow;
      setShowcaseForm({
        title: item.title,
        subtitle: item.subtitle || "",
        media_path: item.media_path,
        media_type: item.media_type,
        sort_order: String(item.sort_order),
        is_active: item.is_active
      });
    }
    setModalOpen(true);
  };

  const endpoint = useMemo(() => {
    if (tab === "offers") return "/api/admin/config/offers";
    if (tab === "hero") return "/api/admin/config/hero";
    if (tab === "status") return "/api/admin/config/status";
    return "/api/admin/config/showcase";
  }, [tab]);

  const uploadFile = async (kind: string, fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    setUploading(true);
    setFormError("");
    const body = new FormData();
    body.append("kind", kind);
    body.append("file", file);
    const result = await adminUpload<{ path: string; mediaType: "image" | "video" }>(
      "/api/admin/config/upload",
      body
    );
    setUploading(false);
    if (result.error || !result.data?.path) {
      setFormError(result.error || "Upload failed");
      return;
    }
    if (kind === "hero") setHeroForm((f) => ({ ...f, image_path: result.data!.path }));
    if (kind === "status") setStatusForm((f) => ({ ...f, image_path: result.data!.path }));
    if (kind === "showcase") {
      setShowcaseForm((f) => ({
        ...f,
        media_path: result.data!.path,
        media_type: result.data!.mediaType
      }));
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");

    let payload: Record<string, unknown> = {};
    if (tab === "offers") {
      payload = {
        message: offerForm.message,
        link_url: offerForm.link_url || null,
        sort_order: Number(offerForm.sort_order || 0),
        is_active: offerForm.is_active
      };
    } else if (tab === "hero") {
      if (!heroForm.image_path) {
        setSaving(false);
        setFormError("Upload a hero image first.");
        return;
      }
      payload = {
        ...heroForm,
        sort_order: Number(heroForm.sort_order || 0)
      };
    } else if (tab === "status") {
      if (!statusForm.image_path) {
        setSaving(false);
        setFormError("Upload a status image first.");
        return;
      }
      payload = {
        ...statusForm,
        sort_order: Number(statusForm.sort_order || 0)
      };
    } else {
      if (!showcaseForm.media_path) {
        setSaving(false);
        setFormError("Upload an image or video first.");
        return;
      }
      payload = {
        ...showcaseForm,
        sort_order: Number(showcaseForm.sort_order || 0)
      };
    }

    const result = editingId
      ? await adminFetch(endpoint, { method: "PATCH", json: { id: editingId, ...payload } })
      : await adminFetch(endpoint, { method: "POST", json: payload });

    setSaving(false);
    if (result.error) {
      setFormError(result.error);
      return;
    }
    setModalOpen(false);
    await activeQuery.reload();
  };

  const onDelete = async (id: string) => {
    if (!window.confirm("Delete this item?")) return;
    setActionError("");
    const result = await adminFetch(`${endpoint}?id=${encodeURIComponent(id)}`, {
      method: "DELETE"
    });
    if (result.error) {
      setActionError(result.error);
      return;
    }
    await activeQuery.reload();
  };

  const modalTitle =
    tab === "offers"
      ? editingId
        ? "Edit offer message"
        : "Add offer message"
      : tab === "hero"
        ? editingId
          ? "Edit hero slide"
          : "Add hero slide"
        : tab === "status"
          ? editingId
            ? "Edit status story"
            : "Add status story"
          : editingId
            ? "Edit showcase media"
            : "Add showcase media";

  return (
    <>
      <AdminPageHeader
        title="Configuration"
        actions={
          <button type="button" className="btn" onClick={openCreate}>
            + Add
          </button>
        }
      />

      <div className="admin-tabs">
        <button type="button" className={tab === "offers" ? "is-active" : ""} onClick={() => setTab("offers")}>
          Offer bar
        </button>
        <button type="button" className={tab === "hero" ? "is-active" : ""} onClick={() => setTab("hero")}>
          Hero slides
        </button>
        <button type="button" className={tab === "status" ? "is-active" : ""} onClick={() => setTab("status")}>
          Status stories
        </button>
        <button
          type="button"
          className={tab === "showcase" ? "is-active" : ""}
          onClick={() => setTab("showcase")}
        >
          Showcase media
        </button>
      </div>

      {actionError && <AdminAlert>{actionError}</AdminAlert>}

      {tab === "offers" && (
        <AdminPanel title="Running offer messages">
          {offers.loading && <AdminLoading />}
          {offers.error && <AdminAlert>{offers.error}</AdminAlert>}
          {!offers.loading && !(offers.data || []).length && (
            <AdminEmpty title="No offer messages" body="Add ticker lines for the top announcement bar." />
          )}
          {(offers.data || []).length > 0 && (
            <div className="admin-card-grid">
              {(offers.data || []).map((row) => (
                <article key={row.id} className="admin-soft-card">
                  <div className="eyebrow">#{row.sort_order}</div>
                  <h3>{row.message}</h3>
                  <p className="muted">{row.link_url || "No link"}</p>
                  <AdminBadge tone={row.is_active ? "success" : "neutral"}>
                    {row.is_active ? "Active" : "Hidden"}
                  </AdminBadge>
                  <div className="admin-row-actions">
                    <button type="button" onClick={() => openEdit(row)}>
                      Edit
                    </button>
                    <button type="button" className="admin-danger-btn" onClick={() => void onDelete(row.id)}>
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </AdminPanel>
      )}

      {tab === "hero" && (
        <AdminPanel title="Hero sliding images (max 5 active)">
          {hero.loading && <AdminLoading />}
          {hero.error && <AdminAlert>{hero.error}</AdminAlert>}
          {!hero.loading && !(hero.data || []).length && (
            <AdminEmpty title="No hero slides" body="Upload 4–5 homepage hero images with optional CTAs." />
          )}
          {(hero.data || []).length > 0 && (
            <div className="admin-card-grid">
              {(hero.data || []).map((row) => (
                <article key={row.id} className="admin-soft-card">
                  <div className="admin-soft-card-media">
                    <img src={row.image_path} alt="" />
                  </div>
                  <h3>{row.title || "Hero slide"}</h3>
                  <p className="muted">{row.subtitle || row.alt_text || "—"}</p>
                  <AdminBadge tone={row.is_active ? "success" : "neutral"}>
                    {row.is_active ? "Active" : "Hidden"}
                  </AdminBadge>
                  <div className="admin-row-actions">
                    <button type="button" onClick={() => openEdit(row)}>
                      Edit
                    </button>
                    <button type="button" className="admin-danger-btn" onClick={() => void onDelete(row.id)}>
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </AdminPanel>
      )}

      {tab === "status" && (
        <AdminPanel title="Status stories (1-day display)">
          {status.loading && <AdminLoading />}
          {status.error && <AdminAlert>{status.error}</AdminAlert>}
          {!status.loading && !(status.data || []).length && (
            <AdminEmpty
              title="No status stories"
              body="Pick a display date — each story is visible only on that day."
            />
          )}
          {(status.data || []).length > 0 && (
            <div className="admin-card-grid">
              {(status.data || []).map((row) => (
                <article key={row.id} className="admin-soft-card">
                  <div className="admin-soft-card-media">
                    <img src={row.image_path} alt="" />
                  </div>
                  <h3>{row.label}</h3>
                  <p className="muted">Shows on {row.display_date.slice(0, 10)}</p>
                  <p className="muted">{row.href || "—"}</p>
                  <AdminBadge tone={row.is_active ? "success" : "neutral"}>
                    {row.is_active ? "Active" : "Hidden"}
                  </AdminBadge>
                  <div className="admin-row-actions">
                    <button type="button" onClick={() => openEdit(row)}>
                      Edit
                    </button>
                    <button type="button" className="admin-danger-btn" onClick={() => void onDelete(row.id)}>
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </AdminPanel>
      )}

      {tab === "showcase" && (
        <AdminPanel title="Closer-look showcase media">
          {showcase.loading && <AdminLoading />}
          {showcase.error && <AdminAlert>{showcase.error}</AdminAlert>}
          {!showcase.loading && !(showcase.data || []).length && (
            <AdminEmpty title="No showcase items" body="Add videos or images for the homepage carousel." />
          )}
          {(showcase.data || []).length > 0 && (
            <div className="admin-card-grid">
              {(showcase.data || []).map((row) => (
                <article key={row.id} className="admin-soft-card">
                  <div className="admin-soft-card-media">
                    {row.media_type === "video" ? (
                      <video src={row.media_path} muted playsInline />
                    ) : (
                      <img src={row.media_path} alt="" />
                    )}
                  </div>
                  <h3>{row.title}</h3>
                  <p className="muted">{row.subtitle || row.media_type}</p>
                  {row.created_at ? (
                    <p className="muted admin-sub">Added {formatDate(row.created_at)}</p>
                  ) : null}
                  <AdminBadge tone={row.is_active ? "success" : "neutral"}>
                    {row.is_active ? "Active" : "Hidden"}
                  </AdminBadge>
                  <div className="admin-row-actions">
                    <button type="button" onClick={() => openEdit(row)}>
                      Edit
                    </button>
                    <button type="button" className="admin-danger-btn" onClick={() => void onDelete(row.id)}>
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </AdminPanel>
      )}

      <AdminFormModal
        open={modalOpen}
        title={modalTitle}
        eyebrow="Configuration"
        submitLabel={editingId ? "Save changes" : "Create"}
        savingLabel="Saving…"
        saving={saving || uploading}
        error={formError}
        onClose={() => setModalOpen(false)}
        onSubmit={onSubmit}
        wide
      >
        {tab === "offers" && (
          <>
            <label className="admin-span-2">
              <span>Message</span>
              <input
                required
                value={offerForm.message}
                onChange={(e) => setOfferForm((f) => ({ ...f, message: e.target.value }))}
                placeholder="SHIPPING ON ORDERS ABOVE ₹2,500"
              />
            </label>
            <label>
              <span>Optional link</span>
              <input
                value={offerForm.link_url}
                onChange={(e) => setOfferForm((f) => ({ ...f, link_url: e.target.value }))}
                placeholder="/sarees"
              />
            </label>
            <label>
              <span>Sort order</span>
              <input
                type="number"
                value={offerForm.sort_order}
                onChange={(e) => setOfferForm((f) => ({ ...f, sort_order: e.target.value }))}
              />
            </label>
            <label>
              <span>Active</span>
              <select
                value={offerForm.is_active ? "1" : "0"}
                onChange={(e) => setOfferForm((f) => ({ ...f, is_active: e.target.value === "1" }))}
              >
                <option value="1">Yes</option>
                <option value="0">No</option>
              </select>
            </label>
          </>
        )}

        {tab === "hero" && (
          <>
            <label className="admin-span-2">
              <span>Image</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={(e) => void uploadFile("hero", e.target.files)}
              />
              {heroForm.image_path ? (
                <img className="admin-upload-preview" src={heroForm.image_path} alt="" />
              ) : null}
            </label>
            <label>
              <span>Title</span>
              <input
                value={heroForm.title}
                onChange={(e) => setHeroForm((f) => ({ ...f, title: e.target.value }))}
              />
            </label>
            <label>
              <span>Alt text</span>
              <input
                value={heroForm.alt_text}
                onChange={(e) => setHeroForm((f) => ({ ...f, alt_text: e.target.value }))}
              />
            </label>
            <label className="admin-span-2">
              <span>Subtitle</span>
              <textarea
                rows={2}
                value={heroForm.subtitle}
                onChange={(e) => setHeroForm((f) => ({ ...f, subtitle: e.target.value }))}
              />
            </label>
            <label>
              <span>Primary CTA label</span>
              <input
                value={heroForm.cta_label}
                onChange={(e) => setHeroForm((f) => ({ ...f, cta_label: e.target.value }))}
              />
            </label>
            <label>
              <span>Primary CTA link</span>
              <input
                value={heroForm.cta_href}
                onChange={(e) => setHeroForm((f) => ({ ...f, cta_href: e.target.value }))}
              />
            </label>
            <label>
              <span>Secondary CTA label</span>
              <input
                value={heroForm.cta2_label}
                onChange={(e) => setHeroForm((f) => ({ ...f, cta2_label: e.target.value }))}
              />
            </label>
            <label>
              <span>Secondary CTA link</span>
              <input
                value={heroForm.cta2_href}
                onChange={(e) => setHeroForm((f) => ({ ...f, cta2_href: e.target.value }))}
              />
            </label>
            <label>
              <span>Sort order</span>
              <input
                type="number"
                value={heroForm.sort_order}
                onChange={(e) => setHeroForm((f) => ({ ...f, sort_order: e.target.value }))}
              />
            </label>
            <label>
              <span>Active</span>
              <select
                value={heroForm.is_active ? "1" : "0"}
                onChange={(e) => setHeroForm((f) => ({ ...f, is_active: e.target.value === "1" }))}
              >
                <option value="1">Yes</option>
                <option value="0">No</option>
              </select>
            </label>
          </>
        )}

        {tab === "status" && (
          <>
            <label className="admin-span-2">
              <span>Image</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={(e) => void uploadFile("status", e.target.files)}
              />
              {statusForm.image_path ? (
                <img className="admin-upload-preview" src={statusForm.image_path} alt="" />
              ) : null}
            </label>
            <label>
              <span>Label</span>
              <input
                required
                value={statusForm.label}
                onChange={(e) => setStatusForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="NEW SAREES"
              />
            </label>
            <label>
              <span>Display date (1-day validity)</span>
              <input
                required
                type="date"
                value={statusForm.display_date}
                onChange={(e) => setStatusForm((f) => ({ ...f, display_date: e.target.value }))}
              />
            </label>
            <label>
              <span>Link</span>
              <input
                value={statusForm.href}
                onChange={(e) => setStatusForm((f) => ({ ...f, href: e.target.value }))}
              />
            </label>
            <label>
              <span>Sort order</span>
              <input
                type="number"
                value={statusForm.sort_order}
                onChange={(e) => setStatusForm((f) => ({ ...f, sort_order: e.target.value }))}
              />
            </label>
            <label>
              <span>Active</span>
              <select
                value={statusForm.is_active ? "1" : "0"}
                onChange={(e) => setStatusForm((f) => ({ ...f, is_active: e.target.value === "1" }))}
              >
                <option value="1">Yes</option>
                <option value="0">No</option>
              </select>
            </label>
          </>
        )}

        {tab === "showcase" && (
          <>
            <label className="admin-span-2">
              <span>Video or image</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
                onChange={(e) => void uploadFile("showcase", e.target.files)}
              />
              {showcaseForm.media_path ? (
                showcaseForm.media_type === "video" ? (
                  <video className="admin-upload-preview" src={showcaseForm.media_path} controls muted />
                ) : (
                  <img className="admin-upload-preview" src={showcaseForm.media_path} alt="" />
                )
              ) : null}
            </label>
            <label>
              <span>Title</span>
              <input
                required
                value={showcaseForm.title}
                onChange={(e) => setShowcaseForm((f) => ({ ...f, title: e.target.value }))}
              />
            </label>
            <label>
              <span>Subtitle</span>
              <input
                value={showcaseForm.subtitle}
                onChange={(e) => setShowcaseForm((f) => ({ ...f, subtitle: e.target.value }))}
              />
            </label>
            <label>
              <span>Sort order</span>
              <input
                type="number"
                value={showcaseForm.sort_order}
                onChange={(e) => setShowcaseForm((f) => ({ ...f, sort_order: e.target.value }))}
              />
            </label>
            <label>
              <span>Active</span>
              <select
                value={showcaseForm.is_active ? "1" : "0"}
                onChange={(e) => setShowcaseForm((f) => ({ ...f, is_active: e.target.value === "1" }))}
              >
                <option value="1">Yes</option>
                <option value="0">No</option>
              </select>
            </label>
          </>
        )}
      </AdminFormModal>
    </>
  );
}
