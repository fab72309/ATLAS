import React from 'react';
import { LocateFixed, Loader2, Camera, History } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import CommandIcon from '../components/CommandIcon';
import { useInterventionStore } from '../stores/useInterventionStore';
import { INTERVENTION_INVITE_PREFIX } from '../constants/intervention';
import { getLocalDate, getLocalTime } from '../utils/dateTime';
import { getSupabaseClient } from '../utils/supabaseClient';
import { logInterventionEvent } from '../utils/atlasTelemetry';

const ROLE_OPTIONS_BASE = [
  { value: 'chef_site', label: 'Chef de site' },
  { value: 'chef_colonne', label: 'Chef de colonne' },
  { value: 'chef_groupe', label: 'Chef de groupe' },
  { value: 'officier_moyens', label: 'Officier moyens' },
  { value: 'officier_renseignements', label: 'Officier renseignements' }
];

const COMMAND_LEVEL_LABELS: Record<string, string> = {
  group: 'Chef de groupe',
  column: 'Chef de colonne',
  site: 'Chef de site',
  communication: 'Communication OPS'
};

type InterventionHistoryItem = {
  id: string;
  status: string;
  title: string | null;
  created_at: string | null;
  updated_at: string | null;
  address_line1: string | null;
  street_number: string | null;
  street_name: string | null;
  city: string | null;
  incident_number: string | null;
  command_level: string | null;
  role: string | null;
};

const CommandTypeChoice = () => {
  const navigate = useNavigate();
  const { type } = useParams();
  const validTypes = ['group', 'column', 'site', 'communication'] as const;
  const isValidType = (value: string | undefined): value is (typeof validTypes)[number] =>
    !!value && validTypes.includes(value as (typeof validTypes)[number]);
  const currentType = isValidType(type) ? type : null;
  const isExtendedOps = type === 'column' || type === 'site';
  const soiecLabel = isExtendedOps ? 'SAOIECL' : 'SOIEC';
  const roleOptions = isExtendedOps
    ? [
        ...ROLE_OPTIONS_BASE,
        { value: 'officier_anticipation', label: 'Officier anticipation' }
      ]
    : ROLE_OPTIONS_BASE;
  const [showInterventionModal, setShowInterventionModal] = React.useState(false);
  const [showMetadataModal, setShowMetadataModal] = React.useState(false);
  const [showHistoryModal, setShowHistoryModal] = React.useState(false);
  const [historyStatus, setHistoryStatus] = React.useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [historyError, setHistoryError] = React.useState<string | null>(null);
  const [historyItems, setHistoryItems] = React.useState<InterventionHistoryItem[]>([]);
  const [historyActionId, setHistoryActionId] = React.useState<string | null>(null);
  const [interventionMeta, setInterventionMeta] = React.useState({
    streetNumber: '',
    streetName: '',
    city: '',
    date: '',
    time: '',
    role: ''
  });
  const [isCreatingIntervention, setIsCreatingIntervention] = React.useState(false);
  const [createInterventionError, setCreateInterventionError] = React.useState<string | null>(null);
  const [isGeolocating, setIsGeolocating] = React.useState(false);
  const [geoError, setGeoError] = React.useState<string | null>(null);
  const storedStreetNumber = useInterventionStore((s) => s.streetNumber);
  const storedStreetName = useInterventionStore((s) => s.streetName);
  const storedCity = useInterventionStore((s) => s.city);
  const storedRole = useInterventionStore((s) => s.role);
  const setStoredStreetNumber = useInterventionStore((s) => s.setStreetNumber);
  const setStoredStreetName = useInterventionStore((s) => s.setStreetName);
  const setStoredCity = useInterventionStore((s) => s.setCity);
  const setInterventionAddress = useInterventionStore((s) => s.setInterventionAddress);
  const setLogicalIds = useInterventionStore((s) => s.setLogicalIds);
  const setStoredRole = useInterventionStore((s) => s.setRole);
  const setStoredLocation = useInterventionStore((s) => s.setLocation);
  const setCurrentIntervention = useInterventionStore((s) => s.setCurrentIntervention);
  const clearCurrentIntervention = useInterventionStore((s) => s.clearCurrentIntervention);
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
      clearCurrentIntervention();
      navigate(`/situation/${currentType}/dictate`);
      return;
    }
    setShowInterventionModal(true);
  };

  const resetMeta = () => {
    const now = new Date();
    const defaultDate = getLocalDate(now);
    const defaultTime = getLocalTime(now);
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
    setCreateInterventionError(null);
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

  const buildAddressLine = (item: InterventionHistoryItem) => (
    item.address_line1?.trim()
    || [item.street_number, item.street_name].filter(Boolean).join(' ').trim()
  );

  const buildCityLine = (item: InterventionHistoryItem) => item.city?.trim();

  const formatHistoryDate = (value: string | null) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const fetchHistory = React.useCallback(async () => {
    if (!currentType) return;
    setHistoryStatus('loading');
    setHistoryError(null);
    const supabase = getSupabaseClient();
    if (!supabase) {
      setHistoryStatus('error');
      setHistoryError('Configuration Supabase manquante.');
      return;
    }
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const userId = authData.user?.id;
      if (!userId) throw new Error('Utilisateur non authentifié.');
      const { data, error } = await supabase
        .from('intervention_members')
        .select('intervention_id, role, command_level, interventions ( id, title, status, created_at, updated_at, address_line1, street_number, street_name, city, incident_number )')
        .eq('user_id', userId);
      if (error) throw error;
      const normalized = (data ?? []).map((row) => {
        const intervention = (row as { interventions?: Record<string, unknown> }).interventions ?? {};
        return {
          id: (intervention.id as string) || row.intervention_id,
          status: (intervention.status as string) || 'open',
          title: (intervention.title as string) ?? null,
          created_at: (intervention.created_at as string) ?? null,
          updated_at: (intervention.updated_at as string) ?? null,
          address_line1: (intervention.address_line1 as string) ?? null,
          street_number: (intervention.street_number as string) ?? null,
          street_name: (intervention.street_name as string) ?? null,
          city: (intervention.city as string) ?? null,
          incident_number: (intervention.incident_number as string) ?? null,
          command_level: row.command_level ?? null,
          role: row.role ?? null
        } satisfies InterventionHistoryItem;
      }).filter((item) => item.id && (!item.command_level || item.command_level === currentType));
      normalized.sort((a, b) => {
        const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
        const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
        return dateB - dateA;
      });
      setHistoryItems(normalized);
      setHistoryStatus('ready');
    } catch (error) {
      console.error('Erreur chargement historique', error);
      const message = error instanceof Error ? error.message : 'Impossible de charger l’historique.';
      setHistoryError(message);
      setHistoryStatus('error');
    }
  }, [currentType]);

  const handleResumeIntervention = () => {
    if (!currentType) return;
    clearCurrentIntervention();
    setShowInterventionModal(false);
    setShowHistoryModal(true);
    void fetchHistory();
  };

  const handleResumeFromHistory = async (item: InterventionHistoryItem) => {
    const targetType = (item.command_level || currentType) as typeof currentType;
    if (!targetType) return;
    setHistoryActionId(item.id);
    setHistoryError(null);
    const supabase = getSupabaseClient();
    try {
      if (!supabase) {
        throw new Error('Configuration Supabase manquante.');
      }
      const canUpdate = item.role === 'owner' || item.role === 'admin';
      if (item.status === 'closed' && canUpdate) {
        const { error } = await supabase.from('interventions').update({ status: 'open' }).eq('id', item.id);
        if (error) throw error;
        await logInterventionEvent(
          item.id,
          'INTERVENTION_REOPENED',
          { reopened_at: new Date().toISOString() },
          { ui_context: 'intervention.history' }
        );
      }
      const startedAtMs = item.created_at ? new Date(item.created_at).getTime() : Date.now();
      navigate(`/situation/${targetType}/dictate`, { state: { mode: 'resume', interventionId: item.id, startedAtMs } });
      setShowHistoryModal(false);
    } catch (error) {
      console.error('Erreur reprise intervention', error);
      const message = error instanceof Error ? error.message : 'Impossible de rouvrir l’intervention.';
      setHistoryError(message);
    } finally {
      setHistoryActionId(null);
    }
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
  }, []);

  const parseInviteToken = React.useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith(INTERVENTION_INVITE_PREFIX)) {
      return trimmed.slice(INTERVENTION_INVITE_PREFIX.length).trim();
    }
    try {
      const url = new URL(trimmed);
      const tokenParam = url.searchParams.get('token');
      if (tokenParam) return tokenParam.trim();
    } catch {
      void 0;
    }
    const match = trimmed.match(/token=([^&]+)/);
    if (match) {
      try {
        return decodeURIComponent(match[1]).trim();
      } catch {
        return match[1].trim();
      }
    }
    return trimmed;
  }, []);

  const handleConsumeInvite = React.useCallback(async (rawValue: string) => {
    const token = parseInviteToken(rawValue);
    if (!token) {
      setScanError('Code invalide. Vérifiez la saisie.');
      return;
    }
    stopScanner();
    setScanStatus('loading');
    setScanError(null);
    setShowScanModal(false);
    setScanStatus('idle');
    navigate(`/join?token=${encodeURIComponent(token)}`);
  }, [navigate, parseInviteToken, stopScanner]);

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

  const handleConfirmMetadata = async () => {
    if (!currentType) return;
    setIsCreatingIntervention(true);
    setCreateInterventionError(null);
    const supabase = getSupabaseClient();
    if (!supabase) {
      setCreateInterventionError('Configuration Supabase manquante.');
      setIsCreatingIntervention(false);
      return;
    }
    try {
      const now = new Date();
      const date = interventionMeta.date || getLocalDate(now);
      const time = interventionMeta.time || getLocalTime(now);
      const address = [interventionMeta.streetNumber, interventionMeta.streetName].filter(Boolean).join(' ').trim();
      const payload = {
        address,
        city: interventionMeta.city,
        role: interventionMeta.role,
        date,
        time
      };

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) throw new Error('Vous devez être connecté pour créer une intervention.');
      const userId = authData.user.id;

      const title = payload.address || payload.city ? `Intervention - ${payload.address || payload.city}` : 'Intervention ATLAS';
      const { data: created, error: createErr } = await supabase
        .from('interventions')
        .insert({
          title,
          created_by: userId,
          address_line1: address || null,
          street_number: interventionMeta.streetNumber || null,
          street_name: interventionMeta.streetName || null,
          city: interventionMeta.city || null
        })
        .select('id, oi_logical_id, conduite_logical_id')
        .single();

      if (createErr) throw createErr;
      const interventionId = created?.id as string | undefined;
      if (!interventionId) throw new Error('Intervention ID manquant après création.');

      const { error: memberErr } = await supabase
        .from('intervention_members')
        .insert({ intervention_id: interventionId, user_id: userId, role: 'owner', command_level: currentType });
      if (memberErr) throw memberErr;

      const startedAtMs = Date.now();
      setCurrentIntervention(interventionId, startedAtMs);
      setInterventionAddress({
        address,
        streetNumber: interventionMeta.streetNumber,
        streetName: interventionMeta.streetName,
        city: interventionMeta.city
      });
      setLogicalIds({
        oiLogicalId: created?.oi_logical_id ?? null,
        conduiteLogicalId: created?.conduite_logical_id ?? null
      });
      try {
        await logInterventionEvent(
          interventionId,
          'INTERVENTION_CREATED_VALIDATED',
          {
            ...payload,
            street_number: interventionMeta.streetNumber,
            street_name: interventionMeta.streetName,
            command_level: currentType
          },
          {
            duration_ms: 0,
            edit_count: 0,
            source: 'keyboard',
            ui_context: 'command_type_choice',
            elapsed_ms_since_intervention_start: Date.now() - startedAtMs
          }
        );
      } catch (telemetryError) {
        console.error('Erreur log telemetry intervention', telemetryError);
      }

      setShowMetadataModal(false);
      navigate(`/situation/${currentType}/dictate`, {
        state: { mode: 'create', meta: payload, interventionId, startedAtMs }
      });
    } catch (error) {
      console.error('Erreur création intervention', error);
      const message = error instanceof Error ? error.message : "Impossible de créer l'intervention.";
      setCreateInterventionError(message);
    } finally {
      setIsCreatingIntervention(false);
    }
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
              void handleConsumeInvite(barcodes[0].rawValue);
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
  }, [handleConsumeInvite, showScanModal, stopScanner]);

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
                  Démarrer un nouveau raisonnement {soiecLabel} et configurer vos moyens.
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
                    className="w-full py-3 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-900 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white transition font-semibold flex items-center justify-center gap-2"
                  >
                    <History className="w-4 h-4" />
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

      {showHistoryModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-3xl bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-slate-500 dark:text-gray-400 tracking-[0.3em]">Historique</p>
                <h3 className="text-2xl font-bold">Interventions enregistrées</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition"
                aria-label="Fermer la fenêtre"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
              {historyError && (
                <div className="text-sm text-red-600 dark:text-red-300">{historyError}</div>
              )}
              {historyStatus === 'loading' && (
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-gray-300">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Chargement des interventions…
                </div>
              )}
              {historyStatus === 'error' && !historyError && (
                <div className="text-sm text-red-600 dark:text-red-300">Erreur de chargement.</div>
              )}
              {historyStatus === 'ready' && historyItems.length === 0 && (
                <div className="text-sm text-slate-600 dark:text-gray-300">Aucune intervention enregistrée.</div>
              )}
              {historyStatus === 'ready' && historyItems.length > 0 && (
                <div className="space-y-3">
                  {historyItems.map((item) => {
                    const addressLine = buildAddressLine(item);
                    const cityLine = buildCityLine(item);
                    const title = item.incident_number
                      ? `Intervention #${item.incident_number}`
                      : (item.title || 'Intervention ATLAS');
                    const statusLabel = item.status === 'closed' ? 'Clôturée' : 'En cours';
                    const statusClasses = item.status === 'closed'
                      ? 'bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-gray-200'
                      : 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-300';
                    const commandLabel = item.command_level ? (COMMAND_LEVEL_LABELS[item.command_level] || item.command_level) : null;
                    const isBusy = historyActionId === item.id;
                    const canUpdate = item.role === 'owner' || item.role === 'admin';
                    const actionLabel = item.status === 'closed' && canUpdate ? 'Réouvrir et reprendre' : 'Reprendre';
                    return (
                      <div key={item.id} className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-4 py-3 space-y-3">
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                          <div className="space-y-1">
                            <div className="text-sm font-semibold text-slate-900 dark:text-white">{title}</div>
                            {(addressLine || cityLine) && (
                              <div className="text-xs text-slate-500 dark:text-gray-400">
                                {[addressLine, cityLine].filter(Boolean).join(', ')}
                              </div>
                            )}
                            <div className="text-[11px] text-slate-400 dark:text-gray-500">
                              {formatHistoryDate(item.updated_at || item.created_at)}
                              {commandLabel ? ` • ${commandLabel}` : ''}
                            </div>
                          </div>
                          <div className="flex flex-col items-start md:items-end gap-2">
                            <span className={`text-[10px] px-2 py-1 rounded-full ${statusClasses}`}>{statusLabel}</span>
                            <button
                              type="button"
                              onClick={() => handleResumeFromHistory(item)}
                              disabled={isBusy}
                              className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition disabled:opacity-60"
                            >
                              {isBusy ? 'Ouverture…' : actionLabel}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => void fetchHistory()}
                className="px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm dark:bg-white/10 dark:hover:bg-white/20 dark:text-white transition"
              >
                Rafraîchir
              </button>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm transition"
              >
                Fermer
              </button>
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
                    placeholder={`${INTERVENTION_INVITE_PREFIX}...`}
                  />
                  <button
                    type="button"
                    onClick={() => handleConsumeInvite(scanManualCode)}
                    disabled={scanStatus === 'loading'}
                    className="px-4 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold transition disabled:opacity-60"
                  >
                    Valider
                  </button>
                </div>
                <p className="text-xs text-slate-500 dark:text-gray-400">Scannez le QR code ou collez le code d'invitation.</p>
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
                  {roleOptions.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 justify-end">
              {createInterventionError && (
                <p className="text-xs text-red-500 mr-auto">{createInterventionError}</p>
              )}
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
                disabled={isCreatingIntervention}
                className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold transition"
              >
                {isCreatingIntervention ? 'Création...' : 'Valider'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommandTypeChoice;
