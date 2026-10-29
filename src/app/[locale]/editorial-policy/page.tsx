import { makeContentPage } from '@/lib/content/page-factory';

const { generateMetadata, Page } = makeContentPage('editorial', 'editorial', {
  pathname: '/editorial-policy',
});
export { generateMetadata };
export default Page;
