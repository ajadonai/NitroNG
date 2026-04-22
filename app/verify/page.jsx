import Verify from '@/components/verify';

export const metadata = {
  title: 'Verify Your Email',
  description: 'Verify your Nitro account email address to start placing orders.',
  robots: { index: false, follow: false },
};

export default function VerifyPage() {
  return <Verify />;
}
