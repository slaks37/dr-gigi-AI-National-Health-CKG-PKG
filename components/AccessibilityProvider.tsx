'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type TextSize = 'small' | 'medium' | 'large';

interface AccessibilityContextType {
  textSize: TextSize;
  setTextSize: (size: TextSize) => void;
  highContrast: boolean;
  setHighContrast: (val: boolean) => void;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [textSize, setTextSize] = useState<TextSize>('medium');
  const [highContrast, setHighContrast] = useState(false);

  useEffect(() => {
    const savedSize = localStorage.getItem('textSize') as TextSize;
    const savedContrast = localStorage.getItem('highContrast') === 'true';
    setTimeout(() => {
      if (savedSize) setTextSize(savedSize);
      if (savedContrast) setHighContrast(savedContrast);
    }, 0);
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    html.classList.remove('text-size-small', 'text-size-medium', 'text-size-large');
    html.classList.add(`text-size-${textSize}`);
    localStorage.setItem('textSize', textSize);
  }, [textSize]);

  useEffect(() => {
    const html = document.documentElement;
    if (highContrast) {
      html.classList.add('high-contrast');
    } else {
      html.classList.remove('high-contrast');
    }
    localStorage.setItem('highContrast', String(highContrast));
  }, [highContrast]);

  return (
    <AccessibilityContext.Provider value={{ textSize, setTextSize, highContrast, setHighContrast }}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const context = useContext(AccessibilityContext);
  if (context === undefined) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
}
