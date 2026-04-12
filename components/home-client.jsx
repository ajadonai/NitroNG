'use client';
import { useEffect, useState, useRef } from 'react';
import LoadingScreen from '@/components/loading-screen';

export default function HomeClient() {
  const [ready, setReady] = useState(false);
  const [minWait, setMinWait] = useState(false);
  const LandingRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => setMinWait(true), 1500);
    import('@/components/landing-page').then(mod => {
      LandingRef.current = mod.default;
      setReady(true);
    });
    return () => clearTimeout(timer);
  }, []);

  if (!ready || !minWait || !LandingRef.current) return <LoadingScreen />;
  const Landing = LandingRef.current;
  return <Landing />;
}
