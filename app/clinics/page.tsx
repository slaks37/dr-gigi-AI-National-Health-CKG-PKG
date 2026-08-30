'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useLanguage } from '../../components/LanguageProvider';
import { ArrowLeft, MapPin, Navigation, Star, Phone, Clock, AlertCircle, Map as MapIcon, List } from 'lucide-react';
import LoginButton from '../../components/LoginButton';
import { getNearbyClinics } from '../actions/get-clinics';

const ClinicMap = dynamic(() => import('../../components/ClinicMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[360px] w-full bg-slate-100 rounded-2xl animate-pulse flex items-center justify-center text-slate-400 font-medium text-sm">
      Memuat Peta OpenStreetMap...
    </div>
  )
});

const DEFAULT_MOCK_CLINICS = [
  {
    id: '1',
    name: 'Klinik Pratama Sehat Bersama',
    address: 'Jl. Medan Merdeka Barat No. 12, Gambir, Jakarta Pusat',
    lat: -6.2088,
    lng: 106.8456,
    distance: '1.2 km',
    rating: 4.8,
    reviews: 142,
    open: true,
    openingHoursText: ['Senin: 08.00–20.00', 'Selasa: 08.00–20.00', 'Rabu: 08.00–20.00', 'Kamis: 08.00–20.00', 'Jumat: 08.00–20.00', 'Sabtu: 08.00–14.00', 'Minggu: Tutup'],
    phone: '(021) 384-4052',
    tags: ['BPJS Kesehatan', 'Spesialis Anak & Dewasa', 'Antropometri'],
    imageUrl: '/template-clinic-1.svg'
  },
  {
    id: '2',
    name: 'Klinik Kimia Farma Diagnostika Menteng',
    address: 'Jl. HOS Cokroaminoto No. 85, Menteng, Jakarta Pusat',
    lat: -6.1950,
    lng: 106.8230,
    distance: '2.5 km',
    rating: 4.9,
    reviews: 328,
    open: true,
    openingHoursText: ['Senin: 08.00–21.00', 'Selasa: 08.00–21.00', 'Rabu: 08.00–21.00', 'Kamis: 08.00–21.00', 'Jumat: 08.00–21.00', 'Sabtu: 08.00–21.00', 'Minggu: 08.00–16.00'],
    phone: '(021) 314-4158',
    tags: ['Laboratorium Medis', 'Faskes Tingkat 1', 'Skrining Postur'],
    imageUrl: '/template-clinic-2.svg'
  },
  {
    id: '3',
    name: 'Poliklinik Rawat Jalan Terpadu RSUD Tarakan',
    address: 'Jl. Kyai Caringin No. 7, Cideng, Gambir, Jakarta Pusat',
    lat: -6.1820,
    lng: 106.8280,
    distance: '3.8 km',
    rating: 4.7,
    reviews: 215,
    open: true,
    openingHoursText: ['Senin: 07.30–21.00', 'Selasa: 07.30–21.00', 'Rabu: 07.30–21.00', 'Kamis: 07.30–21.00', 'Jumat: 07.30–21.00', 'Sabtu: 08.00–15.00', 'Minggu: UGD 24 Jam'],
    phone: '(021) 350-3003',
    tags: ['Rujukan SATUSEHAT', 'Fisioterapi Spina', 'Layanan 24 Jam'],
    imageUrl: '/template-clinic-3.svg'
  }
];

function ClinicsList() {
  const searchParams = useSearchParams();
  const latStr = searchParams.get('lat');
  const lngStr = searchParams.get('lng');

  const userLat = latStr ? parseFloat(latStr) : null;
  const userLng = lngStr ? parseFloat(lngStr) : null;

  const [clinics, setClinics] = useState<any[]>(DEFAULT_MOCK_CLINICS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'both' | 'map' | 'list'>('both');

  useEffect(() => {
    async function fetchClinics() {
      if (userLat && userLng) {
        setLoading(true);
        const res = await getNearbyClinics(userLat, userLng);
        if (res.success && res.clinics && res.clinics.length > 0) {
          setClinics(res.clinics);
        } else if (res.error) {
          setError(res.error);
        }
        setLoading(false);
      } else {
        setLoading(false);
      }
    }

    fetchClinics();
  }, [userLat, userLng]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500 gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
        <p className="text-sm font-medium">Mencari lokasi klinik gigi via OpenStreetMap...</p>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="mb-6 p-4 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl flex items-start gap-3 text-sm">
          <AlertCircle className="shrink-0 mt-0.5" size={18} />
          <div>
            <p className="font-bold mb-1">Informasi:</p>
            <p>{error}</p>
            <p className="mt-1 text-amber-700/80">Menampilkan daftar rekomendasi klinik standar.</p>
          </div>
        </div>
      )}

      {/* Map + List Toggle Controls for Mobile */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          Data Peta: OpenStreetMap (Bebas Biaya API Key)
        </span>

        <div className="flex bg-slate-200 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setViewMode('both')}
            className={`px-2.5 py-1 rounded-lg transition-colors ${viewMode === 'both' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600'}`}
          >
            Semua
          </button>
          <button
            onClick={() => setViewMode('map')}
            className={`px-2.5 py-1 rounded-lg transition-colors ${viewMode === 'map' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600'}`}
          >
            Peta
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-2.5 py-1 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600'}`}
          >
            Daftar
          </button>
        </div>
      </div>

      {/* Interactive Leaflet Map */}
      {(viewMode === 'both' || viewMode === 'map') && (
        <div className="mb-6">
          <ClinicMap
            userLat={userLat}
            userLng={userLng}
            clinics={clinics}
            selectedClinicId={selectedClinicId}
            onSelectClinic={(id) => setSelectedClinicId(id)}
          />
        </div>
      )}

      {/* Clinics Card List */}
      {(viewMode === 'both' || viewMode === 'list') && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {clinics.map((clinic) => {
            const isSelected = selectedClinicId === clinic.id;
            return (
              <div
                key={clinic.id}
                onClick={() => setSelectedClinicId(clinic.id)}
                className={`bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col sm:flex-row hover:shadow-md transition-all cursor-pointer group ${
                  isSelected ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200'
                }`}
              >
                <div className="sm:w-48 h-48 sm:h-auto bg-slate-100 flex-none relative">
                  <Image
                    src={clinic.imageUrl || '/template-clinic-1.svg'}
                    alt={clinic.name}
                    fill
                    referrerPolicy="no-referrer"
                    className="object-cover"
                    unoptimized
                    onError={(e: any) => {
                      e.currentTarget.src = '/template-clinic-1.svg';
                    }}
                  />
                  <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full text-xs font-bold text-slate-800 shadow-sm flex items-center gap-1">
                    {clinic.distance || '~ km'}
                  </div>
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <h3 className="font-bold text-lg text-slate-800 group-hover:text-emerald-700 transition-colors">
                        {clinic.name}
                      </h3>
                      {clinic.open !== null && (
                        <div
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                            clinic.open ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {clinic.open ? 'Buka' : 'Tutup'}
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 flex items-start gap-1.5 mb-2">
                      <MapPin size={16} className="text-slate-400 flex-none mt-0.5" />
                      <span>{clinic.address}</span>
                    </p>
                    <div className="text-sm text-slate-500 flex items-start gap-1.5 mb-2">
                      <Clock size={16} className="text-slate-400 flex-none mt-0.5" />
                      <span>
                        {clinic.openingHoursText && clinic.openingHoursText.length > 0
                          ? (() => {
                              const dayIndex = new Date().getDay();
                              const arrayIndex = dayIndex === 0 ? 6 : dayIndex - 1;
                              return clinic.openingHoursText[arrayIndex] || clinic.openingHoursText[0];
                            })()
                          : 'Hubungi klinik untuk jadwal'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 flex items-center gap-1.5 mb-3">
                      <Phone size={14} className="text-slate-400" />
                      {clinic.phone !== '-' && clinic.phone ? (
                        <a
                          href={`tel:${clinic.phone.replace(/[^0-9+]/g, '')}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-emerald-600 hover:text-emerald-800 font-medium underline-offset-4 hover:underline transition-colors shrink-0"
                        >
                          {clinic.phone}
                        </a>
                      ) : (
                        <span>Belum ada no telepon</span>
                      )}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {clinic.tags?.map((tag: string) => (
                        <span key={tag} className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-md font-medium">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-auto">
                    <div className="flex items-center gap-1">
                      <Star size={16} className="text-amber-500 fill-amber-500" />
                      <span className="font-bold text-slate-800">{clinic.rating}</span>
                      <span className="text-xs text-slate-400">({clinic.reviews})</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {clinic.lat && clinic.lng && (
                        <a
                          href={`https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${
                            userLat || ''
                          }%2C${userLng || ''}%3B${clinic.lat}%2C${clinic.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1"
                        >
                          <Navigation size={13} /> Rute OSM
                        </a>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          alert(`Menghubungi ${clinic.name} untuk pendaftaran janji temu.`);
                        }}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm active:scale-95"
                      >
                        Buat Janji
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

export default function ClinicsPage() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-slate-600 hover:text-emerald-600 transition-colors">
            <ArrowLeft size={20} />
            <span className="font-bold hidden sm:inline">Kembali</span>
          </Link>
          <h1 className="font-bold text-lg text-slate-800 flex items-center gap-2">
            <MapPin className="text-emerald-600" /> Klinik Terdekat (OpenStreetMap)
          </h1>
          <div className="flex items-center gap-4">
            <LoginButton />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Rekomendasi Klinik Gigi</h2>
            <p className="text-slate-500 text-sm mt-1 flex items-center gap-1.5">
              <Navigation size={14} className="text-indigo-500" />
              Menampilkan pencarian klinik terdekat berbasis OpenStreetMap (OSM)
            </p>
          </div>

          <div className="flex gap-2 text-sm flex-wrap">
            <button className="px-3 py-1.5 bg-white border border-slate-200 shadow-sm rounded-full font-medium hover:bg-slate-50 transition-colors text-slate-700">
              BPJS
            </button>
            <button className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 shadow-sm rounded-full font-medium transition-colors">
              Buka Sekarang
            </button>
            <button className="px-3 py-1.5 bg-white border border-slate-200 shadow-sm rounded-full font-medium hover:bg-slate-50 transition-colors text-slate-700 flex items-center gap-1">
              Rating &gt; 4.5 <Star size={12} className="text-amber-500 fill-amber-500" />
            </button>
          </div>
        </div>

        <Suspense
          fallback={
            <div className="flex justify-center p-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
            </div>
          }
        >
          <ClinicsList />
        </Suspense>
      </main>
    </div>
  );
}
