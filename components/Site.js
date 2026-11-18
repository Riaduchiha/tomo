import Site from '../components/Site';
import { getData } from '../lib/data';
import TomoWelcomeQuiz from '../components/TomoWelcomeQuiz';

export const revalidate = 10;

const HERO = '/images/hero.jpg';

// Cherche TOUTES les adresses de photos dans le menu et dans le site,
// quel que soit le nom du champ (hero, bg, photo, src, plateImg, logo...)
const IMG_URL = /\.(png|jpe?g|webp|avif|gif|svg)(\?.*)?$/i;

function collectImages(data, out = []) {
  if (typeof data === 'string') {
    if (IMG_URL.test(data) || data.includes('/storage/v1/object/public/')) {
      out.push(data);
    }
  } else if (Array.isArray(data)) {
    data.forEach((d) => collectImages(d, out));
  } else if (data && typeof data === 'object') {
    Object.values(data).forEach((v) => collectImages(v, out));
  }
  return out;
}

export default async function Page() {
  const { menu, site } = await getData();
  const images = collectImages([site, menu]);

  return (
    <TomoWelcomeQuiz
      images={images}
      heroSrc={HERO}
      logoSrc="/logomaron.png"
      alwaysShow
    >
      <Site menu={menu} site={site} />
    </TomoWelcomeQuiz>
  );
}