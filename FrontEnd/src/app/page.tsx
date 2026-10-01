'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

export default function RootPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  
  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        if (user?.role === 'SUPER_ADMIN') {
          router.push('/super-admin');
        } else if (user?.role === 'CLIENT_ADMIN' || user?.role === 'ADMIN') {
          router.push('/admin');
        } else {
          router.push('/dashboard');
        }
      } else {
        router.push('/home');
      }
    }
  }, [router, isAuthenticated, isLoading, user]);

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-charcoal-mid text-sm font-medium">Loading HireIQ by TaskNera...</p>
      </div>
    </div>
  );
}

