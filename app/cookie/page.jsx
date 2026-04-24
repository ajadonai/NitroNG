import CookiePolicy from '@/components/cookie';

export const metadata = {
  title: 'Cookie Policy',
  description: 'Learn how Nitro uses cookies and similar technologies to improve your experience on our platform.',
  alternates: { canonical: 'https://nitro.ng/cookie' },
};

export default function CookiePage() {
  return <CookiePolicy />;
}
