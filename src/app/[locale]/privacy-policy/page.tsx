import { makeContentPage } from '@/lib/content/page-factory';

const { generateMetadata, Page } = makeContentPage('privacy', 'privacy', {
  pathname: '/privacy-policy',
});
export { generateMetadata };
export default Page;
