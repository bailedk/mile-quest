'use client';

import React, { createContext, useContext } from 'react';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/Toast';

interface ToastContextType {
  showToast: (message: string, type?: 'info' | 'success' | 'warning' | 'error', duration?: number) => void;
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => {}
});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { toasts, addToast, removeToast } = useToast();

  const showToast = (message: string, type?: 'info' | 'success' | 'warning' | 'error', duration?: number) => {
    addToast(message, type, duration);
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToastContext() {
  return useContext(ToastContext);
}