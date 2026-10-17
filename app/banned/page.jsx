import BannedPage from '@/components/banned';
// Not a page to find in search: kept out of the index, and not claiming the
// homepage's canonical, which it inherited from the root layout.
export const metadata = { title: 'Account Suspended', robots: { index: false, follow: false } };
export default function Page() { return <BannedPage />; }
