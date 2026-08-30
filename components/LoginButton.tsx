'use client';

import { useAuth } from './AuthProvider';
import { LogIn, LogOut, User as UserIcon } from 'lucide-react';

export default function LoginButton() {
  const { user, loading, signIn, signOut } = useAuth();

  if (loading) {
    return <div className="animate-pulse w-8 h-8 bg-slate-200 rounded-full"></div>;
  }

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex flex-col items-end">
          <span className="text-sm font-medium text-slate-700">{user.displayName || 'User'}</span>
          <span className="text-xs text-slate-500">{user.email}</span>
        </div>
        <button 
          onClick={signOut}
          className="p-2 rounded-full hover:bg-slate-100 transition-colors text-slate-600 flex items-center justify-center"
          title="Sign Out"
        >
          <LogOut size={20} />
        </button>
      </div>
    );
  }

  return (
    <button 
      onClick={signIn}
      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors text-sm font-medium shadow-sm hover:-translate-y-0.5"
    >
      <LogIn size={16} />
      <span>Login</span>
    </button>
  );
}
