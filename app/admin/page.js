'use client';
import { useEffect, useState } from 'react';
import { sb } from '../../lib/supabase';
import CropModal from '../../components/CropModal';
import localMenu from '../../data/menu.json';
import localSite from '../../data/site.json';
import './admin.css';
import { compressImage, extFromType } from '../../lib/compressImage';

const POS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
const slug = (t) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cat' + Date.now();

// ---- Outils pour « Optimiser toutes les photos » ----
const MEDIA = '/storage/v1/object/public/media/';

// Récupère toutes les adresses de photos Supabase présentes dans les données
function collectMedia(v, out = new Set()) {
  if (typeof v === 'string') {
    if (v.includes(MEDIA)) out.add(v);
  } else if (Array.isArray(v)) {
    v.forEach((x) => collectMedia(x, out));
  } else if (v && typeof v === 'object') {
    Object.values(v).forEach((x) => collectMedia(x, out));
  }
  return out;
}

// Remplace partout les anciennes adresses par les nouvelles
function swapMedia(v, map) {
  if (typeof v === 'string') return map.get(v) ?? v;
  if (Array.isArray(v)) return v.map((x) => swapMedia(x, map));
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, swapMedia(x, map)]));
  }
  return v;
}

function Pick({ value, onChange, label, crop }) {
  const [busy, setBusy] = useState(false);
  const [rawSrc, setRawSrc] = useState(null);

  async function upload(file, name) {
    setBusy(true);
    try {
      // Compression sans perte visible (WebP 90 %, 2000 px max).
      // Le résultat n’est jamais plus lourd que l’original.
      const out = await compressImage(file);
      const finalName = name.replace(/\.[^.]+$/, '') + '.' + extFromType(out.type);

      const { error } = await sb().storage.from('media').upload(finalName, out, {
        contentType: out.type,
        cacheControl: '31536000',
        upsert: false
      });

      if (error) throw error;

      onChange(sb().storage.from('media').getPublicUrl(finalName).data.publicUrl);
    } catch (err) {
      alert('Envoi impossible : ' + err.message);
    } finally {
      setBusy(false);
    }
  }

  function pick(e) {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (crop) {
      setRawSrc(URL.createObjectURL(f));
    } else {
      upload(f, Date.now() + '-' + f.name.replace(/[^\w.-]/g, '_'));
    }
  }

  function closeCrop() {
    if (rawSrc && rawSrc.startsWith('blob:')) URL.revokeObjectURL(rawSrc);
    setRawSrc(null);
  }

  async function cropped(blob) {
    closeCrop();
    await upload(blob, Date.now() + '-produit.webp');
  }

  return (
    <div className="pick">
      {value ? <img src={value} alt="" /> : <span className="ph">aucune</span>}
      <label className="btn">
        {busy ? 'Envoi…' : label || 'Choisir une image'}
        <input type="file" accept="image/*" hidden onChange={pick} />
      </label>
      {crop && value && (
        <button className="lnk" onClick={() => setRawSrc(value)}>Recadrer</button>
      )}
      {value && <button className="lnk" onClick={() => onChange('')}>Retirer</button>}
      {rawSrc && <CropModal src={rawSrc} onCancel={closeCrop} onDone={cropped} />}
    </div>
  );
}

function Login() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');

  async function go(e) {
    e.preventDefault();
    const { error } = await sb().auth.signInWithPassword({ email, password: pw });
    if (error) setErr('Email ou mot de passe incorrect.');
  }

  return (
    <form className="login" onSubmit={go}>
      <div className="admin-brand admin-brand-login">
        <img src="/logomaron.png" alt="Tomo" />
        <div>
          <h1>Administration</h1>
          <p>Gérez votre site Tomo</p>
        </div>
      </div>
      <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input type="password" placeholder="Mot de passe" value={pw} onChange={(e) => setPw(e.target.value)} required />
      {err && <p className="err">{err}</p>}
      <button className="btn big">Se connecter</button>
    </form>
  );
}

export default function Admin() {
  const configured = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState(null);
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState('');
  const [bulk, setBulk] = useState(null); // état de « Optimiser toutes les photos »

  useEffect(() => {
    if (!configured) return;
    const c = sb();
    c.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setReady(true);
    });
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

  if (!configured) {
    return <div className="wrap"><p>Supabase n’est pas configuré : ajoutez les clés dans <code>.env.local</code> (voir README).</p></div>;
  }

  if (!ready) return <div className="wrap">Chargement…</div>;
  if (!session) return <Login />;
  if (!data) return <div className="wrap">Chargement des données…</div>;

  const edit = (fn) => setData((d) => {
    const n = structuredClone(d);
    n.site.sections ??= {};
    n.site.logo ??= {};
    fn(n);
    return n;
  });

  const save = async () => {
    setMsg('Enregistrement…');
    const { error } = await sb().from('site_data').upsert([
      { key: 'menu', value: data.menu },
      { key: 'site', value: data.site }
    ]);
    setMsg(error ? 'Erreur : ' + error.message : 'Enregistré ✓ (visible sur le site dans ~10 secondes)');
  };

  // Recompresse toutes les photos déjà envoyées, puis remplace leurs adresses.
  // Les originaux restent dans Supabase. Il faut ensuite cliquer sur « Enregistrer ».
  async function optimizeAll() {
    const urls = [...collectMedia([data.menu, data.site])].filter((u) => !u.includes('-opt-'));

    if (!urls.length) {
      setBulk({ running: false, text: 'Aucune photo à optimiser.' });
      return;
    }
    if (!confirm(`Optimiser ${urls.length} photo(s) ? Les originaux restent dans Supabase. Pense à cliquer sur « Enregistrer » ensuite.`)) return;

    const map = new Map();
    let before = 0;
    let after = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < urls.length; i++) {
      setBulk({ running: true, text: `Photo ${i + 1} sur ${urls.length}…` });
      try {
        const res = await fetch(urls[i]);
        if (!res.ok) throw new Error('lecture impossible');
        const blob = await res.blob();
        const fileName = decodeURIComponent(urls[i].split('/').pop().split('?')[0]);
        const original = new File([blob], fileName, { type: blob.type });

        const out = await compressImage(original);
        if (out === original) { skipped++; continue; } // déjà légère

        const base = fileName.replace(/\.[^.]+$/, '').replace(/[^\w.-]/g, '_');
        const finalName = `${Date.now()}-${i}-opt-${base}.${extFromType(out.type)}`;

        const { error } = await sb().storage.from('media').upload(finalName, out, {
          contentType: out.type,
          cacheControl: '31536000',
          upsert: false
        });
        if (error) throw error;

        map.set(urls[i], sb().storage.from('media').getPublicUrl(finalName).data.publicUrl);
        before += original.size;
        after += out.size;
      } catch {
        failed++;
      }
    }

    if (map.size) {
      edit((n) => {
        n.menu = swapMedia(n.menu, map);
        n.site = swapMedia(n.site, map);
      });
    }

    const mb = (b) => (b / 1048576).toFixed(1);
    setBulk({
      running: false,
      text:
        `Terminé : ${map.size} photo(s) optimisée(s) (${mb(before)} Mo → ${mb(after)} Mo)` +
        (skipped ? `, ${skipped} déjà légère(s)` : '') +
        (failed ? `, ${failed} échec(s)` : '') +
        (map.size ? '. Clique sur « Enregistrer » pour appliquer.' : '.')
    });
  }

  const { site, menu } = data;

  return (
    <div className="wrap">
      <header className="top">
        <div className="admin-brand">
          <img src="/logomaron.png" alt="Tomo" />
          <div>
            <h1>Administration Tomo</h1>
            <p>Gestion du site et du menu</p>
          </div>
        </div>

        <div className="admin-quick-nav" aria-label="Navigation administration">
          <a href="#general" className="lnk">Accueil</a>
          <a href="#logo" className="lnk">Logo</a>
          <a href="#photos" className="lnk">Photos</a>
          <a href="#menu" className="lnk">Menu</a>
        </div>

        <a href="/" target="_blank" rel="noreferrer" className="btn btn-light">
          Voir le site ↗
        </a>

        <button className="lnk" onClick={() => sb().auth.signOut()}>
          Déconnexion
        </button>
      </header>

      <details id="general" open className="box">
        <summary>Général et accueil</summary>
        <label>Nom
          <input value={site.name || ''} onChange={(e) => edit((n) => { n.site.name = e.target.value; })} />
        </label>
        <label>Slogan
          <input value={site.tagline || ''} onChange={(e) => edit((n) => { n.site.tagline = e.target.value; })} />
        </label>
        <label>Phrase du bas de page
          <input value={site.footer || ''} onChange={(e) => edit((n) => { n.site.footer = e.target.value; })} />
        </label>
        <p className="sub">Photo de l’accueil</p>
        <Pick value={site.hero?.bg} onChange={(u) => edit((n) => { n.site.hero = { bg: u }; })} />
      </details>

      <details id="logo" open className="box">
        <summary>Logo</summary>
        <Pick value={site.logo?.src} label="Changer le logo (PNG)" onChange={(u) => edit((n) => { n.site.logo.src = u; })} />
        <label>Taille : {site.logo?.width || 320}px
          <input type="range" min="120" max="500" value={site.logo?.width || 320} onChange={(e) => edit((n) => { n.site.logo.width = +e.target.value; })} />
        </label>
        <label>Position sur l’accueil
          <select value={site.logo?.position || 'center'} onChange={(e) => edit((n) => { n.site.logo.position = e.target.value; })}>
            <option value="left">Gauche</option>
            <option value="center">Centre</option>
            <option value="right">Droite</option>
          </select>
        </label>
      </details>

      <details id="photos" className="box">
        <summary>Optimiser les photos</summary>
        <p className="sub">
          Réduit le poids de toutes les photos déjà envoyées, sans perte de qualité visible,
          pour que le site se charge plus vite. Les originaux restent dans Supabase.
        </p>
        <div className="row">
          <button className="btn" disabled={bulk?.running} onClick={optimizeAll}>
            {bulk?.running ? 'Optimisation…' : 'Optimiser toutes les photos'}
          </button>
        </div>
        {bulk?.text && <p className="sub">{bulk.text}</p>}
      </details>

      <h2 id="menu">Menu</h2>

      {menu.categories.map((c, ci) => (
        <details key={c.id} className="box">
          <summary>{c.title} ({c.items.length})</summary>

          <label>Titre de la catégorie
            <input value={c.title} onChange={(e) => edit((n) => { n.menu.categories[ci].title = e.target.value; })} />
          </label>

          <p className="sub">Arrière-plan de la catégorie</p>
          <Pick value={site.sections?.[c.id]?.bg} onChange={(u) => edit((n) => {
            n.site.sections[c.id] = { ...(n.site.sections[c.id] || {}), bg: u };
          })} />

          {c.items.map((it, ii) => (
            <div className="aitem" key={ii}>
              <div className="row">
                <input
                  className="grow"
                  placeholder="Nom"
                  value={it.name}
                  onChange={(e) => edit((n) => { n.menu.categories[ci].items[ii].name = e.target.value; })}
                />
                <input
                  className="price"
                  type="number"
                  placeholder="Prix"
                  value={it.price}
                  onChange={(e) => edit((n) => { n.menu.categories[ci].items[ii].price = +e.target.value; })}
                />
                <button
                  className="lnk"
                  title="Monter"
                  disabled={ii === 0}
                  onClick={() => edit((n) => {
                    const a = n.menu.categories[ci].items;
                    [a[ii - 1], a[ii]] = [a[ii], a[ii - 1]];
                  })}
                >
                  ↑
                </button>
                <button
                  className="lnk"
                  title="Descendre"
                  disabled={ii === c.items.length - 1}
                  onClick={() => edit((n) => {
                    const a = n.menu.categories[ci].items;
                    [a[ii + 1], a[ii]] = [a[ii], a[ii + 1]];
                  })}
                >
                  ↓
                </button>
                <button className="lnk red" onClick={() => confirm('Supprimer ce produit ?') && edit((n) => {
                  n.menu.categories[ci].items.splice(ii, 1);
                })}>
                  Supprimer
                </button>
              </div>

              <input
                placeholder="Description"
                value={it.desc || ''}
                onChange={(e) => edit((n) => { n.menu.categories[ci].items[ii].desc = e.target.value; })}
              />

              <Pick
                crop
                value={it.photo || ''}
                label="Photo du produit"
                onChange={(u) => edit((n) => { n.menu.categories[ci].items[ii].photo = u; })}
              />

              <div className="row">
                <label className="grow">Assiette sous le produit
                  <select
                    value={it.plate || ''}
                    onChange={(e) => edit((n) => { n.menu.categories[ci].items[ii].plate = e.target.value; })}
                  >
                    <option value="">Aucune</option>
                    <option value="white">Assiette blanche</option>
                    <option value="wood">Planche en bois</option>
                    <option value="slate">Ardoise noire</option>
                    <option value="custom">Mon image d’assiette</option>
                  </select>
                </label>
              </div>

              {it.plate === 'custom' && (
                <Pick
                  value={it.plateImg || ''}
                  label="Image de l’assiette"
                  onChange={(u) => edit((n) => { n.menu.categories[ci].items[ii].plateImg = u; })}
                />
              )}

              {it.plate && (
                <label>Taille du produit sur l’assiette : {it.plateScale || 80}%
                  <input
                    type="range"
                    min="40"
                    max="100"
                    value={it.plateScale || 80}
                    onChange={(e) => edit((n) => { n.menu.categories[ci].items[ii].plateScale = +e.target.value; })}
                  />
                </label>
              )}

              <Pick
                value={it.hero || ''}
                label="Photo de fond de la carte"
                onChange={(u) => edit((n) => { n.menu.categories[ci].items[ii].hero = u; })}
              />

              {(it.arrows || []).map((a, ai) => (
                <div className="row" key={ai}>
                  <input
                    className="grow"
                    placeholder="Texte de la flèche"
                    value={a.label}
                    onChange={(e) => edit((n) => { n.menu.categories[ci].items[ii].arrows[ai].label = e.target.value; })}
                  />
                  <select value={a.pos || ''} onChange={(e) => edit((n) => {
                    const ar = n.menu.categories[ci].items[ii].arrows[ai];
                    if (e.target.value) ar.pos = e.target.value;
                    else delete ar.pos;
                  })}>
                    <option value="">Auto</option>
                    {POS.map((p) => <option key={p}>{p}</option>)}
                  </select>
                  <button className="lnk red" onClick={() => edit((n) => {
                    n.menu.categories[ci].items[ii].arrows.splice(ai, 1);
                  })}>×</button>
                </div>
              ))}

              <button className="lnk" onClick={() => edit((n) => {
                const x = n.menu.categories[ci].items[ii];
                x.arrows = [...(x.arrows || []), { label: '' }];
              })}>
                + Ajouter une flèche
              </button>
            </div>
          ))}

          <div className="row">
            <button className="btn" onClick={() => edit((n) => {
              n.menu.categories[ci].items.push({
                name: 'Nouveau produit',
                desc: '',
                price: 0,
                photo: '',
                hero: '',
                plate: '',
                arrows: []
              });
            })}>
              + Ajouter un produit
            </button>
            <button className="lnk red" onClick={() => confirm('Supprimer toute la catégorie ?') && edit((n) => {
              n.menu.categories.splice(ci, 1);
              delete n.site.sections[c.id];
            })}>
              Supprimer la catégorie
            </button>
          </div>
        </details>
      ))}

      <button className="btn" onClick={() => {
        const t = prompt('Nom de la nouvelle catégorie ?');
        if (t) edit((n) => { n.menu.categories.push({ id: slug(t), title: t, items: [] }); });
      }}>
        + Ajouter une catégorie
      </button>

      <div className="savebar">
        <span>{msg}</span>
        <button className="btn big" onClick={save}>Enregistrer</button>
      </div>
    </div>
  );
}
