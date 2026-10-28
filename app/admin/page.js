'use client';
import { useEffect, useState } from 'react';
import { sb } from '../../lib/supabase';
import localMenu from '../../data/menu.json';
import localSite from '../../data/site.json';
import './admin.css';

const POS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
const slug = (t) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cat' + Date.now();

function Pick({ value, onChange, label }) {
  const [busy, setBusy] = useState(false);
  async function pick(e) {
    const f = e.target.files[0]; if (!f) return;
    setBusy(true);
    try {
      const n = Date.now() + '-' + f.name.replace(/[^\w.-]/g, '_');
      const { error } = await sb().storage.from('media').upload(n, f);
      if (error) throw error;
      onChange(sb().storage.from('media').getPublicUrl(n).data.publicUrl);
    } catch (err) { alert('Envoi impossible : ' + err.message); }
    setBusy(false); e.target.value = '';
  }
  return (
    <div className="pick">
      {value ? <img src={value} alt="" /> : <span className="ph">aucune</span>}
      <label className="btn">{busy ? 'Envoi…' : label || 'Choisir une image'}<input type="file" accept="image/*" hidden onChange={pick} /></label>
      {value && <button className="lnk" onClick={() => onChange('')}>Retirer</button>}
    </div>
  );
}

function Login() {
  const [email, setEmail] = useState(''), [pw, setPw] = useState(''), [err, setErr] = useState('');
  async function go(e) {
    e.preventDefault();
    const { error } = await sb().auth.signInWithPassword({ email, password: pw });
    if (error) setErr('Email ou mot de passe incorrect.');
  }
  return (
    <form className="login" onSubmit={go}>
      <h1>Tomo · Admin</h1>
      <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input type="password" placeholder="Mot de passe" value={pw} onChange={(e) => setPw(e.target.value)} required />
      {err && <p className="err">{err}</p>}
      <button className="btn big">Se connecter</button>
    </form>
  );
}

export default function Admin() {
  const configured = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  const [ready, setReady] = useState(false), [session, setSession] = useState(null), [data, setData] = useState(null), [msg, setMsg] = useState('');
  useEffect(() => {
    if (!configured) return;
    const c = sb();
    c.auth.getSession().then(({ data: { session } }) => { setSession(session); setReady(true); });
    const { data: l } = c.auth.onAuthStateChange((_, s) => setSession(s));
    return () => l.subscription.unsubscribe();
  }, [configured]);
  useEffect(() => {
    if (!session) return;
    sb().from('site_data').select('key,value').then(({ data: rows }) => {
      const g = (k) => rows?.find((r) => r.key === k)?.value;
      setData({ menu: g('menu') || localMenu, site: g('site') || localSite });
    });
  }, [session]);

  if (!configured) return <div className="wrap"><p>Supabase n’est pas configuré : ajoutez les clés dans <code>.env.local</code> (voir README).</p></div>;
  if (!ready) return <div className="wrap">Chargement…</div>;
  if (!session) return <Login />;
  if (!data) return <div className="wrap">Chargement des données…</div>;

  const edit = (fn) => setData((d) => { const n = structuredClone(d); n.site.sections ??= {}; n.site.logo ??= {}; fn(n); return n; });
  const save = async () => {
    setMsg('Enregistrement…');
    const { error } = await sb().from('site_data').upsert([{ key: 'menu', value: data.menu }, { key: 'site', value: data.site }]);
    setMsg(error ? 'Erreur : ' + error.message : 'Enregistré ✓ (visible sur le site dans ~10 secondes)');
  };
  const { site, menu } = data;

  return (
    <div className="wrap">
      <header className="top">
        <h1>Tomo · Admin</h1>
        <a href="/" target="_blank" className="lnk">Voir le site</a>
        <button className="lnk" onClick={() => sb().auth.signOut()}>Déconnexion</button>
      </header>

      <details open className="box"><summary>Général et accueil</summary>
        <label>Nom<input value={site.name || ''} onChange={(e) => edit((n) => { n.site.name = e.target.value; })} /></label>
        <label>Slogan<input value={site.tagline || ''} onChange={(e) => edit((n) => { n.site.tagline = e.target.value; })} /></label>
        <label>Phrase du bas de page<input value={site.footer || ''} onChange={(e) => edit((n) => { n.site.footer = e.target.value; })} /></label>
        <p className="sub">Photo de l’accueil</p>
        <Pick value={site.hero?.bg} onChange={(u) => edit((n) => { n.site.hero = { bg: u }; })} />
      </details>

      <details open className="box"><summary>Logo</summary>
        <Pick value={site.logo?.src} label="Changer le logo (PNG)" onChange={(u) => edit((n) => { n.site.logo.src = u; })} />
        <label>Taille : {site.logo?.width || 320}px
          <input type="range" min="120" max="500" value={site.logo?.width || 320} onChange={(e) => edit((n) => { n.site.logo.width = +e.target.value; })} /></label>
        <label>Position sur l’accueil
          <select value={site.logo?.position || 'center'} onChange={(e) => edit((n) => { n.site.logo.position = e.target.value; })}>
            <option value="left">Gauche</option><option value="center">Centre</option><option value="right">Droite</option></select></label>
      </details>

      <h2>Menu</h2>
      {menu.categories.map((c, ci) => (
        <details key={c.id} className="box"><summary>{c.title} ({c.items.length})</summary>
          <label>Titre de la catégorie<input value={c.title} onChange={(e) => edit((n) => { n.menu.categories[ci].title = e.target.value; })} /></label>
          <p className="sub">Arrière-plan de la catégorie</p>
          <Pick value={site.sections?.[c.id]?.bg} onChange={(u) => edit((n) => { n.site.sections[c.id] = { ...(n.site.sections[c.id] || {}), bg: u }; })} />
          {c.items.map((it, ii) => (
            <div className="aitem" key={ii}>
              <div className="row">
                <input className="grow" placeholder="Nom" value={it.name} onChange={(e) => edit((n) => { n.menu.categories[ci].items[ii].name = e.target.value; })} />
                <input className="price" type="number" placeholder="Prix" value={it.price} onChange={(e) => edit((n) => { n.menu.categories[ci].items[ii].price = +e.target.value; })} />
                <button className="lnk red" onClick={() => confirm('Supprimer ce produit ?') && edit((n) => { n.menu.categories[ci].items.splice(ii, 1); })}>Supprimer</button>
              </div>
              <input placeholder="Description" value={it.desc || ''} onChange={(e) => edit((n) => { n.menu.categories[ci].items[ii].desc = e.target.value; })} />
              <Pick value={it.photo} label="Photo du produit" onChange={(u) => edit((n) => { n.menu.categories[ci].items[ii].photo = u; })} />
              {(it.arrows || []).map((a, ai) => (
                <div className="row" key={ai}>
                  <input className="grow" placeholder="Texte de la flèche" value={a.label} onChange={(e) => edit((n) => { n.menu.categories[ci].items[ii].arrows[ai].label = e.target.value; })} />
                  <select value={a.pos || ''} onChange={(e) => edit((n) => { const ar = n.menu.categories[ci].items[ii].arrows[ai]; if (e.target.value) ar.pos = e.target.value; else delete ar.pos; })}>
                    <option value="">Auto</option>{POS.map((p) => <option key={p}>{p}</option>)}</select>
                  <button className="lnk red" onClick={() => edit((n) => { n.menu.categories[ci].items[ii].arrows.splice(ai, 1); })}>×</button>
                </div>))}
              <button className="lnk" onClick={() => edit((n) => { const x = n.menu.categories[ci].items[ii]; x.arrows = [...(x.arrows || []), { label: '' }]; })}>+ Ajouter une flèche</button>
            </div>))}
          <div className="row">
            <button className="btn" onClick={() => edit((n) => { n.menu.categories[ci].items.push({ name: 'Nouveau produit', desc: '', price: 0, photo: '', arrows: [] }); })}>+ Ajouter un produit</button>
            <button className="lnk red" onClick={() => confirm('Supprimer toute la catégorie ?') && edit((n) => { n.menu.categories.splice(ci, 1); delete n.site.sections[c.id]; })}>Supprimer la catégorie</button>
          </div>
        </details>))}
      <button className="btn" onClick={() => { const t = prompt('Nom de la nouvelle catégorie ?'); if (t) edit((n) => { n.menu.categories.push({ id: slug(t), title: t, items: [] }); }); }}>+ Ajouter une catégorie</button>

      <div className="savebar"><span>{msg}</span><button className="btn big" onClick={save}>Enregistrer</button></div>
    </div>
  );
}
