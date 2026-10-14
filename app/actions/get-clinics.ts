'use server';

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function getNearbyClinics(lat: number, lng: number, keyword?: string) {
  try {
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new Error('Invalid coordinates');
    // Query OpenStreetMap via Overpass API for dental clinics, dental specialists, and hospitals (rumah sakit) nearby
    const overpassUrl = 'https://overpass-api.de/api/interpreter';
    const overpassQuery = `
      [out:json][timeout:12];
      (
        node["amenity"="dentist"](around:6000, ${lat}, ${lng});
        way["amenity"="dentist"](around:6000, ${lat}, ${lng});
        node["healthcare"="dentist"](around:6000, ${lat}, ${lng});
        way["healthcare"="dentist"](around:6000, ${lat}, ${lng});
        node["amenity"="clinic"]["healthcare:speciality"="dentistry"](around:6000, ${lat}, ${lng});
        way["amenity"="clinic"]["healthcare:speciality"="dentistry"](around:6000, ${lat}, ${lng});
        node["amenity"="clinic"]["name"~"dental|gigi|dental clinic",i](around:6000, ${lat}, ${lng});
        way["amenity"="clinic"]["name"~"dental|gigi|dental clinic",i](around:6000, ${lat}, ${lng});
        node["amenity"="hospital"](around:6000, ${lat}, ${lng});
        way["amenity"="hospital"](around:6000, ${lat}, ${lng});
        node["healthcare"="hospital"](around:6000, ${lat}, ${lng});
        way["healthcare"="hospital"](around:6000, ${lat}, ${lng});
        node["name"~"dental clinic|dental|rumah sakit|rsud|rsia|rsgm",i](around:6000, ${lat}, ${lng});
        way["name"~"dental clinic|dental|rumah sakit|rsud|rsia|rsgm",i](around:6000, ${lat}, ${lng});
      );
      out center 30;
    `;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    let osmPlaces: any[] = [];
    try {
      const response = await fetch(overpassUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(overpassQuery)}`,
        signal: controller.signal,
        cache: 'no-store'
      });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error('Facility provider unavailable');
      if (response.ok) {
        const data = await response.json();
        osmPlaces = data.elements || [];
      }
    } catch {
      clearTimeout(timeoutId);
      return { success: false, error: 'Pencarian fasilitas tidak tersedia. Coba lagi.', clinics: [] };
    }

    let clinics: any[] = [];

    if (osmPlaces.length > 0) {
      clinics = osmPlaces.filter((el: any) => Number.isFinite(el.lat ?? el.center?.lat) && Number.isFinite(el.lon ?? el.center?.lon)).map((el: any, idx: number) => {
        const itemLat = el.lat ?? el.center?.lat;
        const itemLng = el.lon ?? el.center?.lon;
        const distNum = calculateDistance(lat, lng, itemLat, itemLng);
        
        const tags = el.tags || {};
        const name = tags.name || tags['name:id'] || tags['name:en'] || 'Klinik / Faskes Terdaftar (OSM)';
        const street = tags['addr:street'] ? `${tags['addr:street']} ${tags['addr:housenumber'] || ''}` : '';
        const city = tags['addr:city'] || tags['addr:subdistrict'] || '';
        const address = [street, city].filter(Boolean).join(', ') || tags['addr:full'] || 'Lokasi terdaftar di OpenStreetMap';
        
        const phone = tags.phone || tags['contact:phone'] || '';
        const openingHours = tags.opening_hours ? [tags.opening_hours] : ['Belum diketahui'];

        // Dynamically assign tags based on keywords: "Dental Clinic", "Dental", "Rumah Sakit"
        const lowerName = name.toLowerCase();
        const detectedTags: string[] = [];

        const isHospital = 
          tags.amenity === 'hospital' || 
          tags.healthcare === 'hospital' || 
          lowerName.includes('rumah sakit') || 
          lowerName.includes('rsud') || 
          lowerName.includes('rsia') || 
          lowerName.includes('rsgm') ||
          lowerName.includes('hospital');

        const isDentalClinic = 
          lowerName.includes('dental clinic') || 
          (tags.amenity === 'clinic' && (lowerName.includes('gigi') || lowerName.includes('dental'))) ||
          tags['healthcare:speciality'] === 'dentistry';

        const isDental = 
          tags.amenity === 'dentist' || 
          tags.healthcare === 'dentist' || 
          lowerName.includes('dental') || 
          lowerName.includes('gigi') ||
          lowerName.includes('dentist');

        if (isHospital) {
          detectedTags.push('Rumah Sakit');
        }
        if (isDentalClinic) {
          detectedTags.push('Dental Clinic');
        }
        if (isDental) {
          detectedTags.push('Dental');
        }

        if (detectedTags.length === 0) {
          detectedTags.push('Faskes Terdaftar', 'Klinik Pratama');
        }


        return {
          id: `osm-${el.type}-${el.id}`,
          sourceUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
          name,
          address,
          lat: itemLat,
          lng: itemLng,
          distanceNum: distNum,
          distance: `${distNum.toFixed(1)} km`,
          rating: null,
          reviews: null,
          open: null,
          openingHoursText: openingHours,
          phone,
          tags: Array.from(new Set(detectedTags)),
          isHospital,
          isDental: isDental || isDentalClinic,
          imageUrl: `/template-clinic-${(idx % 3) + 1}.svg`
        };
      });

      // Sort by distance
      clinics.sort((a, b) => a.distanceNum - b.distanceNum);
    }

    // Apply keyword filter if requested
    if (keyword && keyword.trim()) {
      const q = keyword.trim().toLowerCase();
      clinics = clinics.filter((c) => {
        const inName = c.name.toLowerCase().includes(q);
        const inTags = c.tags?.some((t: string) => t.toLowerCase().includes(q));
        const inAddress = c.address.toLowerCase().includes(q);
        return inName || inTags || inAddress;
      });
    }

    return {
      success: true,
      provider: 'OpenStreetMap (OSM)',
      clinics
    };
  } catch (error) {
    console.error('Error fetching clinics from OSM:', error);
    return {
      success: false,
      error: "Gagal mengambil data lokasi dari OpenStreetMap.",
      clinics: []
    };
  }
}
