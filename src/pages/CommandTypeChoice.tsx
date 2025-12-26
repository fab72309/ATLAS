import React from 'react';
import { LocateFixed, Loader2, Camera } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import CommandIcon from '../components/CommandIcon';
import { useInterventionStore } from '../stores/useInterventionStore';
import { getInterventionShare, type InterventionSharePayload } from '../utils/firestore';
import { INTERVENTION_DRAFT_KEY, INTERVENTION_SHARE_PREFIX } from '../constants/intervention';
import { setOctTree } from '../utils/octTreeStore';
import { useSitacStore } from '../stores/useSitacStore';

const ROLE_OPTIONS = [
  { value: 'chef_site', label: 'Chef de site' },
  { value: 'chef_colonne', label: 'Chef de colonne' },
  { value: 'chef_groupe', label: 'Chef de groupe' },
  { value: 'officier_moyens', label: 'Officier moyens' },
  { value: 'officier_renseignements', label: 'Officier renseignements' }
];

const CommandTypeChoice = () => {
  const navigate = useNavigate();
  const { type } = useParams();
  const validTypes = ['group', 'column', 'site', 'communication'] as const;
  const isValidType = (value: string | undefined): value is (typeof validTypes)[number] =>
    !!value && validTypes.includes(value as (typeof validTypes)[number]);
  const currentType = isValidType(type) ? type : null;
  const [showInterventionModal, setShowInterventionModal] = React.useState(false);
  const [showMetadataModal, setShowMetadataModal] = React.useState(false);
  const [interventionMeta, setInterventionMeta] = React.useState({
    streetNumber: '',
    streetName: '',
    city: '',
    date: '',
    time: '',
    role: ''
  });
  const [isGeolocating, setIsGeolocating] = React.useState(false);
  const [geoError, setGeoError] = React.useState<string | null>(null);
  const storedStreetNumber = useInterventionStore((s) => s.streetNumber);
  const storedStreetName = useInterventionStore((s) => s.streetName);
  const storedCity = useInterventionStore((s) => s.city);
  const storedRole = useInterventionStore((s) => s.role);
  const setStoredAddress = useInterventionStore((s) => s.setAddress);
  const setStoredStreetNumber = useInterventionStore((s) => s.setStreetNumber);
  const setStoredStreetName = useInterventionStore((s) => s.setStreetName);
  const setStoredCity = useInterventionStore((s) => s.setCity);
  const setStoredRole = useInterventionStore((s) => s.setRole);
  const setStoredLocation = useInterventionStore((s) => s.setLocation);
  const clearStoredLocation = useInterventionStore((s) => s.clearLocation);
  const [showScanModal, setShowScanModal] = React.useState(false);
  const [scanStatus, setScanStatus] = React.useState<'idle' | 'scanning' | 'loading'>('idle');
  const [scanError, setScanError] = React.useState<string | null>(null);
  const [scanManualCode, setScanManualCode] = React.useState('');
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const detectorRef = React.useRef<BarcodeDetector | null>(null);
  const scanFrameRef = React.useRef<number | null>(null);
  const scanActiveRef = React.useRef(false);

  // If the type is invalid (e.g., security/supply), redirect to home to avoid blank states
  React.useEffect(() => {
    if (!currentType) {
      // Small timeout to allow initial paint, then redirect
      const t = setTimeout(() => navigate('/', { replace: true }), 0);
      return () => clearTimeout(t);
    }
  }, [currentType, navigate]);

  const handlePrimaryAction = () => {
    if (!currentType) return;
    if (type === 'communication') {
      navigate(`/situation/${currentType}/dictate`);
      return;
    }
    setShowInterventionModal(true);
  };

  const resetMeta = () => {
    const now = new Date();
    const defaultDate = now.toISOString().slice(0, 10);
    const defaultTime = now.toISOString().slice(11, 16);
    setInterventionMeta((prev) => ({
      streetNumber: storedStreetNumber || prev.streetNumber || '',
      streetName: storedStreetName || prev.streetName || '',
      city: storedCity || prev.city || '',
      date: defaultDate,
      time: defaultTime,
      role: storedRole || prev.role || ''
    }));
  };

  const handleCreateIntervention = () => {
    if (!currentType) return;
    resetMeta();
    setShowInterventionModal(false);
    setShowMetadataModal(true);
  };

  const handleMetadataChange = (field: keyof typeof interventionMeta, value: string) => {
    setInterventionMeta((prev) => ({ ...prev, [field]: value }));
    if (field === 'streetNumber') setStoredStreetNumber(value);
    if (field === 'streetName') setStoredStreetName(value);
    if (field === 'city') setStoredCity(value);
    if (field === 'role') setStoredRole(value);
  };

  const handleResumeIntervention = () => {
    if (!currentType) return;
    setShowInterventionModal(false);
    navigate(`/situation/${currentType}/dictate`, { state: { mode: 'resume' } });
  };

  const stopScanner = React.useCallback(() => {
    scanActiveRef.current = false;
    if (scanFrameRef.current !== null) {
      window.cancelAnimationFrame(scanFrameRef.current);
      scanFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    detectorRef.current = null;
  }, [INTERVENTION_SHARE_PREFIX]);

  const parseShareCode = React.useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith(INTERVENTION_SHARE_PREFIX)) {
      return trimmed.slice(INTERVENTION_SHARE_PREFIX.length).trim();
    }
    return trimmed;
  }, []);

  const applySharePayload = React.useCallback((payload: InterventionSharePayload) => {
    const draft = payload?.draft && typeof payload.draft === 'object' ? payload.draft as Record<string, unknown> : null;
    if (!draft) {
      throw new Error('Données de partage invalides.');
    }
    const sanitizedDraft = JSON.parse(JSON.stringify(draft)) as Record<string, unknown>;
    try {
      localStorage.setItem(INTERVENTION_DRAFT_KEY, JSON.stringify(sanitizedDraft));
    } catch (err) {
      console.error('Erreur sauvegarde brouillon partagé', err);
    }

    const meta = payload.interventionMeta && typeof payload.interventionMeta === 'object'
      ? payload.interventionMeta as Record<string, unknown>
      : null;
    const streetNumber = meta && typeof meta.streetNumber === 'string' ? meta.streetNumber : '';
    const streetName = meta && typeof meta.streetName === 'string' ? meta.streetName : '';
    const role = meta && typeof meta.role === 'string' ? meta.role : '';
    const lat = meta && typeof meta.lat === 'number' ? meta.lat : null;
    const lng = meta && typeof meta.lng === 'number' ? meta.lng : null;
    const draftAddress = typeof sanitizedDraft.address === 'string' ? sanitizedDraft.address : undefined;
    const draftCity = typeof sanitizedDraft.city === 'string' ? sanitizedDraft.city : undefined;

    if (draftAddress) setStoredAddress(draftAddress);
    if (streetNumber) setStoredStreetNumber(streetNumber);
    if (streetName) setStoredStreetName(streetName);
    if (draftCity) setStoredCity(draftCity);
    if (role) setStoredRole(role);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      setStoredLocation({
        lat: lat as number,
        lng: lng as number,
        address: draftAddress,
        city: draftCity,
        streetNumber: streetNumber || undefined,
        streetName: streetName || undefined
      });
    } else {
      clearStoredLocation();
    }

    if (payload.octTree && typeof payload.octTree === 'object') {
      setOctTree(payload.octTree as Parameters<typeof setOctTree>[0]);
    }

    if (payload.sitacState && typeof payload.sitacState === 'object') {
      const sitacState = payload.sitacState as Record<string, unknown>;
      const geoJSON = sitacState.geoJSON;
      if (geoJSON && typeof geoJSON === 'object') {
        const snapshots = Array.isArray(sitacState.snapshots) ? sitacState.snapshots : undefined;
        const drawingColor = typeof sitacState.drawingColor === 'string' ? sitacState.drawingColor : undefined;
        const lineStyle = sitacState.lineStyle === 'solid' || sitacState.lineStyle === 'dashed' || sitacState.lineStyle === 'dot-dash'
          ? sitacState.lineStyle
          : undefined;
        const locked = typeof sitacState.locked === 'boolean' ? sitacState.locked : undefined;
        useSitacStore.setState((state) => ({
          geoJSON: geoJSON as typeof state.geoJSON,
          history: [geoJSON as typeof state.geoJSON],
          redo: [],
          selectedFeatureId: null,
          snapshots: snapshots ?? state.snapshots,
          drawingColor: drawingColor ?? state.drawingColor,
          lineStyle: lineStyle ?? state.lineStyle,
          locked: locked ?? state.locked,
          mode: 'view'
        }));
      }
    }
  }, [clearStoredLocation, setStoredAddress, setStoredCity, setStoredLocation, setStoredRole, setStoredStreetName, setStoredStreetNumber]);

  const handleConsumeShare = React.useCallback(async (rawValue: string) => {
    const shareId = parseShareCode(rawValue);
    if (!shareId) {
      setScanError('Code invalide. Vérifiez la saisie.');
      return;
    }
    stopScanner();
    setScanStatus('loading');
    setScanError(null);
    try {
      const payload = await getInterventionShare(shareId);
      if (!payload) {
        setScanError('Intervention introuvable.');
        setScanStatus('idle');
        return;
      }
      applySharePayload(payload);
      setShowScanModal(false);
      const shareType = payload.shareType && isValidType(payload.shareType) ? payload.shareType : currentType;
      if (shareType) {
        navigate(`/situation/${shareType}/dictate`, { state: { mode: 'resume' } });
      }
    } catch (error) {
      console.error('Erreur récupération partage intervention', error);
      const message = error instanceof Error ? error.message : 'Impossible de récupérer le partage.';
      setScanError(message);
      setScanStatus('idle');
    }
  }, [applySharePayload, currentType, navigate, parseShareCode, stopScanner]);

  const handleOpenScanModal = () => {
    setShowInterventionModal(false);
    setScanManualCode('');
    setScanError(null);
    setShowScanModal(true);
  };

  const handleCloseScanModal = () => {
    setShowScanModal(false);
    setScanStatus('idle');
    setScanManualCode('');
    setScanError(null);
    stopScanner();
  };

  const handleConfirmMetadata = () => {
    if (!currentType) return;
    const now = new Date();
    const date = interventionMeta.date || now.toISOString().slice(0, 10);
    const time = interventionMeta.time || now.toISOString().slice(11, 16);
    const address = [interventionMeta.streetNumber, interventionMeta.streetName].filter(Boolean).join(' ').trim();
    const payload = {
      address,
      city: interventionMeta.city,
      role: interventionMeta.role,
      date,
      time,
    };
    setShowMetadataModal(false);
    navigate(`/situation/${currentType}/dictate`, { state: { mode: 'create', meta: payload } });
  };

  const handleLocateUser = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoError('La géolocalisation n’est pas supportée par ce navigateur.');
      return;
    }
    setIsGeolocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=fr`
          );
          const data = await response.json();
          const address = data?.address || {};
          const streetNumber = address.house_number || '';
          const streetName = address.road || '';
          const streetLine = [streetNumber, streetName].filter(Boolean).join(' ').trim();
          const cityValue = address.city || address.town || address.village || address.municipality || address.county || '';
          const addressValue = streetLine || data?.display_name || '';
          setInterventionMeta((prev) => ({
            ...prev,
            streetNumber: streetNumber || prev.streetNumber,
            streetName: streetName || prev.streetName,
            city: cityValue || prev.city
          }));
          setStoredLocation({
            lat: latitude,
            lng: longitude,
            address: addressValue || undefined,
            city: cityValue || undefined,
            streetNumber: streetNumber || undefined,
            streetName: streetName || undefined
          });
        } catch (error) {
          console.error('Erreur de géocodage inverse', error);
          setGeoError('Impossible de récupérer l’adresse. Réessayez ou saisissez-la manuellement.');
        } finally {
          setIsGeolocating(false);
        }
      },
      (error) => {
        console.error('Erreur de géolocalisation', error);
        let message = 'Une erreur est survenue lors de la géolocalisation.';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = 'Accès à la localisation refusé. Vous pouvez saisir l’adresse manuellement.';
            break;
          case error.POSITION_UNAVAILABLE:
            message = 'Position actuelle non disponible.';
            break;
          case error.TIMEOUT:
            message = 'Délai d’attente dépassé. Réessayez.';
            break;
        }
        setGeoError(message);
        setIsGeolocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  React.useEffect(() => {
    if (!showScanModal) return;
    setScanStatus('scanning');
    setScanError(null);
    scanActiveRef.current = true;

    if (typeof BarcodeDetector === 'undefined') {
      setScanStatus('idle');
      setScanError('Le scan QR n’est pas supporté sur cet appareil. Utilisez le code manuel.');
      scanActiveRef.current = false;
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setScanStatus('idle');
      setScanError('La caméra n’est pas disponible. Utilisez le code manuel.');
      scanActiveRef.current = false;
      return;
    }

    const startScanner = async () => {
      try {
        detectorRef.current = new BarcodeDetector({ formats: ['qr_code'] });
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const scanFrame = async () => {
          if (!scanActiveRef.current || !videoRef.current || !detectorRef.current) return;
          if (videoRef.current.readyState < 2) {
            scanFrameRef.current = window.requestAnimationFrame(scanFrame);
            return;
          }
          try {
            const barcodes = await detectorRef.current.detect(videoRef.current);
            if (barcodes.length > 0 && barcodes[0]?.rawValue) {
              scanActiveRef.current = false;
              void handleConsumeShare(barcodes[0].rawValue);
              return;
            }
          } catch (error) {
            console.warn('Scan QR en échec', error);
          }
          scanFrameRef.current = window.requestAnimationFrame(scanFrame);
        };

        scanFrameRef.current = window.requestAnimationFrame(scanFrame);
      } catch (error) {
        console.error('Erreur caméra', error);
        setScanStatus('idle');
        setScanError('Impossible d’accéder à la caméra. Vérifiez les permissions.');
        stopScanner();
      }
    };

    void startScanner();

    return () => {
      stopScanner();
    };
  }, [handleConsumeShare, showScanModal, stopScanner]);

  React.useEffect(() => {
    if (!showMetadataModal) return;
    setInterventionMeta((prev) => ({
      ...prev,
      streetNumber: storedStreetNumber || prev.streetNumber,
      streetName: storedStreetName || prev.streetName,
      city: storedCity || prev.city,
      role: storedRole || prev.role
    }));
  }, [showMetadataModal, storedStreetNumber, storedStreetName, storedCity, storedRole]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#0A0A0A] dark:text-white">
      {/* Background Ambient Glow */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-200/70 dark:bg-blue-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-red-200/60 dark:bg-red-900/20 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-4xl mx-auto px-4 py-8 flex flex-col items-center h-full">
        <div className="flex flex-col items-center mb-8 animate-fade-in-down">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-500 dark:from-white dark:to-gray-400 mb-2">
            A.T.L.A.S
          </h1>
          <p className="text-slate-600 dark:text-gray-400 text-center text-sm md:text-base font-light tracking-wide">
            Aide Tactique et Logique pour l'Action des Secours
          </p>
        </div>

        {currentType ? (
          <div className="w-full max-w-[180px] mb-8 animate-fade-in-down" style={{ animationDelay: '0.1s' }}>
            <CommandIcon type={currentType} />
          </div>
        ) : (
          <div className="text-red-700 dark:text-white bg-red-100/80 dark:bg-red-500/20 border border-red-200 dark:border-red-500/40 rounded-xl p-4 mb-8 text-sm backdrop-blur-sm">
            Type non supporté. Redirection en cours vers l'accueil…
          </div>
        )}

        <div className="w-full max-w-xl space-y-6 animate-fade-in-down" style={{ animationDelay: '0.2s' }}>
            <button
              type="button"
              onClick={handlePrimaryAction}
              disabled={!currentType}
              className="group w-full bg-white/90 hover:bg-slate-100 dark:bg-[#151515] dark:hover:bg-[#1A1A1A] transition-all duration-300 text-slate-900 dark:text-white p-6 rounded-3xl border border-slate-200 dark:border-white/10 hover:border-red-400/40 dark:hover:border-red-500/50 hover:-translate-y-1"
            >
            <h2 className="text-2xl font-bold mb-2 group-hover:text-red-400 transition-colors">
              {type === 'communication' ? 'Dicter un Point de Situation' : 'Gérer une intervention'}
            </h2>
            <p className="text-slate-600 dark:text-gray-400 group-hover:text-slate-700 dark:group-hover:text-gray-300 transition-colors">
              {type === 'communication'
                ? 'Utilisez la reconnaissance vocale pour dicter votre point de situation'
                : 'Utilisez la reconnaissance vocale pour dicter votre ordre initial'}
            </p>
          </button>

        </div>
      </div>

      {showInterventionModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-slate-500 dark:text-gray-400 tracking-[0.3em]">Gestion d&apos;intervention</p>
                <h3 className="text-2xl font-bold">Que souhaitez-vous faire ?</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInterventionModal(false)}
                className="text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition"
                aria-label="Fermer la fenêtre"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4">
                <h4 className="text-lg font-semibold mb-1">Créer une nouvelle intervention</h4>
                <p className="text-sm text-slate-600 dark:text-gray-400 mb-4">
                  Démarrer un nouveau raisonnement SOIEC et configurer vos moyens.
                </p>
                <button
                  type="button"
                  onClick={handleCreateIntervention}
                  className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white transition font-semibold"
                >
                  Créer une intervention
                </button>
              </div>
              <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4">
                <h4 className="text-lg font-semibold mb-1">Reprendre une intervention existante</h4>
                <p className="text-sm text-slate-600 dark:text-gray-400 mb-4">
                  Charger une intervention enregistrée et poursuivre la mise à jour.
                </p>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={handleResumeIntervention}
                    className="w-full py-3 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-900 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white transition font-semibold"
                  >
                    Reprendre une intervention
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenScanModal}
                    className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white transition font-semibold flex items-center justify-center gap-2"
                  >
                    <Camera className="w-4 h-4" />
                    Scanner un QR Code
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showScanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-slate-500 dark:text-gray-400 tracking-[0.3em]">Gestion d&apos;intervention</p>
                <h3 className="text-2xl font-bold">Scanner un QR Code</h3>
              </div>
              <button
                type="button"
                onClick={handleCloseScanModal}
                className="text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition"
                aria-label="Fermer la fenêtre"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10 bg-black/90">
                <div className="relative w-full aspect-video">
                  <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                  {scanStatus === 'loading' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white text-sm">
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Chargement…
                    </div>
                  )}
                </div>
              </div>
              {scanError && (
                <p className="text-sm text-red-600 dark:text-red-300">{scanError}</p>
              )}
              {!scanError && scanStatus === 'scanning' && (
                <p className="text-sm text-slate-600 dark:text-gray-400">Pointez le QR code dans le cadre.</p>
              )}
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-slate-500 dark:text-gray-400">Code manuel</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    value={scanManualCode}
                    onChange={(e) => setScanManualCode(e.target.value)}
                    className="flex-1 px-4 py-3 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-red-500/40"
                    placeholder={`${INTERVENTION_SHARE_PREFIX}...`}
                  />
                  <button
                    type="button"
                    onClick={() => handleConsumeShare(scanManualCode)}
                    disabled={scanStatus === 'loading'}
                    className="px-4 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold transition disabled:opacity-60"
                  >
                    Valider
                  </button>
                </div>
                <p className="text-xs text-slate-500 dark:text-gray-400">Scannez le QR code ou collez le code partagé.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {showMetadataModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <div className="w-full max-w-2xl bg-white dark:bg-[#101010] border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-slate-500 dark:text-gray-400 tracking-[0.3em]">Nouvelle intervention</p>
                <h3 className="text-2xl font-bold">Renseignements initiaux</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowMetadataModal(false);
                  setShowInterventionModal(true);
                }}
                className="text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition"
                aria-label="Fermer la fenêtre"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs uppercase tracking-wide text-slate-500 dark:text-gray-400">Adresse</label>
                <div className="grid grid-cols-1 md:grid-cols-[0.5fr,1.2fr,1fr] gap-2">
                  <div className="space-y-1">
                    <span className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-gray-500">Numero</span>
                    <input
                      value={interventionMeta.streetNumber}
                      onChange={(e) => handleMetadataChange('streetNumber', e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-red-500/40"
                      placeholder="12"
                      inputMode="numeric"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-gray-500">Adresse</span>
                    <input
                      value={interventionMeta.streetName}
                      onChange={(e) => handleMetadataChange('streetName', e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-red-500/40"
                      placeholder="Rue des Secours"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-gray-500">Ville</span>
                    <div className="flex items-center gap-2">
                      <input
                        value={interventionMeta.city}
                        onChange={(e) => handleMetadataChange('city', e.target.value)}
                        className="flex-1 px-4 py-3 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-red-500/40"
                        placeholder="Paris"
                      />
                      <button
                        type="button"
                        onClick={handleLocateUser}
                        disabled={isGeolocating}
                        className="p-3 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-red-300 dark:hover:border-red-500/40 text-slate-600 dark:text-gray-300 hover:text-red-500 dark:hover:text-red-400 transition disabled:opacity-60 disabled:cursor-not-allowed"
                        aria-label="Utiliser ma position"
                        title="Utiliser ma position"
                      >
                        {isGeolocating ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <LocateFixed className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                {geoError && <p className="text-xs text-red-500">{geoError}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-slate-500 dark:text-gray-400">Date</label>
                <input
                  type="date"
                  value={interventionMeta.date}
                  onChange={(e) => handleMetadataChange('date', e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-red-500/40"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-slate-500 dark:text-gray-400">Heure</label>
                <input
                  type="time"
                  value={interventionMeta.time}
                  onChange={(e) => handleMetadataChange('time', e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-red-500/40"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs uppercase tracking-wide text-slate-500 dark:text-gray-400">Fonction</label>
                <select
                  value={interventionMeta.role}
                  onChange={(e) => handleMetadataChange('role', e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-red-500/40 text-slate-800 dark:text-gray-200"
                >
                  <option value="">Sélectionner une fonction</option>
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowMetadataModal(false);
                    setShowInterventionModal(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 transition"
                >
                  Retour
                </button>
              <button
                type="button"
                onClick={handleConfirmMetadata}
                className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold transition"
              >
                Valider
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommandTypeChoice;
