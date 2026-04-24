// Dedicated /signup route for SEO sitelinks
// Redirects to the homepage signup modal until a standalone signup page is built
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Create Account',
  description: 'Create your free Nitro account and start growing your social media presence in minutes. Naira pricing, instant delivery, 35+ platforms.',
  alternates: { canonical: '/signup' },
};

export default function SignupPage() {
  redirect('/?signup=1');
}
