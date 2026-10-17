import Maintenance from '@/components/maintenance';

// Not a page to find in search: kept out of the index, and not claiming the
// homepage's canonical, which it inherited from the root layout.
export const metadata = {
  title: 'Maintenance',
  robots: { index: false, follow: false },
};

export default function MaintenancePage() {
  return <Maintenance />;
}
