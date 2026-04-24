// Dedicated /login route for SEO sitelinks
// Redirects to the homepage login modal until a standalone login page is built
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Log In',
  description: 'Log in to your Nitro account. Manage orders, track growth, and access all SMM services.',
  alternates: { canonical: '/login' },
};

export default function LoginPage() {
  redirect('/?login=1');
}
