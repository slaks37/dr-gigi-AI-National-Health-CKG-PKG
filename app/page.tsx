'use client';

import Link from 'next/link';
import { Stethoscope, MessageSquareText, ShieldCheck, Activity, Settings, Type, Contrast, Globe, Smile, MapPin, Navigation } from 'lucide-react';
import { useAccessibility } from '../components/AccessibilityProvider';
import { useLanguage } from '../components/LanguageProvider';
import { useState, useEffect } from 'react';

import LoginButton from '../components/LoginButton';

export default function Home() {
  const { textSize, setTextSize, highContrast, setHighContrast } = useAccessibility();
  const { language, setLanguage, t } = useLanguage();
  const [showSettings, setShowSettings] = useState(false);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);

  const requestLocation = () => {
    setLocationStatus('loading');
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      try {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude
            });
            setLocationStatus('success');
          },
          (error) => {
            // Geolocation permissions inside iframes or denied by user
            console.warn("Location not accessible in current environment:", error?.message || 'Access denied or unavailable');
            setLocationStatus('error');
          },
          {
            enableHighAccuracy: false,
            timeout: 8000,
            maximumAge: 60000
          }
        );
      } catch (err) {
        console.warn("Geolocation exception:", err);
        setLocationStatus('error');
      }
    } else {
      setLocationStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Header */}
      <header className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-slate-200 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white">
              <Smile size={20} />
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-800">{t('common.appName')}</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/sonri" className="text-sm font-semibold text-emerald-700">Ruang SONRI</Link><LoginButton />
            <button onClick={() => setShowSettings(!showSettings)} className="p-2 rounded-full hover:bg-slate-100 transition-colors">
              <Settings size={20} />
            </button>
            {showSettings && (
              <div className="absolute top-16 right-4 bg-white p-4 rounded-xl shadow-lg border border-slate-200 z-50 w-64">
                <h3 className="font-bold mb-4">{t('common.accessibility')} & {t('common.language')}</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Globe size={16} />
                      <span>{t('common.language')}</span>
                    </div>
                    <select value={language} onChange={(e) => setLanguage(e.target.value as any)} className="border rounded p-1 text-sm bg-slate-50">
                      <option value="id">Indonesia</option>
                      <option value="en">English</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Type size={16} />
                      <span>Ukuran Font</span>
                    </div>
                    <select value={textSize} onChange={(e) => setTextSize(e.target.value as any)} className="border rounded p-1 text-sm bg-slate-50">
                      <option value="small">{t('common.small')}</option>
                      <option value="medium">{t('common.medium')}</option>
                      <option value="large">{t('common.large')}</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Contrast size={16} />
                      <span>Kontras</span>
                    </div>
                    <button onClick={() => setHighContrast(!highContrast)} className={`px-2 py-1 rounded text-sm ${highContrast ? 'bg-emerald-600 text-white' : 'bg-slate-200'}`}>
                      {t('common.highContrast')}
                    </button>
                  </div>
                  <div className="pt-2 border-t border-slate-100">
                    <Link
                      href="/settings"
                      onClick={() => setShowSettings(false)}
                      className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
                    >
                      <Settings size={14} />
                      <span>Buka Pusat Pengaturan & Integrasi</span>
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="pt-32 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div>
            <span className="inline-block py-1 px-3 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold tracking-wide uppercase mb-4">
              {t('home.subtitle')}
            </span>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-slate-900 tracking-tight mb-6 leading-tight">
              {t('home.title1')} <br className="hidden sm:block" />
              <span className="text-emerald-600">{t('home.title2')}</span>
            </h1>
            <p className="text-lg text-slate-600 mb-8 leading-relaxed">
              {t('home.description')}
            </p>
          </div>

          {/* Quick Find Nearest Clinic Banner */}
          <div className="bg-emerald-50 rounded-2xl p-6 mb-10 border border-emerald-100 flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative">
            <div className="absolute -right-6 -top-6 text-emerald-200/50 rotate-12 pointer-events-none">
              <MapPin size={120} />
            </div>
            
            <div className="text-left relative z-10 flex-1">
              <h2 className="text-xl md:text-2xl font-bold text-emerald-900 flex items-center gap-2 mb-2">
                <MapPin className="text-emerald-500" size={24} /> 
                Cari Dental Clinic, Dental & Rumah Sakit Terdekat
              </h2>
              <p className="text-emerald-700/80 mb-0">
                Temukan rekomendasi dental clinic, dokter gigi dental care, dan rumah sakit terdekat di sekitar Anda.
              </p>
            </div>
            
            <div className="relative z-10 w-full md:w-auto">
              {locationStatus === 'idle' && (
                <button 
                  onClick={requestLocation}
                  className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <Navigation size={18} />
                  Akses Lokasi Saya
                </button>
              )}
              {locationStatus === 'loading' && (
                <button 
                  disabled
                  className="w-full md:w-auto bg-emerald-200 text-emerald-800 px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2"
                >
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-800"></div>
                  Mencari Lokasi...
                </button>
              )}
              {locationStatus === 'success' && location && (
                <Link 
                  href={`/clinics?lat=${location.lat}&lng=${location.lng}`}
                  className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-md flex items-center justify-center gap-2"
                >
                  Lihat Faskes Terdekat &rarr;
                </Link>
              )}
              {locationStatus === 'error' && (
                <div className="flex flex-col items-center gap-2 border border-rose-200 bg-rose-50 p-3 rounded-xl text-rose-600 text-sm">
                  <span>Gagal mengakses lokasi.</span>
                  <Link href="/clinics" className="font-bold underline hover:text-rose-800">Cari Manual Saja</Link>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 justify-center max-w-4xl mx-auto">
            <Link href="/checkup" className="group relative inline-flex items-center justify-center px-8 py-4 text-base font-medium text-white bg-emerald-600 rounded-xl shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-all hover:-translate-y-1">
              <Stethoscope className="mr-2 h-5 w-5" />
              {t('home.checkup')}
            </Link>
            <Link href="/checkup-anak" className="group relative inline-flex items-center justify-center px-8 py-4 text-base font-medium text-slate-700 bg-white border border-slate-200 rounded-xl shadow-sm hover:bg-slate-50 hover:border-emerald-200 transition-all hover:-translate-y-1">
              <Activity className="mr-2 h-5 w-5 text-emerald-600" />
              {t('home.checkupAnak')}
            </Link>
            <Link href="/consultation" className="group relative inline-flex items-center justify-center px-8 py-4 text-base font-medium text-slate-700 bg-white border border-slate-200 rounded-xl shadow-sm hover:bg-slate-50 hover:border-emerald-200 transition-all hover:-translate-y-1">
              <MessageSquareText className="mr-2 h-5 w-5 text-emerald-600" />
              {t('home.consultation')}
            </Link>
            <Link href="/antropometri" className="group relative inline-flex items-center justify-center px-8 py-4 text-base font-medium text-slate-700 bg-white border border-slate-200 rounded-xl shadow-sm hover:bg-slate-50 hover:border-emerald-200 transition-all hover:-translate-y-1">
              <ShieldCheck className="mr-2 h-5 w-5 text-emerald-600" />
              {t('home.antropometri')}
            </Link>
          </div>
          <div className="mt-6">
            <Link href="/dashboard" className="text-sm font-medium text-slate-500 hover:text-emerald-600 transition-colors flex items-center justify-center gap-1">
               {t('common.viewDashboard')} <Activity size={14} />
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mt-20" id="features">
          <FeatureCard
            icon={<ShieldCheck className="w-6 h-6 text-emerald-600" />}
            title={t('home.feature1Title')}
            description={t('home.feature1Desc')}
          />
          <FeatureCard
            icon={<Activity className="w-6 h-6 text-emerald-600" />}
            title={t('home.feature2Title')}
            description={t('home.feature2Desc')}
          />
          <FeatureCard
            icon={<MessageSquareText className="w-6 h-6 text-emerald-600" />}
            title={t('home.feature3Title')}
            description={t('home.feature3Desc')}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-12 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-slate-500 text-sm">
          <p>&copy; {new Date().getFullYear()} {t('common.appName')}. All rights reserved.</p>
          <p className="mt-2 text-xs text-slate-400">
            {t('checkup.disclaimer')}
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
      <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mb-6">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
      <p className="text-slate-600 leading-relaxed">{description}</p>
    </div>
  );
}
