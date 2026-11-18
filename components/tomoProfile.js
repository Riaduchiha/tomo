// Profil du client : enregistré uniquement dans son navigateur (localStorage).
// Rien n’est envoyé à un serveur.

export const PROFILE_KEY = "tomo-profile";
export const WELCOME_KEY = "tomo-welcomed";
export const PROFILE_EVENT = "tomo-profile"; // émis quand le client termine le quiz

/*
  Forme du profil :
  {
    team: "sucre" | "sale" | "healthy" | "cookie",
    drinks: ["cafe", "the", ...],
    allergies: ["gluten", "lait", "oeufs", "fruits-a-coque",
                "arachides", "soja", "sesame", "poisson"],
    allergiesAnswered: true | false,   // false = le client a passé la question
    needs: ["peu-sucre", "peu-sel", "vegetarien", "vegan"],
  }
*/

export function getTomoProfile() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Permet au client d’effacer ses réponses et de refaire le quiz
export function clearTomoProfile() {
  try {
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(WELCOME_KEY);
    window.dispatchEvent(new Event(PROFILE_EVENT));
  } catch {}
}

/*
  Allergènes d’un produit en conflit avec les allergies du client.
  `item.allergens` doit être un tableau de clés, par ex. ["gluten", "lait"].
  Renvoie [] s’il n’y a aucun conflit connu.
*/
export function allergenConflicts(item, profile) {
  const mine = profile?.allergies ?? [];
  return (item?.allergens ?? []).filter((a) => mine.includes(a));
}
