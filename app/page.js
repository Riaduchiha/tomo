import Site from '../components/Site';
import { getData } from '../lib/data';
import TomoWelcomeQuiz from '../components/TomoWelcomeQuiz';

export const revalidate = 10;

// Chemin de ta photo hero : remplace-le par le bon
const HERO = '/images/hero.jpg';

// Parcourt le menu et récupère toutes les URLs de photos
function collectImages(data, out = []) {
  if (Array.isArray(data)) {
    data.forEach((d) => collectImages(d, out));
  } else if (data && typeof data === 'object') {
    for (const [key, value] of Object.entries(data)) {
      if (
        typeof value === 'string' &&
        value &&
        /^(image|image_url|img|photo|picture)$/i.test(key)
      ) {
        out.push(value);
      } else {
        collectImages(value, out);
      }
    }
  }
  return out;
}

export default async function Page() {
  const { menu, site } = await getData();
  const images = collectImages(menu);

  return (
    <TomoWelcomeQuiz images={images} heroSrc={HERO} logoSrc="/logomaron.png" alwaysShow>
      <Site menu={menu} site={site} />
    </TomoWelcomeQuiz>
  );
}