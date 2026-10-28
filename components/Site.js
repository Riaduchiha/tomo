'use client';
import { useEffect, useRef, useState } from 'react';
import { MotionConfig, motion, useScroll, useTransform, useMotionValueEvent } from 'framer-motion';

const Reveal = ({ children, delay = 0 }) => (
  <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.7, delay }}>{children}</motion.div>
);

function Bg({ src }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], ['-10%', '10%']);
  return <div ref={ref} className="bg"><motion.div className="bgimg" style={{ y, backgroundImage: `url(${src})` }} /></div>;
}

const Arrow = ({ label }) => (
  <div className="arrow">
    <svg viewBox="0 0 80 50" width="70" aria-hidden="true">
      <motion.path d="M5 40 C 25 5, 50 5, 72 22 M72 22 L60 16 M72 22 L64 33" fill="none" stroke="currentColor"
        strokeWidth="3" strokeLinecap="round" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }}
        viewport={{ once: true }} transition={{ duration: 1, delay: 0.3 }} />
    </svg>
    <span>{label}</span>
  </div>
);

const isFeat = (it) => it.photo || (it.arrows && it.arrows.length);
const AUTO = ['top-left', 'bottom-right', 'bottom-left', 'top-right'];
function Feat({ it }) {
  return (
    <Reveal>
      <article className="feat">
        <h3>{it.name}</h3>
        {it.desc && <p className="fd">{it.desc}</p>}
        <div className="stage">
          <motion.div className="fphoto" initial={{ scale: 0.85, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }} transition={{ duration: 0.7 }}>
            {it.photo ? <img src={it.photo} alt={it.name} loading="lazy" /> : <span>Photo à ajouter</span>}
          </motion.div>
          {(it.arrows || []).map((a, i) => {
            const pos = a.pos || AUTO[i % 4];
            return (
              <div key={i} className={`lab ${pos}`}>
                <span>{a.label}</span>
                <svg viewBox="0 0 80 50" width="54" aria-hidden="true">
                  <motion.path d="M6 6 C 30 6, 52 16, 62 40 M62 40 L52 33 M62 40 L69 29" fill="none" stroke="currentColor"
                    strokeWidth="3" strokeLinecap="round" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }}
                    viewport={{ once: true }} transition={{ duration: 0.9, delay: 0.4 + i * 0.15 }} />
                </svg>
              </div>);
          })}
        </div>
        {it.price > 0 && <span className="pr">{it.price} DA</span>}
      </article>
    </Reveal>
  );
}

export default function Site({ menu, site }) {
  const [active, setActive] = useState('');
  const nav = useRef(null);
  const logo = site.logo;
  const { scrollY } = useScroll();
  const [d, setD] = useState({ vw: 390, vh: 800 });
  useEffect(() => {
    const f = () => setD({ vw: window.innerWidth, vh: window.innerHeight });
    f(); window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  const [y0, setY0] = useState(200);
  const sp = useRef(null);
  const measure = () => { if (sp.current) setY0(sp.current.getBoundingClientRect().top + window.scrollY); };
  useEffect(measure, [d]);
  // le logo (taille w, hauteur ~ w*0.54) part du centre de l'accueil et monte en haut en rétrécissant
  const w = Math.min(logo.width, d.vw * 0.8);
  const end = Math.max(y0 - 14, 150);
  const side = { left: -1, right: 1, center: 0 }[logo.position] ?? 0;
  const y = useTransform(scrollY, [0, end], [y0, 14]);
  const x = useTransform(scrollY, [0, end], [side * (d.vw / 2 - w / 2 - 20), 0]);
  const sc = useTransform(scrollY, [0, end], [1, Math.min(1, 80 / w)]);
  const [docked, setDocked] = useState(false);
  useMotionValueEvent(scrollY, 'change', (v) => setDocked(v > end * 0.7));
  useEffect(() => {
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: '-30% 0px -65% 0px' });
    document.querySelectorAll('main section').forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    const a = nav.current?.querySelector('.on');
    if (a) nav.current.scrollTo({ left: a.offsetLeft - 20, behavior: 'smooth' });
  }, [active]);
  return (
    <MotionConfig reducedMotion="user">
      <header className="hero" style={site.hero?.bg ? { backgroundImage: `url(${site.hero.bg})` } : undefined}>
        {logo.src ? <img ref={sp} src={logo.src} alt="" aria-hidden="true" onLoad={measure} style={{ width: w, display: 'block', visibility: 'hidden' }} /> : <h1 className="wordmark">{site.name}</h1>}
        <p>{site.tagline}</p>
        <a href={`#${menu.categories[0].id}`}>Voir le menu</a>
      </header>
      {logo.src && (
        <motion.div className="flogo" style={{ y, x, scale: sc, transformOrigin: '50% 0%' }}>
          <img className={docked ? '' : 'blink'} src={logo.src} alt={site.name} style={{ width: w }} />
        </motion.div>
      )}
      <nav ref={nav} aria-label="Menu">
        {menu.categories.map((c) => <a key={c.id} href={`#${c.id}`} className={active === c.id ? 'on' : ''}>{c.title}</a>)}
      </nav>
      <main>
        {menu.categories.map((c) => {
          const s = site.sections[c.id] || {};
          const feats = c.items.filter(isFeat), rest = c.items.filter((it) => !isFeat(it));
          return (
            <section id={c.id} key={c.id} className={s.bg ? 'hasbg' : ''}>
              {s.bg && <Bg src={s.bg} />}
              <div className="card">
                <Reveal><h2>{c.title}</h2></Reveal>
                {(s.photos || []).filter((p) => p.src).length > 0 && (
                  <div className="photos">
                    {s.photos.filter((p) => p.src).map((p, i) => (
                      <Reveal key={i} delay={i * 0.1}>
                        <figure><img src={p.src} alt={p.caption || ''} loading="lazy" />
                          {p.arrow && <Arrow label={p.arrow} />}
                          {p.caption && <figcaption>{p.caption}</figcaption>}</figure>
                      </Reveal>))}
                  </div>)}
                {feats.length > 0 && <div className="feats">{feats.map((it) => <Feat key={it.name} it={it} />)}</div>}
                <div className="grid">
                  {rest.map((it, i) => (
                    <Reveal key={it.name} delay={(i % 2) * 0.08}>
                      <div className="item"><div><b>{it.name}</b>{it.desc && <small>{it.desc}</small>}</div>
                        {it.price > 0 && <span className="pr">{it.price} DA</span>}</div>
                    </Reveal>))}
                </div>
              </div>
            </section>);
        })}
      </main>
      <footer>{site.footer}</footer>
    </MotionConfig>
  );
}
