import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Search, Layers, Plus, Minus, Share2, Download, FileImage, X, Mail, MessageSquare, Wind, Thermometer, Droplets } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents, ScaleControl } from 'react-leaflet';
import axios from 'axios';
import L from 'leaflet';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
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

// Map layer URLs
const MAP_LAYERS = {
  street: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  satellite: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
  hybrid: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
};

// Component to handle map location updates
const MapUpdater: React.FC<{ center: [number, number] }> = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 16);

    const northArrow = L.control({ position: 'topright' });
    
    northArrow.onAdd = function() {
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
        `https://api.weatherapi.com/v1/current.json?key=${import.meta.env.VITE_WEATHER_API_KEY}&q=${lat},${lon}&aqi=no`
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
    <div className="min-h-screen flex flex-col bg-[#00051E]">
      <div className="p-4 flex justify-between items-center">
        <style>
          {`
            .north-arrow-container {
              background: white;
              padding: 8px;
              border-radius: 4px;
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
              margin-right: 10px !important;
              border: 2px solid #FF1801;
            }
            
            .north-arrow {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
            }
            
            .north-arrow-icon {
              color: #FF1801;
              font-size: 24px;
              line-height: 1;
              margin-bottom: -4px;
            }
            
            .north-arrow-text {
              color: #FF1801;
              font-weight: bold;
              font-size: 16px;
            }
          `}
        </style>
        <button 
          onClick={() => navigate('/')}
          className="bg-[#FF1801] hover:bg-[#D91601] transition-colors text-white px-4 py-2 rounded-3xl"
        >
          Accueil
        </button>
      </div>

      <div className="flex-1 flex flex-col px-4 pb-4">
        <h1 className="text-2xl font-bold text-white mb-4 text-center">
          Zonage opérationnel
        </h1>

        <div className="w-full max-w-4xl mx-auto mb-4">
          <div className="relative">
            {isGeolocating && (
              <div className="absolute -top-8 left-0 right-0 text-center text-white text-sm bg-[#1A1A1A] py-1 px-3 rounded-t-lg">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Recherche de votre position...
                </div>
              </div>
            )}
            <input
              type="text"
              autoFocus={!isLocationRequested}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Rechercher une adresse..."
              className={`w-full px-4 py-2 pr-12 rounded-xl bg-white text-gray-800 placeholder-gray-400 focus:outline-none ${
                error ? 'border-2 border-[#FF1801] focus:border-[#FF1801]' : ''
              }`}
            />
            <button
              onClick={handleSearch}
              disabled={isLoading}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-600 hover:text-gray-800"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
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

        <div className="w-full max-w-4xl mx-auto mb-4 flex justify-end gap-2">
          <button
            onClick={() => changeMapLayer('street')}
            className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 ${
              currentLayer === 'street'
                ? 'bg-[#FF1801] text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Layers className="w-4 h-4" />
            Plan
          </button>
          <button
            onClick={() => changeMapLayer('satellite')}
            className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 ${
              currentLayer === 'satellite'
                ? 'bg-[#FF1801] text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Layers className="w-4 h-4" />
            Satellite
          </button>
          <button
            onClick={() => changeMapLayer('hybrid')}
            className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 ${
              currentLayer === 'hybrid'
                ? 'bg-[#FF1801] text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
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
          className="absolute top-4 right-4 z-10 bg-white p-2 rounded-lg shadow-md hover:bg-gray-100"
        >
          <Share2 className="w-5 h-5 text-gray-700" />
        </button>
        <div className="flex-1 w-full max-w-4xl mx-auto rounded-xl overflow-hidden">
          <div className="relative">
            <MapContainer
              ref={mapRef}
              center={position}
              zoom={16}
              style={{ height: 'calc(100vh - 400px)', width: '100%' }}
              whenCreated={setMap}
            >
              <TileLayer
                attribution={currentLayer === 'street' ? '&copy; OpenStreetMap contributors' : '&copy; Google Maps'}
                url={MAP_LAYERS[currentLayer]}
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
          
          <div className="mt-4 bg-white rounded-xl p-4">
            <div className="grid grid-cols-[2fr,1fr] gap-8">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-gray-800 font-semibold w-36">Zone d'exclusion</h3>
                  <div className="flex items-center gap-2 flex-1">
                    <button
                      onClick={() => adjustRadius(false, 'exclusion')}
                      className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
                      title="Réduire le périmètre"
                    >
                      <Minus className="w-5 h-5 text-gray-700" />
                    </button>
                    <div className="w-24 text-center font-medium">
                      {exclusionRadius} m
                    </div>
                    <button
                      onClick={() => adjustRadius(true, 'exclusion')}
                      className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
                      title="Augmenter le périmètre"
                    >
                      <Plus className="w-5 h-5 text-gray-700" />
                    </button>
                    <button
                      onClick={() => setVisibleZones(prev => ({ ...prev, exclusion: !prev.exclusion }))}
                      className={`ml-2 px-3 py-1 rounded-lg transition-colors ${
                        visibleZones.exclusion ? 'bg-[#FF1801] bg-opacity-20' : 'bg-gray-200'
                      }`}
                    >
                      <div className="w-4 h-4 bg-[#FF1801] rounded-full"></div>
                    </button>
                  </div>
                </div>
              
                <div className="flex items-center gap-2">
                  <h3 className="text-gray-800 font-semibold w-36">Zone contrôlée</h3>
                  <div className="flex items-center gap-2 flex-1">
                    <button
                      onClick={() => adjustRadius(false, 'controlled')}
                      className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
                      title="Réduire le périmètre"
                    >
                      <Minus className="w-5 h-5 text-gray-700" />
                    </button>
                    <div className="w-24 text-center font-medium">
                      {controlledRadius} m
                    </div>
                    <button
                      onClick={() => adjustRadius(true, 'controlled')}
                      className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
                      title="Augmenter le périmètre"
                    >
                      <Plus className="w-5 h-5 text-gray-700" />
                    </button>
                    <button
                      onClick={() => setVisibleZones(prev => ({ ...prev, controlled: !prev.controlled }))}
                      className={`ml-2 px-3 py-1 rounded-lg transition-colors ${
                        visibleZones.controlled ? 'bg-[#FFA500] bg-opacity-20' : 'bg-gray-200'
                      }`}
                    >
                      <div className="w-4 h-4 bg-[#FFA500] rounded-full"></div>
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <h3 className="text-gray-800 font-semibold w-36">Zone de soutien</h3>
                  <div className="flex items-center gap-2 flex-1">
                    <button
                      onClick={() => adjustRadius(false, 'support')}
                      className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
                      title="Réduire le périmètre"
                    >
                      <Minus className="w-5 h-5 text-gray-700" />
                    </button>
                    <div className="w-24 text-center font-medium">
                      {supportRadius} m
                    </div>
                    <button
                      onClick={() => adjustRadius(true, 'support')}
                      className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
                      title="Augmenter le périmètre"
                    >
                      <Plus className="w-5 h-5 text-gray-700" />
                    </button>
                    <button
                      onClick={() => setVisibleZones(prev => ({ ...prev, support: !prev.support }))}
                      className={`ml-2 px-3 py-1 rounded-lg transition-colors ${
                        visibleZones.support ? 'bg-[#22C55E] bg-opacity-20' : 'bg-gray-200'
                      }`}
                    >
                      <div className="w-4 h-4 bg-[#22C55E] rounded-full"></div>
                    </button>
                  </div>
                </div>
              </div>
              
              {weather ? (
                <div className="border-l pl-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Thermometer className="w-4 h-4 text-blue-600" />
                    <div>
                      <p className="text-xs text-blue-600">Température</p>
                      <p className="text-base font-semibold text-blue-800">{weather.temperature}°C</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Wind 
                      className="w-4 h-4 text-orange-600"
                      style={{ transform: `rotate(${weather.windDirection}deg)` }}
                    />
                    <div>
                      <p className="text-xs text-orange-600">Vent</p>
                      <p className="text-base font-semibold text-orange-800">{weather.windSpeed} km/h</p>
                      <p className="text-xs text-orange-600">Direction: {getCardinalDirection(weather.windDirection)} ({weather.windDirection}°)</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Droplets className="w-4 h-4 text-green-600" />
                    <div>
                      <p className="text-xs text-green-600">Humidité</p>
                      <p className="text-base font-semibold text-green-800">{weather.humidity}%</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border-l pl-4 flex items-center justify-center">
                  <div className="text-center">
                    <MapPin className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-gray-500 text-xs">
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
  );
};

export default OperationalZoning;