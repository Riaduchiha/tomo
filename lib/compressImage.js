// Compresse une photo avant son envoi vers Supabase, sans perte visible.
// Aucune librairie à installer : tout se fait dans le navigateur.
//
// Réglages (qualité préservée) :
//  - MAX_SIDE : on ne réduit que les photos plus grandes que 2000 px
//    (au-delà, personne ne voit la différence sur un site de café)
//  - QUALITY  : 0.9 en WebP = différence invisible à l’œil
//  - les petites photos (< 300 Ko) ne sont pas touchées
//  - le résultat n’est JAMAIS plus lourd que l’original

const MAX_SIDE = 2000;
const QUALITY = 0.9;
const SKIP_UNDER = 300 * 1024;

export async function compressImage(
  file,
  { maxSide = MAX_SIDE, quality = QUALITY } = {}
) {
  // On laisse tels quels : fichiers non-image, GIF animés et SVG
  if (
    !file.type.startsWith("image/") ||
    file.type === "image/gif" ||
    file.type === "image/svg+xml"
  ) {
    return file;
  }
  if (file.size <= SKIP_UNDER) return file;

  try {
    const bitmap = await createImageBitmap(file); // respecte l’orientation de la photo
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality)
    );

    // Navigateur qui ne sait pas faire du WebP, ou résultat plus lourd : on garde l’original
    if (!blob || blob.type !== "image/webp" || blob.size >= file.size) {
      return file;
    }

    const name = (file.name || "image").replace(/\.[^.]+$/, "") + ".webp";
    return new File([blob], name, { type: "image/webp" });
  } catch {
    return file; // en cas de souci, on envoie la photo d’origine
  }
}

// Extension de fichier correspondant au type d’image renvoyé
export function extFromType(type) {
  return (
    { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png", "image/avif": "avif" }[type] ||
    (type || "").split("/")[1] ||
    "img"
  );
}
