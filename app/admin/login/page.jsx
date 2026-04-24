'use client';
import { useEffect, useState, useRef } from 'react';
import LoadingScreen from '@/components/loading-screen';

export default function AdminLoginPage() {
  const [ready, setReady] = useState(false);
  const [minWait, setMinWait] = useState(false);
  const CompRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => setMinWait(true), 500);
    import('@/components/admin-login').then(mod => {
      CompRef.current = mod.default;
      setReady(true);
    });
    return () => clearTimeout(timer);
  }, []);

  if (!ready || !minWait || !CompRef.current) return <LoadingScreen />;
  const AdminLogin = CompRef.current;
  return <AdminLogin />;
}
