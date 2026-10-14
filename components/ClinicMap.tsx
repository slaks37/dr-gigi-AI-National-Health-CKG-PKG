'use client';

import { useEffect, useRef } from 'react';

const escapeHtml = (value: string) => value.replace(/[&<>\"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] || ch));

interface Clinic {
  id: string;
  name: string;
  address: string;
  lat?: number;
  lng?: number;
  distance?: string;
  rating?: number | string | null;
  phone?: string;
}

interface ClinicMapProps {
  userLat?: number | null;
  userLng?: number | null;
  clinics: Clinic[];
  selectedClinicId?: string | null;
  onSelectClinic?: (id: string) => void;
}

export default function ClinicMap({ userLat, userLng, clinics, selectedClinicId, onSelectClinic }: ClinicMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    // Load Leaflet CSS dynamically if not present
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    let isMounted = true;

    import('leaflet').then((L) => {
      if (!isMounted || !mapRef.current) return;

      const centerLat = userLat || -6.2088;
      const centerLng = userLng || 106.8456;

      // Fix Leaflet default icon URL resolution issue in Next.js build
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      if (!mapInstanceRef.current) {
        const map = L.map(mapRef.current).setView([centerLat, centerLng], 13);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        mapInstanceRef.current = map;
      } else {
        mapInstanceRef.current.setView([centerLat, centerLng], 13);
      }

      const map = mapInstanceRef.current;

      // Clear previous markers
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];

      const bounds = L.latLngBounds([]);

      // Add user location marker
      if (userLat && userLng) {
        const userIcon = L.divIcon({
          className: 'custom-user-marker',
          html: `<div style="background-color: #2563eb; width: 18px; height: 18px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(37,99,235,0.6);"></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9]
        });

        const userMarker = L.marker([userLat, userLng], { icon: userIcon })
          .addTo(map)
          .bindPopup('<b>📍 Lokasi Anda Saat Ini</b>');
        
        markersRef.current.push(userMarker);
        bounds.extend([userLat, userLng]);
      }

      // Add markers for clinics
      clinics.forEach((clinic) => {
        if (!clinic.lat || !clinic.lng) return;

        const isSelected = selectedClinicId === clinic.id;

        const clinicIcon = L.divIcon({
          className: 'custom-clinic-marker',
          html: `<div style="background-color: ${isSelected ? '#047857' : '#059669'}; color: white; padding: 5px 9px; border-radius: 16px; font-weight: bold; font-size: 11px; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); display: flex; align-items: center; gap: 4px; white-space: nowrap;">
            <span>🦷</span> <span>${escapeHtml(clinic.name.slice(0, 16))}${clinic.name.length > 16 ? '...' : ''}</span>
          </div>`,
          iconAnchor: [30, 15]
        });

        const marker = L.marker([clinic.lat, clinic.lng], { icon: clinicIcon }).addTo(map);

        const popupContent = `
          <div style="font-family: sans-serif; padding: 2px; max-width: 220px;">
            <h4 style="margin: 0 0 4px 0; font-weight: bold; color: #0f172a; font-size: 13px;">${escapeHtml(clinic.name)}</h4>
            <p style="margin: 0 0 6px 0; color: #64748b; font-size: 11px;">${escapeHtml(clinic.address)}</p>
            ${clinic.distance ? `<p style="margin: 0 0 6px 0; color: #059669; font-weight: bold; font-size: 11px;">📍 ${escapeHtml(clinic.distance)}</p>` : ''}
            <a href="https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${userLat || ''}%2C${userLng || ''}%3B${clinic.lat}%2C${clinic.lng}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #059669; color: white; text-decoration: none; padding: 4px 8px; border-radius: 6px; font-size: 10px; font-weight: bold;">
              🗺️ Rute OpenStreetMap
            </a>
          </div>
        `;

        marker.bindPopup(popupContent);

        marker.on('click', () => {
          if (onSelectClinic) onSelectClinic(clinic.id);
        });

        markersRef.current.push(marker);
        bounds.extend([clinic.lat, clinic.lng]);
      });

      if (clinics.length > 0 && bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40] });
      }
    });

    return () => {
      isMounted = false;
    };
  }, [userLat, userLng, clinics, selectedClinicId, onSelectClinic]);

  return (
    <div className="relative w-full h-full min-h-[360px] rounded-2xl overflow-hidden border border-slate-200 shadow-sm z-0">
      <div ref={mapRef} className="w-full h-full min-h-[360px]" />
      <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 shadow-sm z-[400] flex items-center gap-1.5 border border-slate-200">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
        Peta OpenStreetMap (Gratis)
      </div>
    </div>
  );
}
