import Site from '../components/Site';
import { getData } from '../lib/data';
export const revalidate = 10;
export default async function Page() {
  const { menu, site } = await getData();
  return <Site menu={menu} site={site} />;
}
