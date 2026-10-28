# Tomo – site (étape 1)

## Lancer en local
1. Installer Node.js (nodejs.org, version LTS).
2. Dans ce dossier : `npm install` puis `npm run dev` → http://localhost:3000

## Modifier le site (sans admin pour l'instant)
- `data/menu.json` : catégories, plats, descriptions, prix.
- `data/site.json` : nom, slogan, logo (`src`, `width`, `position`: left/center/right),
  et par section : `bg` (arrière-plan) et `photos` (avec `caption` et `arrow` = texte de la flèche).
- Mettre les images dans `public/images/` puis écrire `"/images/nom.jpg"`. Logo : `public/logo.png` → `"/logo.png"`.

## Mettre en ligne gratuitement
1. Créer un compte GitHub et y envoyer ce dossier.
2. Créer un compte Vercel (gratuit), « Add New Project », choisir le dépôt, Deploy.
3. Vous obtenez une adresse `xxx.vercel.app`. Le nom de domaine se branchera plus tard dans Settings → Domains.

## Étape 2 : l'admin
Page `/admin` protégée par mot de passe (Supabase) pour modifier tout ça depuis le navigateur.
