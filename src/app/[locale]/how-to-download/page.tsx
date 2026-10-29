import { makeContentPage } from '@/lib/content/page-factory';

const { generateMetadata, Page } = makeContentPage('howTo', 'howTo', {
  pathname: '/how-to-download',
});
export { generateMetadata };
export default Page;
