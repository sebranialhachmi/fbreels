import { makeContentPage } from '@/lib/content/page-factory';

const { generateMetadata, Page } = makeContentPage('accessibility', 'accessibility', {
  pathname: '/accessibility',
});
export { generateMetadata };
export default Page;
