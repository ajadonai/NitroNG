import Refund from '@/components/refund';

export const metadata = {
  title: 'Refund Policy',
  description: 'Nitro refund policy. Understand our refund process for orders and wallet deposits.',
  alternates: { canonical: 'https://nitro.ng/refund' },
};

export default function RefundPage() {
  return <Refund />;
}
