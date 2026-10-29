import { makeContentPage } from '@/lib/content/page-factory';

const { generateMetadata, Page } = makeContentPage('cookies', 'cookies', {
  pathname: '/cookie-policy',
});
export { generateMetadata };
export default Page;
