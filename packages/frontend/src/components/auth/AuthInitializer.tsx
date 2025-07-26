'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/auth.store';

export function AuthInitializer() {
  useEffect(() => {
    // Only run on client side
    if (typeof window !== 'undefined') {
      const initAuth = async () => {
        try {
          await useAuthStore.persist.rehydrate();
        } catch (error) {
          console.error('Failed to rehydrate auth store:', error);
        }
      };
      
      initAuth();
    }
  }, []);
  
  return null;
}