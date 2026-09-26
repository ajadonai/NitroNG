import LandingPage from '@/components/landing-v3';

export default function HomeClient({ initialAuthQuery, initialStats }) {
  return <LandingPage initialAuthQuery={initialAuthQuery} initialStats={initialStats} />;
}
