// Dedicated /signup route for SEO sitelinks
// Redirects to the homepage signup modal until a standalone signup page is built
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Create Account',
  description: 'Create a free Nitro account. Buy Instagram followers, TikTok views, YouTube subscribers and more at the cheapest rates in Nigeria.',
  alternates: { canonical: '/signup' },
};

export default function SignupPage() {
  redirect('/?signup=1');
}
