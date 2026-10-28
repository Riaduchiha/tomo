import localMenu from '../data/menu.json';
import localSite from '../data/site.json';
// Lit le menu et le site depuis Supabase ; si pas configuré ou vide, utilise les fichiers du dossier data/.
export async function getData() {
  const u = process.env.NEXT_PUBLIC_SUPABASE_URL, k = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const fallback = { menu: localMenu, site: localSite };
  if (!u || !k) return fallback;
  try {
    const r = await fetch(`${u}/rest/v1/site_data?select=key,value`, { headers: { apikey: k, Authorization: `Bearer ${k}` }, next: { revalidate: 10 } });
    if (!r.ok) return fallback;
    const rows = await r.json();
    const g = (key) => rows.find((x) => x.key === key)?.value;
    return { menu: g('menu') || localMenu, site: g('site') || localSite };
  } catch { return fallback; }
}
