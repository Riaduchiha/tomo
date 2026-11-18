"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import styles from "./TomoWelcomeQuiz.module.css";
import { PROFILE_KEY, PROFILE_EVENT, WELCOME_KEY } from "./tomoProfile";

const MAX_WAIT_MS = 15000; // après 15 s, on laisse entrer même si tout n’est pas chargé
const NONE = "none"; // choix exclusif « aucun »

const PROFILES = {
  sucre: {
    title: "Team brunch sucré",
    text: "Pancakes, gaufres, sirop… tu commences la journée par le plaisir.",
  },
  sale: {
    title: "Team brunch salé",
    text: "Œufs, sandwichs bien garnis : avant midi, tu veux un vrai repas.",
  },
  healthy: {
    title: "Team healthy",
    text: "Fruits frais, granola, jus pressés : tu te sens bien, et ça se voit.",
  },
  cookie: {
    title: "Team cookie",
    text: "Fondant, tiède, généreux. Tu sais exactement pourquoi tu viens.",
  },
};

/*
  type "single" : un seul choix, on passe à la question suivante tout de suite
  type "multi"  : cases à cocher, plusieurs choix possibles, question facultative
  Les valeurs des allergies doivent correspondre aux clés utilisées dans
  le champ `allergens` de tes produits.
*/
const STEPS = [
  {
    id: "team",
    type: "single",
    title: "Qu’est-ce qui te fait envie le matin ?",
    options: [
      { value: "sucre", label: "Des pancakes ou des gaufres" },
      { value: "sale", label: "Des œufs ou un sandwich garni" },
      { value: "healthy", label: "Des fruits et du granola" },
      { value: "cookie", label: "Un cookie fondant" },
    ],
  },
  {
    id: "drinks",
    type: "multi",
    title: "Qu’est-ce que tu bois chez nous ?",
    hint: "Plusieurs choix possibles.",
    options: [
      { value: "cafe", label: "Café" },
      { value: "the", label: "Thé" },
      { value: "jus", label: "Jus pressés" },
      { value: "chocolat", label: "Chocolat chaud" },
      { value: "frais", label: "Boissons fraîches" },
    ],
  },
  {
    id: "allergies",
    type: "multi",
    title: "As-tu des allergies alimentaires ?",
    hint: "Facultatif. Coche tout ce qui s’applique.",
    note: "Allergie sévère ? Préviens toujours notre équipe en commandant : ce questionnaire ne la remplace pas.",
    options: [
      { value: "gluten", label: "Gluten (blé, orge, seigle)", short: "gluten" },
      { value: "lait", label: "Lait et lactose", short: "lait" },
      { value: "oeufs", label: "Œufs", short: "œufs" },
      { value: "fruits-a-coque", label: "Fruits à coque (noix, amandes…)", short: "fruits à coque" },
      { value: "arachides", label: "Arachides", short: "arachides" },
      { value: "soja", label: "Soja", short: "soja" },
      { value: "sesame", label: "Sésame", short: "sésame" },
      { value: "poisson", label: "Poisson et fruits de mer", short: "poisson" },
      { value: NONE, label: "Aucune allergie" },
    ],
  },
  {
    id: "needs",
    type: "multi",
    title: "Un besoin particulier pour manger ?",
    hint: "Facultatif. On s’en sert uniquement pour t’aider à choisir.",
    options: [
      { value: "peu-sucre", label: "Peu de sucre", short: "peu de sucre" },
      { value: "peu-sel", label: "Peu de sel", short: "peu de sel" },
      { value: "vegetarien", label: "Végétarien", short: "végétarien" },
      { value: "vegan", label: "Végan", short: "végan" },
      { value: NONE, label: "Aucun besoin particulier" },
    ],
  },
];

const RESULT = STEPS.length;

/* Le logo est pâle au départ, puis se remplit de bas en haut
   à mesure que les photos arrivent. */
function Logo({ src, progress }) {
  return (
    <div className={styles.logo} aria-hidden="true">
      <Image
        src={src}
        alt=""
        width={160}
        height={60}
        className={styles.logoBase}
        priority
      />
      <Image
        src={src}
        alt=""
        fill
        sizes="160px"
        className={styles.logoFill}
        style={{ clipPath: `inset(${(1 - progress) * 100}% 0 0 0)` }}
      />
    </div>
  );
}

/**
 * Enveloppe le site : affiche un questionnaire pendant que les photos se chargent.
 *
 * Props
 * - images       : toutes les URLs de photos du site (menu + site), telles
 *   qu’elles sont utilisées dans Site.js
 * - logoSrc      : logo (dans /public), par défaut "/logomaron.png"
 * - heroSrc      : photo hero affichée en arrière-plan du quiz
 * - alwaysShow   : true pour toujours afficher le quiz (pour tester)
 */
export default function TomoWelcomeQuiz({
  images = [],
  logoSrc = "/logomaron.png",
  heroSrc,
  alwaysShow = false,
  children,
}) {
  const urls = useMemo(
    () => Array.from(new Set(images.filter(Boolean))),
    [images]
  );

  const [open, setOpen] = useState(true);
  const [step, setStep] = useState(-1); // -1 = intro, 0..3 = questions, 4 = résultat
  const [answers, setAnswers] = useState({});
  const [settled, setSettled] = useState(() => new Set());
  const [timedOut, setTimedOut] = useState(false);

  // Préchargement : télécharge les photos du site en arrière-plan, 4 à la fois,
  // avec les mêmes URLs que le site (le navigateur les réutilise donc ensuite).
  // Il tourne pour tous les visiteurs et continue après la fermeture du quiz.
  useEffect(() => {
    if (urls.length === 0) return;
    let cancelled = false;
    let i = 0;
    const pool = []; // garde les références pour que les téléchargements aillent au bout

    const loadNext = () => {
      if (cancelled || i >= urls.length) return;
      const src = urls[i++];
      const img = new window.Image();
      const done = () => {
        setSettled((prev) => (prev.has(src) ? prev : new Set(prev).add(src)));
        loadNext();
      };
      img.onload = done;
      img.onerror = done;
      img.src = src;
      pool.push(img);
    };

    for (let k = 0; k < 4; k++) loadNext();
    return () => {
      cancelled = true;
    };
  }, [urls]);

  const progress =
    urls.length === 0
      ? 1
      : urls.filter((u) => settled.has(u)).length / urls.length;
  const ready = progress >= 1 || timedOut;
  const percent = Math.round(progress * 100);

  const winner = answers.team || "cookie";
  const current = step >= 0 && step < RESULT ? STEPS[step] : null;

  // Visiteur déjà passé par là : photos en cache, on saute le quiz
  useEffect(() => {
    if (alwaysShow) return;
    try {
      if (localStorage.getItem(WELCOME_KEY) === "1") setOpen(false);
    } catch {}
  }, [alwaysShow]);

  // Bloque le défilement du site derrière le quiz
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Filet de sécurité : connexion très lente
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), MAX_WAIT_MS);
    return () => clearTimeout(t);
  }, []);

  const next = () => setStep((s) => s + 1);
  const back = () => setStep((s) => s - 1);

  const choose = (id, value) => {
    setAnswers((a) => ({ ...a, [id]: value }));
    next();
  };

  const toggle = (id, value) =>
    setAnswers((a) => {
      const cur = a[id] || [];
      let nextList;
      if (value === NONE) {
        nextList = cur.includes(NONE) ? [] : [NONE];
      } else if (cur.includes(value)) {
        nextList = cur.filter((v) => v !== value);
      } else {
        nextList = [...cur.filter((v) => v !== NONE), value];
      }
      return { ...a, [id]: nextList };
    });

  const optionLabel = (id, value) => {
    const o = STEPS.find((s) => s.id === id).options.find(
      (opt) => opt.value === value
    );
    return o.short || o.label;
  };

  // Lignes du récapitulatif affiché sur l’écran de résultat
  const summaryRow = (id, title, noneText) => {
    const vals = answers[id] || [];
    if (vals.length === 0) return null;
    const text = vals.includes(NONE)
      ? noneText
      : vals.map((v) => optionLabel(id, v)).join(", ");
    return [title, text];
  };
  const summary = [
    summaryRow("allergies", "Allergies", "aucune"),
    summaryRow("needs", "Besoins", "aucun"),
    summaryRow("drinks", "Boissons", ""),
  ].filter(Boolean);
  const hasAllergies = (answers.allergies || []).some((v) => v !== NONE);

  // Le profil reste dans le navigateur du client, rien n’est envoyé
  const saveProfile = () => {
    try {
      const clean = (id) => (answers[id] || []).filter((v) => v !== NONE);
      localStorage.setItem(
        PROFILE_KEY,
        JSON.stringify({
          team: winner,
          drinks: clean("drinks"),
          allergies: clean("allergies"),
          allergiesAnswered: (answers.allergies || []).length > 0,
          needs: clean("needs"),
        })
      );
      window.dispatchEvent(new Event(PROFILE_EVENT));
    } catch {}
  };

  const enter = (fromResult) => {
    if (ready) {
      try {
        localStorage.setItem(WELCOME_KEY, "1");
      } catch {}
    }
    if (fromResult) saveProfile();
    setOpen(false);
    if (fromResult) {
      // Si tu donnes des id "menu-sucre", "menu-sale", "menu-healthy",
      // "menu-cookie" à tes sections, le site défile jusqu’à la bonne.
      requestAnimationFrame(() =>
        document
          .getElementById(`menu-${winner}`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" })
      );
    }
  };

  return (
    <>
      {children}

      {open && (
        <div
          className={styles.overlay}
          role="dialog"
          aria-modal="true"
          aria-label="Bienvenue chez Tomo"
        >
          {/* Photo hero en arrière-plan */}
          <div className={styles.bg} aria-hidden="true">
            {heroSrc && (
              <Image
                src={heroSrc}
                alt=""
                fill
                sizes="100vw"
                priority
                className={styles.bgImage}
              />
            )}
          </div>

          <header className={styles.bar}>
            <Logo src={logoSrc} progress={progress} />
            <div className={styles.barText}>
              <span>
                {ready ? "Ton menu est prêt" : "On prépare les photos du menu"}
              </span>
              <strong>{percent}%</strong>
            </div>
            <button
              type="button"
              className={styles.skip}
              onClick={() => enter(false)}
            >
              Passer
            </button>
          </header>

          <main className={styles.main}>
            {step === -1 && (
              <section className={styles.card} key="intro">
                <h1 className={styles.title}>Un café pendant que ça charge ?</h1>
                <p className={styles.text}>
                  Réponds à {STEPS.length} questions rapides sur tes goûts, tes
                  allergies et tes besoins. Tout est facultatif, et tes réponses
                  restent sur ton téléphone.
                </p>
                <button
                  type="button"
                  className={styles.primary}
                  onClick={() => setStep(0)}
                >
                  C’est parti
                </button>
              </section>
            )}

            {current && (
              <section className={styles.card} key={current.id}>
                <p className={styles.count}>
                  Question {step + 1} sur {STEPS.length}
                </p>
                <h2 className={styles.title}>{current.title}</h2>
                {current.hint && <p className={styles.hint}>{current.hint}</p>}

                {current.type === "single" && (
                  <>
                    <div className={styles.options}>
                      {current.options.map((o) => (
                        <button
                          type="button"
                          key={o.value}
                          className={styles.option}
                          onClick={() => choose(current.id, o.value)}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                    {step > 0 && (
                      <button type="button" className={styles.back} onClick={back}>
                        Retour
                      </button>
                    )}
                  </>
                )}

                {current.type === "multi" && (
                  <>
                    <div className={styles.checks}>
                      {current.options.map((o) => {
                        const checked = (answers[current.id] || []).includes(
                          o.value
                        );
                        return (
                          <label
                            key={o.value}
                            className={`${styles.check} ${
                              checked ? styles.checked : ""
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggle(current.id, o.value)}
                            />
                            <span className={styles.box} aria-hidden="true" />
                            <span>{o.label}</span>
                          </label>
                        );
                      })}
                    </div>
                    {current.note && <p className={styles.note}>{current.note}</p>}
                    <div className={styles.actions}>
                      <button type="button" className={styles.primary} onClick={next}>
                        {(answers[current.id] || []).length
                          ? "Continuer"
                          : "Passer cette question"}
                      </button>
                      <button type="button" className={styles.back} onClick={back}>
                        Retour
                      </button>
                    </div>
                  </>
                )}
              </section>
            )}

            {step === RESULT && (
              <section className={styles.card} key="result">
                <p className={styles.count}>Ton résultat</p>
                <h2 className={styles.title}>{PROFILES[winner].title}</h2>
                <p className={styles.text}>{PROFILES[winner].text}</p>

                {summary.length > 0 && (
                  <dl className={styles.summary}>
                    {summary.map(([title, text]) => (
                      <div key={title}>
                        <dt>{title} :</dt>
                        <dd>{text}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {hasAllergies && (
                  <p className={styles.note}>
                    Préviens toujours notre équipe de ton allergie en commandant.
                  </p>
                )}

                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.primary}
                    disabled={!ready}
                    onClick={() => enter(true)}
                  >
                    {ready ? "Voir le menu" : `Photos en route… ${percent}%`}
                  </button>
                  <button type="button" className={styles.back} onClick={back}>
                    Retour
                  </button>
                </div>
              </section>
            )}
          </main>
        </div>
      )}
    </>
  );
}
