'use client';
import { AccessibilityProvider } from './AccessibilityProvider';
import { LanguageProvider } from './LanguageProvider';
import { AuthProvider } from './AuthProvider';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <LanguageProvider>
        <AccessibilityProvider>
          {children}
        </AccessibilityProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}
