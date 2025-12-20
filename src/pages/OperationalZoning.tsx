import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Search, Layers, Plus, Minus, Share2, Download, FileImage, X, Mail, MessageSquare, Wind, Thermometer, Droplets } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents, ScaleControl } from 'react-leaflet';
import axios from 'axios';
import L from 'leaflet';
// Heavy libs are loaded on demand
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import 'leaflet/dist/leaflet.css';

const getCardinalDirection = (degrees: number): string => {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
};

// La clé API météo est maintenant gérée via les variables d'environnement

// Custom red marker icon for incidents
const redMarkerIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  className: 'incident-marker'
});

// Map layer URLs (use CORS-friendly providers)
const MAP_LAYERS = {
  street: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  // Use Carto Voyager tiles (CORS-enabled). Replace with MapTiler/Mapbox if you have keys
  satellite: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
  hybrid: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}.png'
};

// Component to handle map location updates
const MapUpdater: React.FC<{ center: [number, number] }> = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 16);

    const northArrow = L.control({ position: 'topright' });

    northArrow.onAdd = function () {
      const div = L.DomUtil.create('div', 'north-arrow-container');
      div.innerHTML = `
        <div class="north-arrow">
          <div class="north-arrow-icon">⬆</div>
          <div class="north-arrow-text">N</div>
        </div>
      `;
      return div;
    };

    northArrow.addTo(map);

    return () => {
      map.removeControl(northArrow);
    };
  }, [center, map]);
  return null;
};

// Component to handle map clicks
const MapClickHandler: React.FC<{ onMapClick: (latlng: L.LatLng) => void }> = ({ onMapClick }) => {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng);
    },
  });
  return null;
};

// ShareDialog component
interface WeatherData {
  temperature: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
}

const ShareDialog: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  mapRef: React.RefObject<HTMLDivElement>;
  address: string;
  zones: {
    exclusion: number;
    controlled: number;
    support: number;
  };
}> = ({ isOpen, onClose, mapRef, address, zones }) => {
  const handleShare = (method: 'email' | 'sms' | 'whatsapp') => {
    const subject = `Zonage opérationnel - ${format(new Date(), 'Pp', { locale: fr })}`;
    const body = `Zonage opérationnel\n\nDate: ${format(new Date(), 'Pp', { locale: fr })}\nAdresse: ${address}\n\nZones:\n- Zone d'exclusion: ${zones.exclusion}m\n- Zone contrôlée: ${zones.controlled}m\n- Zone de soutien: ${zones.support}m`;

    switch (method) {
      case 'email':
        window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        break;
      case 'sms':
        window.location.href = `sms:?body=${encodeURIComponent(body)}`;
        break;
      case 'whatsapp':
        window.location.href = `https://wa.me/?text=${encodeURIComponent(body)}`;
        break;
    }
    onClose();
  };

  const generateFileName = () => {
    const date = format(new Date(), 'dd-MM-yy', { locale: fr });
    const sanitizedAddress = address
      .replace(/[^a-z0-9]/gi, '_')
      .replace(/_+/g, '_')
      .substring(0, 30);
    return `${date}_${sanitizedAddress}`;
  };

  const captureMap = async () => {
    if (!mapRef.current) return null;
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(mapRef.current, {
      useCORS: true,
      allowTaint: true,
      backgroundColor: null,
    });
    return canvas;
  };

  const handleImageExport = async () => {
    try {
      const canvas = await captureMap();
      if (!canvas) return;

      canvas.toBlob((blob) => {
        if (!blob) return;
        const fileName = `${generateFileName()}.png`;
        const file = new File([blob], fileName, { type: 'image/png' });

        // Create download link
        const link = document.createElement('a');
        link.href = URL.createObjectURL(file);
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
      }, 'image/png');
    } catch (error) {
      console.error('Error exporting image:', error);
      alert('Une erreur est survenue lors de l\'export de l\'image');
    }
  };

  const handlePDFExport = async () => {
    try {
      const canvas = await captureMap();
      if (!canvas) return;

      const imgData = canvas.toDataURL('image/png');
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      // Add title and date
      pdf.setFontSize(16);
      pdf.text('Zonage opérationnel', 14, 15);
      pdf.setFontSize(12);
      pdf.text(`Date: ${format(new Date(), 'Pp', { locale: fr })}`, 14, 25);
      pdf.text(`Adresse: ${address}`, 14, 32);

      // Add legend
      const legendY = 45;
      pdf.setFontSize(10);
      pdf.setDrawColor(255, 24, 1);
      pdf.setFillColor(255, 24, 1);
      pdf.circle(14, legendY, 2, 'F');
      pdf.text(`Zone d'exclusion: ${zones.exclusion}m`, 20, legendY);

      pdf.setDrawColor(255, 165, 0);
      pdf.setFillColor(255, 165, 0);
      pdf.circle(14, legendY + 7, 2, 'F');
      pdf.text(`Zone contrôlée: ${zones.controlled}m`, 20, legendY + 7);

      pdf.setDrawColor(34, 197, 94);
      pdf.setFillColor(34, 197, 94);
      pdf.circle(14, legendY + 14, 2, 'F');
      pdf.text(`Zone de soutien: ${zones.support}m`, 20, legendY + 14);

      // Add map image
      const imgWidth = pdfWidth - 28;
      const imgHeight = pdfHeight - 70;
      pdf.addImage(imgData, 'PNG', 14, 65, imgWidth, imgHeight);

      pdf.save(`${generateFileName()}.pdf`);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Une erreur est survenue lors de l\'export du PDF');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-sm">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold">Partager la carte</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full"
            aria-label="Fermer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <button
            onClick={() => handleShare('email')}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100"
          >
            <Mail className="w-6 h-6" />
            <span>Partager par email</span>
          </button>
          <button
            onClick={() => handleShare('sms')}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100"
          >
            <MessageSquare className="w-6 h-6" />
            <span>Partager par SMS</span>
          </button>
          <button
            onClick={() => handleShare('whatsapp')}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100"
          >
            <Share2 className="w-6 h-6" />
            <span>Partager via WhatsApp</span>
          </button>
          <div className="border-t my-2"></div>
          <button
            onClick={handleImageExport}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100"
          >
            <FileImage className="w-6 h-6" />
            <span>Exporter en image</span>
          </button>
          <button
            onClick={handlePDFExport}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100"
          >
            <Download className="w-6 h-6" />
            <span>Exporter en PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const OperationalZoning = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [position, setPosition] = useState<[number, number]>([48.8566, 2.3522]);
  const [incidentPosition, setIncidentPosition] = useState<[number, number] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentLayer, setCurrentLayer] = useState<'street' | 'satellite' | 'hybrid'>('street');
  const [map, setMap] = useState<L.Map | null>(null);
  const [isLocationRequested, setIsLocationRequested] = useState(false);
  const [isGeolocating, setIsGeolocating] = useState(false);
  const [exclusionRadius, setExclusionRadius] = useState(50); // Initial radius in meters
  const [controlledRadius, setControlledRadius] = useState(100); // Initial radius in meters
  const [supportRadius, setSupportRadius] = useState(200); // Initial radius in meters
  const [visibleZones, setVisibleZones] = useState({
    exclusion: true,
    controlled: true,
    support: true,
  });
  const [address, setAddress] = useState<string>('');
  const [isShareOpen, setIsShareOpen] = useState(false);
  const mapRef = React.useRef<HTMLDivElement>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);

  const fetchWeather = useCallback(async (lat: number, lon: number) => {
    try {
      const response = await axios.get(
        `https://api.weatherapi.com/v1/current.json`,
        { params: { key: import.meta.env.VITE_WEATHER_API_KEY, q: `${lat},${lon}`, aqi: 'no', lang: 'fr' } }
      );
      console.log('Weather data:', response.data); // Pour le débogage

      const current = response.data.current;
      setWeather({
        temperature: Math.round(current.temp_c),
        humidity: current.humidity,
        windSpeed: Math.round(current.wind_kph),
        windDirection: current.wind_degree
      });
    } catch (error) {
      console.error('Error fetching weather:', error);
      setWeather(null);
    }
  }, []);

  useEffect(() => {
    setIsLocationRequested(true);
    setIsGeolocating(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setPosition([position.coords.latitude, position.coords.longitude]);
          setIsLocationRequested(false);
          setIsGeolocating(false);
        },
        (error) => {
          console.error('Error getting location:', error);
          let errorMessage = 'Une erreur est survenue lors de la géolocalisation.';

          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Accès à la localisation refusé. Vous pouvez saisir une adresse manuellement.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Position actuelle non disponible. Veuillez saisir une adresse.';
              break;
            case error.TIMEOUT:
              errorMessage = 'Délai d\'attente dépassé. Veuillez réessayer ou saisir une adresse.';
              break;
          }

          setError(errorMessage);
          setIsLocationRequested(false);
          setIsGeolocating(false);
        }
      );
    } else {
      setError('La géolocalisation n\'est pas supportée par votre navigateur. Veuillez saisir une adresse.');
      setIsLocationRequested(false);
      setIsGeolocating(false);
    }
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`
      );
      const data = await response.json();

      if (data && data[0]) {
        setAddress(data[0].display_name);
        setPosition([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
      } else {
        setError('Adresse non trouvée');
      }
    } catch (error) {
      console.error('Error searching location:', error);
      setError('Erreur lors de la recherche. Veuillez réessayer.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMapClick = (latlng: L.LatLng) => {
    const { lat, lng } = latlng;
    setIncidentPosition([lat, lng]);
    fetchWeather(lat, lng);
  };

  const changeMapLayer = (layer: 'street' | 'satellite' | 'hybrid') => {
    setCurrentLayer(layer);
  };

  const adjustRadius = (increment: boolean, type: 'exclusion' | 'controlled' | 'support') => {
    const setRadius = type === 'exclusion' ? setExclusionRadius :
      type === 'controlled' ? setControlledRadius :
        setSupportRadius;

    setRadius(prev => {
      const step = 10; // Fixed step of 10m
      const newRadius = increment ? prev + step : prev - step;

      // Ensure exclusion zone is smaller than controlled zone
      if (type === 'exclusion') {
        return Math.max(50, Math.min(controlledRadius - 10, newRadius));
      }
      // Ensure controlled zone is larger than exclusion zone and smaller than support zone
      if (type === 'controlled') {
        return Math.max(exclusionRadius + 10, Math.min(supportRadius - 10, newRadius));
      }
      return Math.max(controlledRadius + 10, Math.min(5000, newRadius));
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-[#0A0A0A] dark:text-white relative overflow-hidden">
      {/* Background Ambient Glow */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-900/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-orange-900/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 flex flex-col h-full">
        <div className="p-4 flex justify-between items-center">
          <style>
            {`
            .north-arrow-container {
              background: rgba(20, 20, 20, 0.8);
              backdrop-filter: blur(8px);
              padding: 8px;
              border-radius: 12px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              margin-right: 10px !important;
              border: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .north-arrow {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
            }
            
            .north-arrow-icon {
              color: #FF4500;
              font-size: 24px;
              line-height: 1;
              margin-bottom: -4px;
            }
            
            .north-arrow-text {
              color: #FF4500;
              font-weight: bold;
              font-size: 16px;
            }
          `}
          </style>
        </div>

        <div className="flex-1 flex flex-col px-4 pb-4">
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-500 dark:from-white dark:to-gray-400 mb-6 text-center animate-fade-in-down">
            Zonage opérationnel
          </h1>

          <div className="w-full max-w-4xl mx-auto mb-6 animate-fade-in-down" style={{ animationDelay: '0.1s' }}>
            <div className="relative group">
              {isGeolocating && (
                <div className="absolute -top-10 left-0 right-0 text-center text-slate-900 dark:text-white text-sm bg-white/80 dark:bg-black/60 backdrop-blur-md py-2 px-4 rounded-xl border border-slate-200 dark:border-white/10 mx-auto w-fit">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    Recherche de votre position...
                  </div>
                </div>
              )}
              <input
                type="text"
                autoFocus={!isLocationRequested}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Rechercher une adresse..."
                className={`w-full px-6 py-4 pr-14 rounded-2xl bg-white/90 dark:bg-[#151515] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-gray-200 placeholder-slate-500 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500/50 dark:focus:bg-[#1A1A1A] transition-all duration-300 shadow-lg ${error ? 'border-red-500/50 focus:border-red-500' : ''
                  }`}
              />
              <button
                onClick={handleSearch}
                disabled={isLoading}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-white/5 dark:hover:bg-white/10 rounded-xl text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-all duration-200"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Search className="w-5 h-5" />
                )}
              </button>
            </div>
            {error && (
              <div className="mt-2 px-4 py-3 bg-red-100 text-red-700 rounded-lg text-sm flex items-center gap-2 shadow-md border border-red-200">
                <MapPin className="w-4 h-4 flex-shrink-0" />
                <div>
                  <p className="font-medium">{error}</p>
                  <p className="text-red-600 text-xs mt-0.5">
                    Utilisez la barre de recherche ci-dessus pour localiser votre position
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="w-full max-w-4xl mx-auto mb-4 flex justify-end gap-2 animate-fade-in-down" style={{ animationDelay: '0.2s' }}>
            <button
              onClick={() => changeMapLayer('street')}
              className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-all duration-200 ${currentLayer === 'street'
                ? 'bg-blue-600 text-white shadow-lg shadow-red-500/30'
                : 'bg-white/90 border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:bg-[#151515] dark:border-white/10 dark:text-gray-400 dark:hover:bg-[#1A1A1A] dark:hover:text-white'
                }`}
            >
              <Layers className="w-4 h-4" />
              Plan
            </button>
            <button
              onClick={() => changeMapLayer('satellite')}
              className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-all duration-200 ${currentLayer === 'satellite'
                ? 'bg-blue-600 text-white shadow-lg shadow-red-500/30'
                : 'bg-white/90 border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:bg-[#151515] dark:border-white/10 dark:text-gray-400 dark:hover:bg-[#1A1A1A] dark:hover:text-white'
                }`}
            >
              <Layers className="w-4 h-4" />
              Satellite
            </button>
            <button
              onClick={() => changeMapLayer('hybrid')}
              className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-all duration-200 ${currentLayer === 'hybrid'
                ? 'bg-blue-600 text-white shadow-lg shadow-red-500/30'
                : 'bg-white/90 border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:bg-[#151515] dark:border-white/10 dark:text-gray-400 dark:hover:bg-[#1A1A1A] dark:hover:text-white'
                }`}
            >
              <Layers className="w-4 h-4" />
              Hybride
            </button>
          </div>

          <ShareDialog
            isOpen={isShareOpen}
            onClose={() => setIsShareOpen(false)}
            mapRef={mapRef}
            address={address}
            zones={{
              exclusion: exclusionRadius,
              controlled: controlledRadius,
              support: supportRadius
            }}
          />

          <button
            onClick={() => setIsShareOpen(true)}
            className="absolute top-6 right-6 z-20 bg-white/90 dark:bg-[#151515]/90 backdrop-blur-md border border-slate-200 dark:border-white/10 p-3 rounded-xl shadow-lg hover:bg-slate-100 dark:hover:bg-[#1A1A1A] hover:scale-105 transition-all duration-200 group"
          >
            <Share2 className="w-5 h-5 text-slate-600 dark:text-gray-400 group-hover:text-slate-900 dark:group-hover:text-white" />
          </button>
          <div className="flex-1 w-full max-w-4xl mx-auto rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10 shadow-2xl animate-fade-in-down" style={{ animationDelay: '0.3s' }}>
            <div className="relative">
              <MapContainer
                ref={mapRef}
                center={position}
                zoom={16}
                style={{ height: 'calc(100vh - 400px)', width: '100%' }}
                whenCreated={setMap}
              >
                <TileLayer
                  attribution={
                    currentLayer === 'street'
                      ? '&copy; OpenStreetMap contributors'
                      : '&copy; CARTO'
                  }
                  url={MAP_LAYERS[currentLayer]}
                  crossOrigin="anonymous"
                />
                <ScaleControl position="bottomleft" imperial={false} />
                <MapClickHandler onMapClick={handleMapClick} />
                {incidentPosition && (
                  <>
                    {visibleZones.support && (
                      <Circle
                        center={incidentPosition}
                        radius={supportRadius}
                        pathOptions={{
                          color: '#22C55E',
                          fillColor: '#22C55E',
                          fillOpacity: 0.15,
                          weight: 2
                        }}
                      />
                    )}
                    {visibleZones.controlled && (
                      <Circle
                        center={incidentPosition}
                        radius={controlledRadius}
                        pathOptions={{
                          color: '#FFA500',
                          fillColor: '#FFA500',
                          fillOpacity: 0.15,
                          weight: 2
                        }}
                      />
                    )}
                    {visibleZones.exclusion && (
                      <Circle
                        center={incidentPosition}
                        radius={exclusionRadius}
                        pathOptions={{
                          color: '#FF1801',
                          fillColor: '#FF1801',
                          fillOpacity: 0.15,
                          weight: 2
                        }}
                      />
                    )}
                    <Marker
                      position={incidentPosition}
                      icon={redMarkerIcon}
                      zIndexOffset={1000}
                    />
                  </>
                )}
                <MapUpdater center={position} />
              </MapContainer>
            </div>

            <div className="mt-4 bg-white/90 dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-xl animate-fade-in-down" style={{ animationDelay: '0.4s' }}>
              <div className="grid grid-cols-1 md:grid-cols-[2fr,1fr] gap-8">
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <h3 className="text-slate-700 dark:text-gray-300 font-medium w-36">Zone d'exclusion</h3>
                    <div className="flex items-center gap-3 flex-1">
                      <button
                        onClick={() => adjustRadius(false, 'exclusion')}
                        className="p-2 bg-slate-200 hover:bg-slate-300 dark:bg-white/5 dark:hover:bg-white/10 rounded-lg transition-colors border border-slate-200 dark:border-white/5"
                        title="Réduire le périmètre"
                      >
                        <Minus className="w-5 h-5 text-slate-600 dark:text-gray-400 group-hover:text-slate-900 dark:group-hover:text-white" />
                      </button>
                      <div className="w-24 text-center font-bold text-slate-900 dark:text-white text-lg">
                        {exclusionRadius} m
                      </div>
                      <button
                        onClick={() => adjustRadius(true, 'exclusion')}
                        className="p-2 bg-slate-200 hover:bg-slate-300 dark:bg-white/5 dark:hover:bg-white/10 rounded-lg transition-colors border border-slate-200 dark:border-white/5"
                        title="Augmenter le périmètre"
                      >
                        <Plus className="w-5 h-5 text-slate-600 dark:text-gray-400 group-hover:text-slate-900 dark:group-hover:text-white" />
                      </button>
                      <button
                        onClick={() => setVisibleZones(prev => ({ ...prev, exclusion: !prev.exclusion }))}
                        className={`ml-auto px-4 py-1.5 rounded-lg transition-all duration-200 ${visibleZones.exclusion
                          ? 'bg-red-500/20 border border-red-500/30'
                          : 'bg-slate-200 border border-slate-200 dark:bg-white/5 dark:border-white/5'
                          }`}
                      >
                        <div className={`w-3 h-3 rounded-full ${visibleZones.exclusion ? 'bg-red-500 shadow-[0_0_4px_rgba(59,130,246,0.6),0_0_10px_rgba(239,68,68,0.55)]' : 'bg-gray-600'}`}></div>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <h3 className="text-slate-700 dark:text-gray-300 font-medium w-36">Zone contrôlée</h3>
                    <div className="flex items-center gap-3 flex-1">
                      <button
                        onClick={() => adjustRadius(false, 'controlled')}
                        className="p-2 bg-slate-200 hover:bg-slate-300 dark:bg-white/5 dark:hover:bg-white/10 rounded-lg transition-colors border border-slate-200 dark:border-white/5"
                        title="Réduire le périmètre"
                      >
                        <Minus className="w-5 h-5 text-slate-600 dark:text-gray-400" />
                      </button>
                      <div className="w-24 text-center font-bold text-slate-900 dark:text-white text-lg">
                        {controlledRadius} m
                      </div>
                      <button
                        onClick={() => adjustRadius(true, 'controlled')}
                        className="p-2 bg-slate-200 hover:bg-slate-300 dark:bg-white/5 dark:hover:bg-white/10 rounded-lg transition-colors border border-slate-200 dark:border-white/5"
                        title="Augmenter le périmètre"
                      >
                        <Plus className="w-5 h-5 text-slate-600 dark:text-gray-400" />
                      </button>
                      <button
                        onClick={() => setVisibleZones(prev => ({ ...prev, controlled: !prev.controlled }))}
                        className={`ml-auto px-4 py-1.5 rounded-lg transition-all duration-200 ${visibleZones.controlled
                          ? 'bg-orange-500/20 border border-orange-500/30'
                          : 'bg-slate-200 border border-slate-200 dark:bg-white/5 dark:border-white/5'
                          }`}
                      >
                        <div className={`w-3 h-3 rounded-full ${visibleZones.controlled ? 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]' : 'bg-gray-600'}`}></div>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <h3 className="text-slate-700 dark:text-gray-300 font-medium w-36">Zone de soutien</h3>
                    <div className="flex items-center gap-3 flex-1">
                      <button
                        onClick={() => adjustRadius(false, 'support')}
                        className="p-2 bg-slate-200 hover:bg-slate-300 dark:bg-white/5 dark:hover:bg-white/10 rounded-lg transition-colors border border-slate-200 dark:border-white/5"
                        title="Réduire le périmètre"
                      >
                        <Minus className="w-5 h-5 text-slate-600 dark:text-gray-400" />
                      </button>
                      <div className="w-24 text-center font-bold text-slate-900 dark:text-white text-lg">
                        {supportRadius} m
                      </div>
                      <button
                        onClick={() => adjustRadius(true, 'support')}
                        className="p-2 bg-slate-200 hover:bg-slate-300 dark:bg-white/5 dark:hover:bg-white/10 rounded-lg transition-colors border border-slate-200 dark:border-white/5"
                        title="Augmenter le périmètre"
                      >
                        <Plus className="w-5 h-5 text-slate-600 dark:text-gray-400" />
                      </button>
                      <button
                        onClick={() => setVisibleZones(prev => ({ ...prev, support: !prev.support }))}
                        className={`ml-auto px-4 py-1.5 rounded-lg transition-all duration-200 ${visibleZones.support
                          ? 'bg-green-500/20 border border-green-500/30'
                          : 'bg-slate-200 border border-slate-200 dark:bg-white/5 dark:border-white/5'
                          }`}
                      >
                        <div className={`w-3 h-3 rounded-full ${visibleZones.support ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-gray-600'}`}></div>
                      </button>
                    </div>
                  </div>
                </div>

                {weather ? (
                  <div className="border-l border-slate-200 dark:border-white/10 pl-8 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 dark:bg-blue-500/10 rounded-lg">
                        <Thermometer className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Température</p>
                        <p className="text-xl font-bold text-slate-800 dark:text-gray-200">{weather.temperature}°C</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-orange-100 dark:bg-orange-500/10 rounded-lg">
                        <Wind
                          className="w-5 h-5 text-orange-600 dark:text-orange-400"
                          style={{ transform: `rotate(${weather.windDirection}deg)` }}
                        />
                      </div>
                      <div>
                        <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">Vent</p>
                        <p className="text-xl font-bold text-slate-800 dark:text-gray-200">{weather.windSpeed} km/h</p>
                        <p className="text-xs text-orange-500/80 dark:text-orange-400/80">Direction: {getCardinalDirection(weather.windDirection)} ({weather.windDirection}°)</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 dark:bg-green-500/10 rounded-lg">
                        <Droplets className="w-5 h-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="text-xs text-green-600 dark:text-green-400 font-medium">Humidité</p>
                        <p className="text-xl font-bold text-slate-800 dark:text-gray-200">{weather.humidity}%</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="border-l border-slate-200 dark:border-white/10 pl-8 flex items-center justify-center">
                    <div className="text-center p-4 bg-slate-100 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/5">
                      <MapPin className="w-8 h-8 mx-auto mb-2 text-slate-500 dark:text-gray-500" />
                      <p className="text-slate-600 dark:text-gray-400 text-xs">
                        Cliquez sur la carte pour afficher les données météorologiques
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OperationalZoning;
