'use client';
import { useEffect, useState, useRef } from 'react';
import LoadingScreen from '@/components/loading-screen';

export default function HomeClient() {
  const [ready, setReady] = useState(false);
  const LandingRef = useRef(null);

  useEffect(() => {
    import('@/components/landing-page').then(mod => {
      LandingRef.current = mod.default;
      setReady(true);
    });
  }, []);

  if (!ready || !LandingRef.current) return <LoadingScreen />;
  const Landing = LandingRef.current;
  return <Landing />;
}
