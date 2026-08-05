"use client";

import { FormEvent, useState } from "react";
import {
  AdminAlert,
  AdminBadge,
  AdminEmpty,
  AdminLoading,
  AdminPageHeader,
  AdminPanel
} from "../../../components/admin/admin-ui";
import { AdminFormModal } from "../../../components/admin/admin-form-modal";
import { adminFetch, formatDate } from "../../../lib/admin-api";
import { useAdminQuery } from "../../../hooks/use-admin-query";

type Banner = {
  id: string;
  title: string | null;
  subtitle: string | null;
  image_path: string;
  link_url: string | null;
  placement: string;
  sort_order: number;
  is_active: boolean;
};

type PageRow = {
  id: string;
  slug: string;
  title: string;
  is_published: boolean;
  updated_at: string;
};

type Menu = {
  id: string;
  name: string;
  location: string;
  menu_items: Array<{ id: string; label: string; link_type: string; link_value: string | null }>;
};

type Section = {
  id: string;
  page_slug: string;
  section_type: string;
  title: string | null;
  subtitle: string | null;
  sort_order: number;
};

const blankBanner = () => ({
  title: "",
  subtitle: "",
  image_path: "",
  link_url: "",
  placement: "home_hero",
  sort_order: "0"
});

const blankPage = () => ({
  slug: "",
  title: "",
  body: "",
  is_published: true
});

const blankSection = () => ({
  page_slug: "home",
  section_type: "spotlight",
  title: "",
  subtitle: "",
  sort_order: "0"
});

export default function AdminCmsPage() {
  const [tab, setTab] = useState<"banners" | "pages" | "menus" | "sections">("banners");
  const banners = useAdminQuery<Banner[]>("/api/admin/cms/banners");
  const pages = useAdminQuery<PageRow[]>("/api/admin/cms/pages");
  const menus = useAdminQuery<Menu[]>("/api/admin/cms/menus");
  const sections = useAdminQuery<Section[]>("/api/admin/cms/sections?page=home");

  const [bannerModalOpen, setBannerModalOpen] = useState(false);
  const [pageModalOpen, setPageModalOpen] = useState(false);
  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [bannerForm, setBannerForm] = useState(blankBanner);
  const [pageForm, setPageForm] = useState(blankPage);
  const [sectionForm, setSectionForm] = useState(blankSection);

  const createBanner = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    const result = await adminFetch("/api/admin/cms/banners", {
      method: "POST",
      json: {
        ...bannerForm,
        sort_order: Number(bannerForm.sort_order || 0),
        link_url: bannerForm.link_url || null
      }
    });
    setSaving(false);
    if (result.error) {
      setFormError(result.error);
      return;
    }
    setBannerModalOpen(false);
    setBannerForm(blankBanner());
    await banners.reload();
  };

  const createPage = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    const result = await adminFetch("/api/admin/cms/pages", {
      method: "POST",
      json: pageForm
    });
    setSaving(false);
    if (result.error) {
      setFormError(result.error);
      return;
    }
    setPageModalOpen(false);
    setPageForm(blankPage());
    await pages.reload();
  };

  const createSection = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    const result = await adminFetch("/api/admin/cms/sections", {
      method: "POST",
      json: {
        ...sectionForm,
        sort_order: Number(sectionForm.sort_order || 0)
      }
    });
    setSaving(false);
    if (result.error) {
      setFormError(result.error);
      return;
    }
    setSectionModalOpen(false);
    setSectionForm(blankSection());
    await sections.reload();
  };

  const headerAction =
    tab === "banners" ? (
      <button
        type="button"
        className="btn"
        onClick={() => {
          setFormError("");
          setBannerForm(blankBanner());
          setBannerModalOpen(true);
        }}
      >
        + New banner
      </button>
    ) : tab === "pages" ? (
      <button
        type="button"
        className="btn"
        onClick={() => {
          setFormError("");
          setPageForm(blankPage());
          setPageModalOpen(true);
        }}
      >
        + New page
      </button>
    ) : tab === "sections" ? (
      <button
        type="button"
        className="btn"
        onClick={() => {
          setFormError("");
          setSectionForm(blankSection());
          setSectionModalOpen(true);
        }}
      >
        + New section
      </button>
    ) : null;

  return (
    <>
      <AdminPageHeader eyebrow="" title="CMS" actions={headerAction} />

      <div className="admin-tabs">
        {(["banners", "pages", "menus", "sections"] as const).map((key) => (
          <button
            key={key}
            type="button"
            className={tab === key ? "is-active" : ""}
            onClick={() => setTab(key)}
          >
            {key}
          </button>
        ))}
      </div>

      {tab === "banners" && (
        <AdminPanel title="Banners">
          {banners.loading && <AdminLoading />}
          {banners.error && <AdminAlert>{banners.error}</AdminAlert>}
          {!(banners.data || []).length && !banners.loading && <AdminEmpty title="No banners" />}
          <div className="admin-card-grid">
            {(banners.data || []).map((banner) => (
              <article key={banner.id} className="admin-soft-card">
                <div className="eyebrow">{banner.placement}</div>
                <h3>{banner.title || "Untitled"}</h3>
                <p className="muted">{banner.image_path}</p>
                <AdminBadge tone={banner.is_active ? "success" : "neutral"}>
                  {banner.is_active ? "active" : "inactive"}
                </AdminBadge>
              </article>
            ))}
          </div>
        </AdminPanel>
      )}

      {tab === "pages" && (
        <AdminPanel title="Pages">
          {pages.loading && <AdminLoading />}
          {pages.error && <AdminAlert>{pages.error}</AdminAlert>}
          {(pages.data || []).length === 0 && !pages.loading && <AdminEmpty title="No pages" />}
          {(pages.data || []).length > 0 && (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Slug</th>
                    <th>Status</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {(pages.data || []).map((page) => (
                    <tr key={page.id}>
                      <td>
                        <b>{page.title}</b>
                      </td>
                      <td>{page.slug}</td>
                      <td>
                        <AdminBadge tone={page.is_published ? "success" : "warn"}>
                          {page.is_published ? "published" : "draft"}
                        </AdminBadge>
                      </td>
                      <td>{formatDate(page.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AdminPanel>
      )}

      {tab === "menus" && (
        <AdminPanel title="Menus">
          {menus.loading && <AdminLoading />}
          {!(menus.data || []).length && !menus.loading && (
            <AdminEmpty title="No menus" body="Seed menus in the database to manage navigation items." />
          )}
          <div className="admin-card-grid">
            {(menus.data || []).map((menu) => (
              <article key={menu.id} className="admin-soft-card">
                <div className="eyebrow">{menu.location}</div>
                <h3>{menu.name}</h3>
                <ul className="admin-list">
                  {(menu.menu_items || []).map((item) => (
                    <li key={item.id}>
                      {item.label} <span className="muted">({item.link_type})</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </AdminPanel>
      )}

      {tab === "sections" && (
        <AdminPanel title="Home sections">
          {sections.loading && <AdminLoading />}
          {!(sections.data || []).length && !sections.loading && <AdminEmpty title="No sections" />}
          <div className="admin-card-grid">
            {(sections.data || []).map((section) => (
              <article key={section.id} className="admin-soft-card">
                <div className="eyebrow">
                  #{section.sort_order} · {section.section_type}
                </div>
                <h3>{section.title || "Untitled section"}</h3>
                <p className="muted">{section.subtitle || "—"}</p>
              </article>
            ))}
          </div>
        </AdminPanel>
      )}

      <AdminFormModal
        open={bannerModalOpen}
        title="Add banner"
        eyebrow="CMS"
        submitLabel="Save banner"
        saving={saving}
        error={formError}
        onClose={() => setBannerModalOpen(false)}
        onSubmit={createBanner}
      >
        <label>
          <span>Title</span>
          <input
            value={bannerForm.title}
            onChange={(e) => setBannerForm((f) => ({ ...f, title: e.target.value }))}
          />
        </label>
        <label>
          <span>Placement</span>
          <select
            value={bannerForm.placement}
            onChange={(e) => setBannerForm((f) => ({ ...f, placement: e.target.value }))}
          >
            <option value="home_hero">Home hero</option>
            <option value="category">Category</option>
            <option value="promo">Promo</option>
          </select>
        </label>
        <label className="admin-span-2">
          <span>Image path</span>
          <input
            required
            placeholder="/hero-silk.png"
            value={bannerForm.image_path}
            onChange={(e) => setBannerForm((f) => ({ ...f, image_path: e.target.value }))}
          />
        </label>
        <label>
          <span>Subtitle</span>
          <input
            value={bannerForm.subtitle}
            onChange={(e) => setBannerForm((f) => ({ ...f, subtitle: e.target.value }))}
          />
        </label>
        <label>
          <span>Link URL</span>
          <input
            value={bannerForm.link_url}
            onChange={(e) => setBannerForm((f) => ({ ...f, link_url: e.target.value }))}
          />
        </label>
      </AdminFormModal>

      <AdminFormModal
        open={pageModalOpen}
        title="Add page"
        eyebrow="CMS"
        submitLabel="Save page"
        saving={saving}
        error={formError}
        onClose={() => setPageModalOpen(false)}
        onSubmit={createPage}
      >
        <label>
          <span>Slug</span>
          <input
            required
            value={pageForm.slug}
            onChange={(e) => setPageForm((f) => ({ ...f, slug: e.target.value }))}
          />
        </label>
        <label>
          <span>Title</span>
          <input
            required
            value={pageForm.title}
            onChange={(e) => setPageForm((f) => ({ ...f, title: e.target.value }))}
          />
        </label>
        <label className="admin-span-2">
          <span>Body</span>
          <textarea
            rows={4}
            value={pageForm.body}
            onChange={(e) => setPageForm((f) => ({ ...f, body: e.target.value }))}
          />
        </label>
        <label>
          <span>Published</span>
          <select
            value={pageForm.is_published ? "1" : "0"}
            onChange={(e) => setPageForm((f) => ({ ...f, is_published: e.target.value === "1" }))}
          >
            <option value="1">Yes</option>
            <option value="0">No</option>
          </select>
        </label>
      </AdminFormModal>

      <AdminFormModal
        open={sectionModalOpen}
        title="Add home section"
        eyebrow="CMS"
        submitLabel="Save section"
        saving={saving}
        error={formError}
        onClose={() => setSectionModalOpen(false)}
        onSubmit={createSection}
      >
        <label>
          <span>Type</span>
          <input
            required
            value={sectionForm.section_type}
            onChange={(e) => setSectionForm((f) => ({ ...f, section_type: e.target.value }))}
          />
        </label>
        <label>
          <span>Sort</span>
          <input
            type="number"
            value={sectionForm.sort_order}
            onChange={(e) => setSectionForm((f) => ({ ...f, sort_order: e.target.value }))}
          />
        </label>
        <label>
          <span>Title</span>
          <input
            value={sectionForm.title}
            onChange={(e) => setSectionForm((f) => ({ ...f, title: e.target.value }))}
          />
        </label>
        <label>
          <span>Subtitle</span>
          <input
            value={sectionForm.subtitle}
            onChange={(e) => setSectionForm((f) => ({ ...f, subtitle: e.target.value }))}
          />
        </label>
      </AdminFormModal>
    </>
  );
}
