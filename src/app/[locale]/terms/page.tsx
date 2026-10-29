import { makeContentPage } from '@/lib/content/page-factory';

const { generateMetadata, Page } = makeContentPage('terms', 'terms', { pathname: '/terms' });
export { generateMetadata };
export default Page;
