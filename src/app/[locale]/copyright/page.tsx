import { makeContentPage } from '@/lib/content/page-factory';

const { generateMetadata, Page } = makeContentPage('copyright', 'copyright', {
  pathname: '/copyright',
});
export { generateMetadata };
export default Page;
