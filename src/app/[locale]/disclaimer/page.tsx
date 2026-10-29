import { makeContentPage } from '@/lib/content/page-factory';

const { generateMetadata, Page } = makeContentPage('disclaimer', 'disclaimer', {
  pathname: '/disclaimer',
});
export { generateMetadata };
export default Page;
