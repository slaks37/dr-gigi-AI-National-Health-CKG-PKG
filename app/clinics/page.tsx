'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useLanguage } from '../../components/LanguageProvider';
import { 
  ArrowLeft, 
  MapPin, 
  Navigation, 
  Star, 
  Phone, 
  Clock, 
  AlertCircle, 
  Search, 
  X, 
  Building2, 
  Stethoscope, 
  Sparkles, 
  CheckCircle2 
} from 'lucide-react';
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
    name: 'Klinik Pratama Sehat Bersama (Dental Care)',
    address: 'Jl. Medan Merdeka Barat No. 12, Gambir, Jakarta Pusat',
    lat: -6.2088,
    lng: 106.8456,
    distance: '1.2 km',
    rating: 4.8,
    reviews: 142,
    open: true,
    openingHoursText: ['Senin - Sabtu: 08.00–20.00', 'Minggu: Tutup'],
    phone: '(021) 384-4052',
    tags: ['Dental Clinic', 'Dental', 'BPJS Kesehatan', 'Spesialis Gigi'],
    isHospital: false,
    isDental: true,
    imageUrl: '/template-clinic-1.svg'
  },
  {
    id: '2',
    name: 'Smile Aesthetic Dental Clinic',
    address: 'Jl. HOS Cokroaminoto No. 85, Menteng, Jakarta Pusat',
    lat: -6.1950,
    lng: 106.8230,
    distance: '2.5 km',
    rating: 4.9,
    reviews: 284,
    open: true,
    openingHoursText: ['Senin - Sabtu: 09.00–21.00', 'Minggu: 10.00–18.00'],
    phone: '+62 811-1067-8899',
    tags: ['Dental Clinic', 'Dental', 'Estetika Gigi', 'Ortodonti'],
    isHospital: false,
    isDental: true,
    imageUrl: '/template-clinic-2.svg'
  },
  {
    id: '3',
    name: 'Rumah Sakit Umum Daerah (RSUD) Tarakan - Poli Gigi',
    address: 'Jl. Kyai Caringin No. 7, Cideng, Gambir, Jakarta Pusat',
    lat: -6.1820,
    lng: 106.8280,
    distance: '3.8 km',
    rating: 4.7,
    reviews: 315,
    open: true,
    openingHoursText: ['Senin - Jumat: 07.30–21.00', 'Sabtu: 08.00–15.00', 'Minggu: UGD 24 Jam'],
    phone: '(021) 350-3003',
    tags: ['Rumah Sakit', 'BPJS', 'Layanan 24 Jam', 'Dental'],
    isHospital: true,
    isDental: true,
    imageUrl: '/template-clinic-3.svg'
  },
  {
    id: '4',
    name: 'Rumah Sakit Khusus Gigi & Mulut (RSGM) Sehat',
    address: 'Jl. Salemba Raya No. 4, Kenari, Senen, Jakarta Pusat',
    lat: -6.1915,
    lng: 106.8512,
    distance: '4.1 km',
    rating: 4.9,
    reviews: 412,
    open: true,
    openingHoursText: ['Senin - Sabtu: 08.00–20.00', 'Minggu: UGD Gigi 24 Jam'],
    phone: '(021) 314-4158',
    tags: ['Rumah Sakit', 'Dental Clinic', 'Dental', 'Rujukan Spesialis'],
    isHospital: true,
    isDental: true,
    imageUrl: '/template-clinic-1.svg'
  },
  {
    id: '5',
    name: 'Dental Specialist Center & Care',
    address: 'Jl. Panglima Polim No. 34, Kebayoran Baru, Jakarta Selatan',
    lat: -6.2420,
    lng: 106.7980,
    distance: '4.9 km',
    rating: 4.8,
    reviews: 198,
    open: true,
    openingHoursText: ['Senin - Sabtu: 09.00–20.00'],
    phone: '+62 812-1999-3003',
    tags: ['Dental', 'Dental Clinic', 'Bedah Mulut'],
    isHospital: false,
    isDental: true,
    imageUrl: '/template-clinic-2.svg'
  }
];

function ClinicsList() {
  const searchParams = useSearchParams();
  const latStr = searchParams.get('lat');
  const lngStr = searchParams.get('lng');
  const initialKeyword = searchParams.get('keyword') || searchParams.get('q') || 'all';

  const userLat = latStr ? parseFloat(latStr) : null;
  const userLng = lngStr ? parseFloat(lngStr) : null;

  const [clinics, setClinics] = useState<any[]>(DEFAULT_MOCK_CLINICS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'both' | 'map' | 'list'>('both');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeKeyword, setActiveKeyword] = useState<string>(initialKeyword);

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

  // Filter clinics based on search query and active keyword
  const filteredClinics = clinics.filter((clinic) => {
    // 1. Keyword pills filter
    if (activeKeyword === 'dental clinic') {
      const inTags = clinic.tags?.some((t: string) => t.toLowerCase().includes('dental clinic'));
      const inName = clinic.name.toLowerCase().includes('dental clinic') || 
        (clinic.name.toLowerCase().includes('klinik') && (clinic.name.toLowerCase().includes('gigi') || clinic.name.toLowerCase().includes('dental')));
      if (!inTags && !inName) return false;
    } else if (activeKeyword === 'dental') {
      const inTags = clinic.tags?.some((t: string) => t.toLowerCase().includes('dental') || t.toLowerCase().includes('gigi'));
      const inName = clinic.name.toLowerCase().includes('dental') || clinic.name.toLowerCase().includes('gigi') || clinic.isDental;
      if (!inTags && !inName) return false;
    } else if (activeKeyword === 'rumah sakit') {
      const inTags = clinic.tags?.some((t: string) => 
        t.toLowerCase().includes('rumah sakit') || 
        t.toLowerCase().includes('hospital') || 
        t.toLowerCase().includes('rsud') || 
        t.toLowerCase().includes('rsia') || 
        t.toLowerCase().includes('rsgm')
      );
      const inName = 
        clinic.name.toLowerCase().includes('rumah sakit') || 
        clinic.name.toLowerCase().includes('rsud') || 
        clinic.name.toLowerCase().includes('rsia') || 
        clinic.name.toLowerCase().includes('rsgm') || 
        clinic.isHospital;
      if (!inTags && !inName) return false;
    } else if (activeKeyword === 'bpjs') {
      const inTags = clinic.tags?.some((t: string) => t.toLowerCase().includes('bpjs'));
      if (!inTags) return false;
    } else if (activeKeyword === 'open') {
      if (!clinic.open) return false;
    }

    // 2. Text input search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const inName = clinic.name.toLowerCase().includes(q);
      const inAddress = clinic.address.toLowerCase().includes(q);
      const inTags = clinic.tags?.some((t: string) => t.toLowerCase().includes(q));
      if (!inName && !inAddress && !inTags) return false;
    }

    return true;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500 gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
        <p className="text-sm font-medium">Mencari lokasi faskes gigi & rumah sakit via OpenStreetMap...</p>
      </div>
    );
  }

  const keywordFilters = [
    { id: 'all', label: 'Semua' },
    { id: 'dental clinic', label: 'Dental Clinic', icon: Sparkles },
    { id: 'dental', label: 'Dental', icon: Stethoscope },
    { id: 'rumah sakit', label: 'Rumah Sakit', icon: Building2 },
    { id: 'bpjs', label: 'BPJS' },
    { id: 'open', label: 'Buka Sekarang' },
  ];

  return (
    <>
      {error && (
        <div className="mb-6 p-4 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl flex items-start gap-3 text-sm">
          <AlertCircle className="shrink-0 mt-0.5" size={18} />
          <div>
            <p className="font-bold mb-1">Informasi:</p>
            <p>{error}</p>
            <p className="mt-1 text-amber-700/80">Menampilkan rekomendasi klinik gigi dan rumah sakit terdaftar.</p>
          </div>
        </div>
      )}

      {/* Search Input Bar */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder='Cari kata kunci: "dental clinic", "dental", "rumah sakit", nama faskes...'
            className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all placeholder:text-slate-400 shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              title="Hapus pencarian"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Keyword Filter Chips */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {keywordFilters.map((kw) => {
          const isActive = activeKeyword === kw.id;
          const Icon = kw.icon;
          return (
            <button
              key={kw.id}
              onClick={() => setActiveKeyword(kw.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all shadow-sm ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-emerald-600/20'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              {Icon && <Icon size={13} className={isActive ? 'text-white' : 'text-emerald-600'} />}
              <span>{kw.label}</span>
              {isActive && <CheckCircle2 size={12} className="ml-0.5 text-emerald-200" />}
            </button>
          );
        })}

        {(activeKeyword !== 'all' || searchQuery.trim() !== '') && (
          <button
            onClick={() => {
              setActiveKeyword('all');
              setSearchQuery('');
            }}
            className="text-xs text-rose-600 hover:text-rose-800 font-semibold px-2 py-1 underline underline-offset-2 ml-auto"
          >
            Reset Filter
          </button>
        )}
      </div>

      {/* View Mode & Map/List Controls */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          {filteredClinics.length} Faskes Ditemukan
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
            clinics={filteredClinics}
            selectedClinicId={selectedClinicId}
            onSelectClinic={(id) => setSelectedClinicId(id)}
          />
        </div>
      )}

      {/* Zero Results Feedback */}
      {filteredClinics.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500 my-6 shadow-sm">
          <AlertCircle className="mx-auto mb-2 text-slate-400" size={32} />
          <h4 className="font-bold text-slate-800 mb-1">Fasilitas Tidak Ditemukan</h4>
          <p className="text-sm text-slate-500 mb-4">
            Tidak ada klinik gigi atau rumah sakit yang cocok dengan kata kunci &quot;
            {searchQuery || activeKeyword}&quot;.
          </p>
          <button
            onClick={() => {
              setActiveKeyword('all');
              setSearchQuery('');
            }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            Tampilkan Semua Klinik & Rumah Sakit
          </button>
        </div>
      )}

      {/* Clinics Card List */}
      {(viewMode === 'both' || viewMode === 'list') && filteredClinics.length > 0 && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {filteredClinics.map((clinic) => {
            const isSelected = selectedClinicId === clinic.id;
            const isHospital = clinic.isHospital || clinic.tags?.includes('Rumah Sakit') || clinic.name.toLowerCase().includes('rumah sakit');

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
                  {isHospital && (
                    <div className="absolute top-3 left-3 bg-indigo-600 text-white px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm flex items-center gap-1">
                      <Building2 size={11} />
                      Rumah Sakit
                    </div>
                  )}
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
                      {clinic.tags?.map((tag: string) => {
                        let badgeStyle = 'bg-slate-100 text-slate-600';
                        if (tag.toLowerCase().includes('dental clinic')) {
                          badgeStyle = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
                        } else if (tag.toLowerCase() === 'dental') {
                          badgeStyle = 'bg-cyan-50 text-cyan-700 border border-cyan-200';
                        } else if (tag.toLowerCase().includes('rumah sakit')) {
                          badgeStyle = 'bg-indigo-50 text-indigo-700 border border-indigo-200';
                        } else if (tag.toLowerCase().includes('bpjs')) {
                          badgeStyle = 'bg-green-50 text-green-700 border border-green-200';
                        }

                        return (
                          <span 
                            key={tag} 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (tag.toLowerCase().includes('dental clinic')) setActiveKeyword('dental clinic');
                              else if (tag.toLowerCase() === 'dental') setActiveKeyword('dental');
                              else if (tag.toLowerCase().includes('rumah sakit')) setActiveKeyword('rumah sakit');
                              else if (tag.toLowerCase().includes('bpjs')) setActiveKeyword('bpjs');
                            }}
                            className={`px-2 py-0.5 text-xs rounded-md font-medium cursor-pointer hover:opacity-80 transition-opacity ${badgeStyle}`}
                          >
                            {tag}
                          </span>
                        );
                      })}
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
            <MapPin className="text-emerald-600" /> Cari Klinik & Rumah Sakit
          </h1>
          <div className="flex items-center gap-4">
            <LoginButton />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-800">Cari Faskes Gigi & Rumah Sakit</h2>
          <p className="text-slate-500 text-sm mt-1 flex items-center gap-1.5">
            <Navigation size={14} className="text-indigo-500" />
            Cari berdasarkan kata kunci &ldquo;dental clinic&rdquo;, &ldquo;dental&rdquo;, dan &ldquo;rumah sakit&rdquo; terdekat
          </p>
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
