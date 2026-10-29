import { makeContentPage } from '@/lib/content/page-factory';

const { generateMetadata, Page } = makeContentPage('about', 'about', { pathname: '/about' });
export { generateMetadata };
export default Page;
