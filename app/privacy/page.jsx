import Privacy from '@/components/privacy';

export const metadata = {
  title: { absolute: 'Privacy Policy | The Nitro NG' },
  description: 'How Nitro collects, uses, and protects your personal data. Read our full privacy policy.',
  openGraph: {
    title: 'Privacy Policy | The Nitro NG',
  },
  alternates: { canonical: 'https://nitro.ng/privacy' },
};

export default function PrivacyPage() {
  return <Privacy />;
}
