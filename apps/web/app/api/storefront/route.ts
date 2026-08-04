import { ok } from "../../../lib/auth/api";
import { query, queryOne } from "../../../lib/db/pool";

type MenuRow = { id: string; [key: string]: unknown };
type SectionRow = { id: string; [key: string]: unknown };

/** Public storefront bootstrap: settings + menus + active banners + home sections */
export async function GET() {
  const [settings, menus, banners, sections, categories] = await Promise.all([
    queryOne(`select * from site_settings limit 1`),
    query<MenuRow>(`select * from menus where is_active = true`),
    query(`select * from banners where is_active = true order by sort_order`),
    query<SectionRow>(
      `select * from page_sections where page_slug = 'home' and is_active = true order by sort_order`
    ),
    query(`select id, name, slug, description, sort_order from categories order by sort_order`)
  ]);

  const menuIds = menus.map((m) => m.id);
  const menuItems = menuIds.length
    ? await query(`select * from menu_items where menu_id = any($1::uuid[])`, [menuIds])
    : [];

  const sectionIds = sections.map((s) => s.id);
  const sectionItems = sectionIds.length
    ? await query(
        `select * from section_items where section_id = any($1::uuid[]) order by sort_order asc`,
        [sectionIds]
      )
    : [];

  const menusWithItems = menus.map((menu) => ({
    ...menu,
    menu_items: menuItems.filter((item) => (item as { menu_id: string }).menu_id === menu.id)
  }));

  const sectionsWithItems = sections.map((section) => ({
    ...section,
    section_items: sectionItems.filter(
      (item) => (item as { section_id: string }).section_id === section.id
    )
  }));

  return ok({
    settings,
    menus: menusWithItems,
    banners,
    sections: sectionsWithItems,
    categories
  });
}
