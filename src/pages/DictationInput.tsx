import React, { useState, useRef, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Sparkles, ClipboardCopy, Share2, FileText, ImageDown, Check, QrCode, LocateFixed, Archive, Clock, Mic, MicOff } from 'lucide-react';
import { SpeechRecognitionService } from '../utils/speechRecognition';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { saveDictationData, saveCommunicationData } from '../utils/dataStore';
import QRCode from 'react-qr-code';
import DominantSelector, { DominanteType } from '../components/DominantSelector';
import OrdreInitialView from '../components/OrdreInitialView';
import { OrdreInitial } from '../types/soiec';
import {
  buildMessageDemandesSummary,
  buildMessageSurLesLieuxSummary,
  formatExecutionValue,
  formatIdeeManoeuvreList,
  formatSoiecList,
  getSimpleSectionContentList,
  getSimpleSectionText
} from '../utils/soiec';
import { exportBoardDesignImage, exportBoardDesignPdf, exportBoardDesignWordEditable, exportOrdreToClipboard, exportOrdreToImage, exportOrdreToPdf, shareOrdreAsText } from '../utils/export';
import MeansModal from '../components/MeansModal';
import type { MeanItem } from '../types/means';
import SitacMap from './SitacMap';
import { OctDiagram } from './OctDiagram';
import { resetOctTree, useOctTree } from '../utils/octTreeStore';
import { useInterventionStore, type HydratedOrdreInitial } from '../stores/useInterventionStore';
import { useSitacStore } from '../stores/useSitacStore';
import { useMeansStore } from '../stores/useMeansStore';
import { INTERVENTION_DRAFT_KEY } from '../constants/intervention';
import { useSessionSettings, type MessageCheckboxOption } from '../utils/sessionSettings';
import { useAppSettings, type OperationalTabId } from '../utils/appSettings';
import { getLocalDate, getLocalDateTime, getLocalTime } from '../utils/dateTime';
import { logInterventionEvent, type TelemetryMetrics } from '../utils/atlasTelemetry';
import { telemetryBuffer } from '../utils/telemetryBuffer';
import { debounce } from '../utils/debounce';
import { normalizeMeanItems } from '../utils/means';
import { hydrateIntervention } from '../utils/interventionHydration';
import { useIsaPrompt } from '../utils/useIsaPrompt';
import { useInterventionInvite } from '../hooks/useInterventionInvite';
import { useDictationDraft } from '../hooks/useDictationDraft';
import { useDictationPersistence } from '../hooks/useDictationPersistence';

const getNowStamp = () => {
  const now = new Date();
  return {
    date: getLocalDate(now),
    time: getLocalTime(now)
  };
};

type MessageSelections = Record<string, boolean>;

type MessageDemandes = {
  selections: MessageSelections;
  autresMoyensSp: string;
  moyensSpFpt: string;
  moyensSpEpc: string;
  moyensSpVsav: string;
  moyensSpCcf: string;
  moyensSpVsr: string;
  autres: string;
};

type MessageSurLesLieux = {
  selections: MessageSelections;
  feuEteintHeure: string;
};

const FEU_ETEINT_ID = 'feuEteint';

const MOYENS_SP_FIELDS: Array<{ key: keyof Pick<MessageDemandes, 'moyensSpFpt' | 'moyensSpEpc' | 'moyensSpVsav' | 'moyensSpCcf' | 'moyensSpVsr'>; label: string }> = [
  { key: 'moyensSpFpt', label: 'FPT' },
  { key: 'moyensSpEpc', label: 'EPC' },
  { key: 'moyensSpVsav', label: 'VSAV' },
  { key: 'moyensSpCcf', label: 'CCF' },
  { key: 'moyensSpVsr', label: 'VSR' }
];

const createMessageDemandes = (): MessageDemandes => ({
  selections: {},
  autresMoyensSp: '',
  moyensSpFpt: '',
  moyensSpEpc: '',
  moyensSpVsav: '',
  moyensSpCcf: '',
  moyensSpVsr: '',
  autres: ''
});

const createMessageSurLesLieux = (): MessageSurLesLieux => ({
  selections: {},
  feuEteintHeure: '',
});

type AmbianceMessage = {
  date: string;
  time: string;
  stamped: boolean;
  jeSuis: string;
  jeVois: string;
  jeDemande: string;
  demandes: MessageDemandes;
  surLesLieux: MessageSurLesLieux;
  addressConfirmed: boolean;
};

type CompteRenduMessage = {
  date: string;
  time: string;
  stamped: boolean;
  jeSuis: string;
  jeVois: string;
  jePrevois: string;
  jeFais: string;
  jeDemande: string;
  demandes: MessageDemandes;
  surLesLieux: MessageSurLesLieux;
  addressConfirmed: boolean;
};

type DraftPayload = {
  ordreData?: OrdreInitial;
  selectedRisks?: DominanteType[];
  address?: string;
  city?: string;
  additionalInfo?: string | null;
  orderTime?: string;
  selectedMeans?: unknown[];
  ambianceMessage?: Partial<AmbianceMessage>;
  compteRenduMessage?: Partial<CompteRenduMessage>;
  validatedAmbiance?: Partial<AmbianceMessage>;
  validatedCompteRendu?: Partial<CompteRenduMessage>;
  ordreValidatedAt?: string;
  ordreConduite?: OrdreInitial;
  showConduite?: boolean;
  conduiteValidatedAt?: string;
  conduiteSelectedRisks?: DominanteType[];
  conduiteAddress?: string;
  conduiteCity?: string;
  conduiteAdditionalInfo?: string;
  conduiteOrderTime?: string;
  hasAdditionalInfo?: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

const toStringArray = (value: unknown): string[] | undefined => (
  Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : undefined
);

const toDominanteArray = (value: unknown): DominanteType[] | undefined => {
  const arr = toStringArray(value);
  return arr ? (arr as DominanteType[]) : undefined;
};

const isOrdreInitialLike = (value: unknown): value is OrdreInitial => {
  if (!isRecord(value)) return false;
  const isSimpleSectionValue = (section: unknown) => (
    typeof section === 'string' || Array.isArray(section)
  );
  if (!isSimpleSectionValue(value.S)) return false;
  if (!Array.isArray(value.O)) return false;
  if (!Array.isArray(value.I)) return false;
  if (!('E' in value)) return false;
  if (!isSimpleSectionValue(value.C)) return false;
  return true;
};

const parseDraftPayload = (value: unknown): DraftPayload | null => {
  if (!isRecord(value)) return null;
  const hasAdditionalInfo = Object.prototype.hasOwnProperty.call(value, 'additionalInfo');
  return {
    ordreData: isOrdreInitialLike(value.ordreData) ? value.ordreData : undefined,
    selectedRisks: toDominanteArray(value.selectedRisks),
    address: isNonEmptyString(value.address) ? value.address : undefined,
    city: isNonEmptyString(value.city) ? value.city : undefined,
    additionalInfo: hasAdditionalInfo && typeof value.additionalInfo === 'string' ? value.additionalInfo : null,
    orderTime: isNonEmptyString(value.orderTime) ? value.orderTime : undefined,
    selectedMeans: Array.isArray(value.selectedMeans) ? value.selectedMeans : undefined,
    ambianceMessage: isRecord(value.ambianceMessage) ? value.ambianceMessage : undefined,
    compteRenduMessage: isRecord(value.compteRenduMessage) ? value.compteRenduMessage : undefined,
    validatedAmbiance: isRecord(value.validatedAmbiance) ? value.validatedAmbiance : undefined,
    validatedCompteRendu: isRecord(value.validatedCompteRendu) ? value.validatedCompteRendu : undefined,
    ordreValidatedAt: isNonEmptyString(value.ordreValidatedAt) ? value.ordreValidatedAt : undefined,
    ordreConduite: isOrdreInitialLike(value.ordreConduite) ? value.ordreConduite : undefined,
    showConduite: typeof value.showConduite === 'boolean' ? value.showConduite : undefined,
    conduiteValidatedAt: isNonEmptyString(value.conduiteValidatedAt) ? value.conduiteValidatedAt : undefined,
    conduiteSelectedRisks: toDominanteArray(value.conduiteSelectedRisks),
    conduiteAddress: isNonEmptyString(value.conduiteAddress) ? value.conduiteAddress : undefined,
    conduiteCity: isNonEmptyString(value.conduiteCity) ? value.conduiteCity : undefined,
    conduiteAdditionalInfo: isNonEmptyString(value.conduiteAdditionalInfo) ? value.conduiteAdditionalInfo : undefined,
    conduiteOrderTime: isNonEmptyString(value.conduiteOrderTime) ? value.conduiteOrderTime : undefined,
    hasAdditionalInfo
  };
};

const createAmbianceMessage = (): AmbianceMessage => {
  const { date, time } = getNowStamp();
  return {
    date,
    time,
    stamped: false,
    jeSuis: '',
    jeVois: '',
    jeDemande: '',
    demandes: createMessageDemandes(),
    surLesLieux: createMessageSurLesLieux(),
    addressConfirmed: false
  };
};

const createCompteRenduMessage = (): CompteRenduMessage => {
  const { date, time } = getNowStamp();
  return {
    date,
    time,
    stamped: false,
    jeSuis: '',
    jeVois: '',
    jePrevois: '',
    jeFais: '',
    jeDemande: '',
    demandes: createMessageDemandes(),
    surLesLieux: createMessageSurLesLieux(),
    addressConfirmed: false
  };
};

const normalizeSelections = (input: unknown): MessageSelections => {
  if (!input || typeof input !== 'object') return {};
  const record = input as unknown as Record<string, unknown>;
  return Object.keys(record).reduce<MessageSelections>((acc, key) => {
    if (typeof record[key] === 'boolean') acc[key] = Boolean(record[key]);
    return acc;
  }, {});
};

const normalizeDemandes = (input: unknown): MessageDemandes => {
  const base = createMessageDemandes();
  if (!input || typeof input !== 'object') return base;
  const record = input as unknown as Record<string, unknown>;
  const selections = record.selections && typeof record.selections === 'object'
    ? normalizeSelections(record.selections)
    : normalizeSelections(record);
  return {
    ...base,
    selections,
    autresMoyensSp: typeof record.autresMoyensSp === 'string' ? record.autresMoyensSp : base.autresMoyensSp,
    moyensSpFpt: typeof record.moyensSpFpt === 'string' ? record.moyensSpFpt : base.moyensSpFpt,
    moyensSpEpc: typeof record.moyensSpEpc === 'string' ? record.moyensSpEpc : base.moyensSpEpc,
    moyensSpVsav: typeof record.moyensSpVsav === 'string' ? record.moyensSpVsav : base.moyensSpVsav,
    moyensSpCcf: typeof record.moyensSpCcf === 'string' ? record.moyensSpCcf : base.moyensSpCcf,
    moyensSpVsr: typeof record.moyensSpVsr === 'string' ? record.moyensSpVsr : base.moyensSpVsr,
    autres: typeof record.autres === 'string' ? record.autres : base.autres
  };
};

const normalizeSurLesLieux = (input: unknown): MessageSurLesLieux => {
  const base = createMessageSurLesLieux();
  if (!input || typeof input !== 'object') return base;
  const record = input as unknown as Record<string, unknown>;
  const selections = record.selections && typeof record.selections === 'object'
    ? normalizeSelections(record.selections)
    : normalizeSelections(record);
  return {
    ...base,
    selections,
    feuEteintHeure: typeof record.feuEteintHeure === 'string' ? record.feuEteintHeure : base.feuEteintHeure
  };
};

type DemandesSectionProps = {
  value: MessageDemandes;
  onChange: (next: MessageDemandes) => void;
  options: MessageCheckboxOption[];
};

const DemandesSection: React.FC<DemandesSectionProps> = ({ value, onChange, options }) => {
  const toggleOption = (id: string) => {
    onChange({ ...value, selections: { ...value.selections, [id]: !value.selections[id] } });
  };

  const handleFieldChange = (key: keyof MessageDemandes, nextValue: string) => {
    onChange({ ...value, [key]: nextValue });
  };

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-white/5 p-3">
      <div className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-gray-400">Je demande (cases à cocher)</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {options.map((opt) => (
          <label key={opt.id} className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-gray-200">
            <input
              type="checkbox"
              checked={Boolean(value.selections[opt.id])}
              onChange={() => toggleOption(opt.id)}
              className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
            />
            {opt.label}
          </label>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[1.1fr,1.2fr] gap-3 md:items-end">
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-gray-400 md:min-h-[28px] md:flex md:items-end">Autres moyens SP</label>
          <input
            value={value.autresMoyensSp}
            onChange={(e) => handleFieldChange('autresMoyensSp', e.target.value)}
            placeholder="Précisions"
            className="w-full bg-white dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-gray-400 md:min-h-[28px] md:flex md:items-end">Moyens Sapeurs-Pompiers</label>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {MOYENS_SP_FIELDS.map(({ key, label }) => (
              <div key={key} className="flex flex-col gap-1">
                <span className="text-[10px] uppercase text-slate-500 dark:text-gray-400">{label}</span>
                <input
                  value={value[key]}
                  onChange={(e) => handleFieldChange(key, e.target.value)}
                  inputMode="numeric"
                  placeholder="0"
                  className="w-full bg-white dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-sm text-slate-800 dark:text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-gray-400">Autre(s)</label>
        <input
          value={value.autres}
          onChange={(e) => handleFieldChange('autres', e.target.value)}
          placeholder="Autres demandes"
          className="w-full bg-white dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
        />
      </div>
    </div>
  );
};

type SurLesLieuxSectionProps = {
  value: MessageSurLesLieux;
  onChange: (next: MessageSurLesLieux) => void;
  options: MessageCheckboxOption[];
};

const SurLesLieuxSection: React.FC<SurLesLieuxSectionProps> = ({ value, onChange, options }) => {
  const toggleOption = (id: string) => {
    onChange({ ...value, selections: { ...value.selections, [id]: !value.selections[id] } });
  };
  const feuEteintOption = options.find((opt) => opt.id === FEU_ETEINT_ID);

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-white/5 p-3">
      <div className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-gray-400">Sur les lieux</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {options.filter((opt) => opt.id !== FEU_ETEINT_ID).map((opt) => (
          <label key={opt.id} className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-gray-200">
            <input
              type="checkbox"
              checked={Boolean(value.selections[opt.id])}
              onChange={() => toggleOption(opt.id)}
              className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
            />
            {opt.label}
          </label>
        ))}
        {feuEteintOption && (
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-gray-200">
              <input
                type="checkbox"
                checked={Boolean(value.selections[FEU_ETEINT_ID])}
                onChange={() => toggleOption(FEU_ETEINT_ID)}
                className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
              />
              {feuEteintOption.label}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={value.feuEteintHeure}
                onChange={(e) => onChange({ ...value, feuEteintHeure: e.target.value })}
                disabled={!value.selections[FEU_ETEINT_ID]}
                className="w-28 bg-white dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-sm text-slate-800 dark:text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 disabled:opacity-60"
              />
              <span className="text-xs text-slate-500 dark:text-gray-400">hrs</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ADDITIONAL_INFO_PLACEHOLDER = 'Exemples : type de bâtiment, ETARE, raison sociale';
const ISA_PROMPT_ENABLED = false;

const DictationInput = () => {
  const { type } = useParams();
  const isExtendedOps = type === 'column' || type === 'site';
  const roleLabel = type === 'column'
    ? 'Chef de colonne'
    : type === 'site'
      ? 'Chef de site'
      : type === 'group'
        ? 'Chef de groupe'
        : undefined;
  const [ordreData, setOrdreData] = useState<OrdreInitial | null>(null);
  const [selectedRisks, setSelectedRisks] = useState<DominanteType[]>([]);
  const address = useInterventionStore((s) => s.address);
  const city = useInterventionStore((s) => s.city);
  const setAddress = useInterventionStore((s) => s.setAddress);
  const setCity = useInterventionStore((s) => s.setCity);
  const setLocation = useInterventionStore((s) => s.setLocation);
  const currentInterventionId = useInterventionStore((s) => s.currentInterventionId);
  const interventionStartedAtMs = useInterventionStore((s) => s.interventionStartedAtMs);
  const interventionStatus = useInterventionStore((s) => s.interventionStatus);
  const setInterventionMetaState = useInterventionStore((s) => s.setInterventionMeta);
  const setCurrentIntervention = useInterventionStore((s) => s.setCurrentIntervention);
  const clearCurrentIntervention = useInterventionStore((s) => s.clearCurrentIntervention);
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [soiecAddressValidated, setSoiecAddressValidated] = useState(false);
  const [soiecTimeValidated, setSoiecTimeValidated] = useState(false);
  const [orderTime, setOrderTime] = useState<string>(() => getLocalDateTime(new Date()));

  const [isGeolocating, setIsGeolocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [ordreValidatedAt, setOrdreValidatedAt] = useState<string | null>(null);
  const [conduiteValidatedAt, setConduiteValidatedAt] = useState<string | null>(null);
  const isOiLocked = Boolean(ordreValidatedAt && !isExtendedOps);
  const [ordreConduite, setOrdreConduite] = useState<OrdreInitial | null>(null);
  const [showConduite, setShowConduite] = useState(false);
  const [conduiteSelectedRisks, setConduiteSelectedRisks] = useState<DominanteType[]>([]);
  const [conduiteAddress, setConduiteAddress] = useState('');
  const [conduiteCity, setConduiteCity] = useState('');
  const [conduiteAdditionalInfo, setConduiteAdditionalInfo] = useState('');
  const [conduiteOrderTime, setConduiteOrderTime] = useState('');
  const [conduiteTimeValidated, setConduiteTimeValidated] = useState(false);
  const location = useLocation();
  const [showShareHint, setShowShareHint] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [shareStatus, setShareStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [lastOiValidatedAt, setLastOiValidatedAt] = useState<string | null>(null);
  const hydratedOrdreInitial = useInterventionStore((s) => s.hydratedOrdreInitial);
  const hydratedOrdreConduite = useInterventionStore((s) => s.hydratedOrdreConduite);
  const ordreInitialHistory = useInterventionStore((s) => s.ordreInitialHistory);
  const ordreConduiteHistory = useInterventionStore((s) => s.ordreConduiteHistory);
  const conduiteLogicalId = useInterventionStore((s) => s.conduiteLogicalId);
  const lastHydratedInterventionId = useInterventionStore((s) => s.lastHydratedInterventionId);
  const selectedMeans = useMeansStore((s) => s.selectedMeans);
  const setSelectedMeans = useMeansStore((s) => s.setSelectedMeans);
  const meansHydrationId = useMeansStore((s) => s.hydrationId);
  const { tree: octTree } = useOctTree();
  const { settings: appSettings } = useAppSettings();
  const defaultTab = appSettings.defaultOperationalTab as OperationalTabId;
  const [activeTab, setActiveTab] = useState<'soiec' | 'moyens' | 'oct' | 'message' | 'sitac' | 'aide'>(() => defaultTab || 'moyens');
  const [ambianceMessage, setAmbianceMessage] = useState<AmbianceMessage>(() => createAmbianceMessage());
  const [compteRenduMessage, setCompteRenduMessage] = useState<CompteRenduMessage>(() => createCompteRenduMessage());
  const [validatedAmbiance, setValidatedAmbiance] = useState<AmbianceMessage | null>(null);
  const [validatedCompteRendu, setValidatedCompteRendu] = useState<CompteRenduMessage | null>(null);
  // Dictée vocale — onglet Messages
  const [listeningField, setListeningField] = useState<string | null>(null);
  const [dictationError, setDictationError] = useState<string | null>(null);
  const speechServiceRef = useRef<SpeechRecognitionService | null>(null);

  const ensureSpeechService = useCallback(() => {
    if (!speechServiceRef.current) {
      speechServiceRef.current = new SpeechRecognitionService();
    }
    return speechServiceRef.current;
  }, []);

  const stopDictation = useCallback(() => {
    ensureSpeechService().stop();
    setListeningField(null);
  }, [ensureSpeechService]);

  const startDictation = useCallback((
    field: string,
    setValue: (v: string) => void
  ) => {
    const service = ensureSpeechService();
    setDictationError(null);
    if (!service.isRecognitionSupported()) {
      setDictationError('La reconnaissance vocale n\'est pas supportée par votre navigateur.');
      return;
    }
    service.start({
      onStart: () => setListeningField(field),
      onEnd: () => setListeningField(null),
      onError: (err) => {
        setListeningField(null);
        setDictationError(err.message || 'Erreur de dictée');
      },
      onResult: (text) => setValue(text),
    });
  }, [ensureSpeechService]);

  const [messageSubTab, setMessageSubTab] = useState<'ambiance' | 'compte-rendu'>('ambiance');
  const [validatedMessagesExpanded, setValidatedMessagesExpanded] = useState(false);
  const boardRef = React.useRef<HTMLDivElement>(null);
  const previousTabRef = React.useRef(activeTab);
  const lastAppliedHydrationRef = React.useRef<string | null>(null);
  const lastAppliedConduiteRef = React.useRef<string | null>(null);
  const lastMeansStateRef = React.useRef<string>('');
  const draftSnapshotStateRef = React.useRef<{
    lastSentAt: number;
    pendingTimer: number | null;
    failureCount: number;
    lastQueuedHash: string;
    lastSentHash: string;
  }>({
    lastSentAt: 0,
    pendingTimer: null,
    failureCount: 0,
    lastQueuedHash: '',
    lastSentHash: ''
  });
  const skipMeansSyncRef = React.useRef<{ interventionId: string | null; hydrationId: number }>({
    interventionId: currentInterventionId,
    hydrationId: meansHydrationId
  });
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closeNotice, setCloseNotice] = useState<string | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [octResetKey, setOctResetKey] = useState(0);
  const [meansResetKey, setMeansResetKey] = useState(0);
  const [sitacResetKey, setSitacResetKey] = useState(0);
  const setExternalSearch = useSitacStore((s) => s.setExternalSearch);
  const { settings } = useSessionSettings();
  const { submitIsa } = useIsaPrompt({
    interventionId: currentInterventionId,
    enabled: ISA_PROMPT_ENABLED
  });
  const { generateShareLink } = useInterventionInvite();
  const fullAddress = React.useMemo(
    () => [address, city].filter(Boolean).join(', '),
    [address, city]
  );
  const hasHistory = ordreInitialHistory.length > 0 || ordreConduiteHistory.length > 0;
  const formatHistoryTimestamp = React.useCallback((value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }, []);

  const prepareOrdreData = React.useCallback((source: OrdreInitial): OrdreInitial => {
    const next = JSON.parse(JSON.stringify(source)) as OrdreInitial;
    if (isExtendedOps) {
      next.A = [];
      next.L = [];
    }
    return next;
  }, [isExtendedOps]);

  const applyOrdreInitialPayload = React.useCallback(
    (payload: HydratedOrdreInitial, options?: { resetValidation?: boolean }) => {
      const nextOrdre = prepareOrdreData(payload.ordreData);
      setOrdreData(nextOrdre);
      setSelectedRisks(payload.selectedRisks ?? []);
      setAdditionalInfo(payload.additionalInfo ?? '');
      if (payload.address) setAddress(payload.address);
      if (payload.city) setCity(payload.city);
      if (payload.orderTime) setOrderTime(payload.orderTime);
      if (options?.resetValidation) {
        setOrdreValidatedAt(null);
      } else if (!isExtendedOps && payload.validatedAtLabel) {
        setOrdreValidatedAt(payload.validatedAtLabel);
      }
      if (payload.validatedAtLabel) setLastOiValidatedAt(payload.validatedAtLabel);
    },
    [
      isExtendedOps,
      prepareOrdreData,
      setAddress,
      setCity,
      setOrdreData,
      setSelectedRisks,
      setAdditionalInfo,
      setOrderTime,
      setOrdreValidatedAt,
      setLastOiValidatedAt
    ]
  );

  const handleLoadOrdreInitialHistory = React.useCallback((entry: HydratedOrdreInitial) => {
    applyOrdreInitialPayload(entry, { resetValidation: true });
    setHistoryModalOpen(false);
  }, [applyOrdreInitialPayload]);

  React.useEffect(() => {
    setShareStatus('idle');
    setShareError(null);
    setShareLink(null);
    setHistoryModalOpen(false);
  }, [currentInterventionId]);

  React.useEffect(() => {
    if (currentInterventionId) return;
    setSyncStatus('idle');
    setLastOiValidatedAt(null);
  }, [currentInterventionId]);

  React.useEffect(() => {
    if (!currentInterventionId) return;
    if (lastHydratedInterventionId === currentInterventionId) {
      setSyncStatus('ready');
      return;
    }
    setSyncStatus('loading');
    hydrateIntervention(currentInterventionId)
      .then((result) => {
        setSyncStatus('ready');
        if (result.ordreInitial?.validatedAtLabel) {
          setLastOiValidatedAt(result.ordreInitial.validatedAtLabel);
        } else {
          setLastOiValidatedAt(null);
        }
      })
      .catch((error) => {
        console.error('Erreur de synchronisation intervention', error);
        setSyncStatus('error');
      });
  }, [currentInterventionId, lastHydratedInterventionId]);

  React.useEffect(() => {
    if (!currentInterventionId) return;
    if (lastHydratedInterventionId !== currentInterventionId) return;
    if (!hydratedOrdreInitial) return;
    if (lastAppliedHydrationRef.current === currentInterventionId) return;
    if (ordreData) return;
    lastAppliedHydrationRef.current = currentInterventionId;

    applyOrdreInitialPayload(hydratedOrdreInitial, { resetValidation: isExtendedOps });
  }, [applyOrdreInitialPayload, currentInterventionId, hydratedOrdreInitial, isExtendedOps, lastHydratedInterventionId, ordreData]);

  React.useEffect(() => {
    if (!currentInterventionId) return;
    if (lastHydratedInterventionId !== currentInterventionId) return;
    if (!hydratedOrdreConduite) return;
    if (lastAppliedConduiteRef.current === currentInterventionId) return;
    if (ordreConduite || conduiteValidatedAt) return;
    lastAppliedConduiteRef.current = currentInterventionId;

    setShowConduite(true);
    if (hydratedOrdreConduite.conduiteSelectedRisks?.length) {
      setConduiteSelectedRisks(hydratedOrdreConduite.conduiteSelectedRisks);
    }
    if (hydratedOrdreConduite.conduiteAddress) setConduiteAddress(hydratedOrdreConduite.conduiteAddress);
    if (hydratedOrdreConduite.conduiteCity) setConduiteCity(hydratedOrdreConduite.conduiteCity);
    if (hydratedOrdreConduite.conduiteAdditionalInfo !== undefined) {
      setConduiteAdditionalInfo(hydratedOrdreConduite.conduiteAdditionalInfo ?? '');
    }
    if (hydratedOrdreConduite.conduiteOrderTime) setConduiteOrderTime(hydratedOrdreConduite.conduiteOrderTime);
    if (hydratedOrdreConduite.ordreConduite) setOrdreConduite(hydratedOrdreConduite.ordreConduite);
    if (hydratedOrdreConduite.validatedAtLabel) {
      setConduiteValidatedAt(hydratedOrdreConduite.validatedAtLabel);
    }
  }, [conduiteValidatedAt, currentInterventionId, hydratedOrdreConduite, lastHydratedInterventionId, ordreConduite]);

  const buildInterventionMetrics = React.useCallback(
    (uiContext: string, overrides?: Partial<TelemetryMetrics>): TelemetryMetrics => {
      const elapsed = interventionStartedAtMs ? Date.now() - interventionStartedAtMs : undefined;
      const base: TelemetryMetrics = {
        duration_ms: 0,
        edit_count: 0,
        source: 'keyboard',
        ui_context: uiContext
      };
      if (typeof elapsed === 'number' && Number.isFinite(elapsed)) {
        base.elapsed_ms_since_intervention_start = elapsed;
      }
      return { ...base, ...overrides };
    },
    [interventionStartedAtMs]
  );

  const logInterventionEventSafe = React.useCallback(
    <TData,>(
      eventType: string,
      data: TData,
      metrics?: Partial<TelemetryMetrics>,
      context?: Record<string, unknown>,
      options?: { logical_id?: string }
    ) => {
      if (!currentInterventionId) {
        console.error(`[telemetry] Missing interventionId for ${eventType}`);
        return;
      }
      void logInterventionEvent(currentInterventionId, eventType, data, metrics, context, options).catch((error) => {
        console.error(`[telemetry] Failed to log ${eventType}`, error);
      });
    },
    [currentInterventionId]
  );

  const normalizeMeans = React.useCallback((value: unknown): MeanItem[] => (
    normalizeMeanItems(Array.isArray(value) ? value : undefined)
  ), []);

  const {
    closeError,
    closeStatus,
    isInterventionClosed,
    closeIntervention: closeActiveIntervention,
    persistMeansState,
    sendDraftSnapshot,
    clearCloseError
  } = useDictationPersistence({
    currentInterventionId,
    interventionStatus,
    normalizeMeans,
    buildInterventionMetrics,
    onStatusChange: (status) => {
      setInterventionMetaState({ status });
    }
  });

  const closeButtonLabel = closeStatus === 'loading' ? 'Clôture…' : isInterventionClosed ? 'Clôturée' : 'Clôturer';
  const isCloseDisabled = !currentInterventionId || closeStatus === 'loading' || isInterventionClosed;

  const handleLocateAddress = React.useCallback(() => {
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
          const addressData = data?.address || {};
          const streetNumber = addressData.house_number || '';
          const streetName = addressData.road || '';
          const streetLine = [streetNumber, streetName].filter(Boolean).join(' ').trim();
          const cityValue = addressData.city || addressData.town || addressData.village || addressData.municipality || addressData.county || '';
          const addressValue = streetLine || data?.display_name || '';
          setLocation({
            lat: latitude,
            lng: longitude,
            address: addressValue || undefined,
            city: cityValue || undefined,
            streetNumber: streetNumber || undefined,
            streetName: streetName || undefined
          });
          setSoiecAddressValidated(false);
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
  }, [setLocation]);

  const soiecLabel = isExtendedOps ? 'SAOIECL' : 'SOIEC';
  const tabs = [
    { id: 'moyens' as const, label: 'Moyens' },
    { id: 'message' as const, label: 'Messages' },
    { id: 'soiec' as const, label: soiecLabel },
    { id: 'oct' as const, label: 'OCT' },
    { id: 'sitac' as const, label: 'SITAC' },
    { id: 'aide' as const, label: 'Aide opérationnelle' }
  ];

  const renderTabContent = () => {
    if (activeTab === 'soiec') {
      return (
        <div className="flex flex-col gap-4 md:gap-5">
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-[1.4fr,0.6fr] gap-3">
              <div className="space-y-1 md:w-[70%]">
                <label className="text-sm font-medium text-slate-600 dark:text-gray-400 ml-2">Adresse de l'intervention</label>
                <div className="relative">
                  <input
                    value={address}
                    onChange={(e) => {
                      setAddress(e.target.value);
                      setSoiecAddressValidated(false);
                    }}
                    placeholder="Ex: 12 rue de la Paix"
                    disabled={isOiLocked}
                    className="w-full bg-slate-100 dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-2xl px-3 py-2.5 pr-10 text-slate-800 dark:text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  {!isOiLocked && (
                    <button type="button" onClick={() => listeningField === 'addr' ? stopDictation() : startDictation('addr', (v) => { setAddress(v); setSoiecAddressValidated(false); })} className={`absolute inset-y-0 right-2 flex items-center p-1.5 rounded-lg transition ${listeningField === 'addr' ? 'text-red-400 bg-red-500/10' : 'text-slate-400 hover:text-blue-500 hover:bg-blue-500/10'}`} title={listeningField === 'addr' ? 'Arrêter la dictée' : 'Dicter'}>
                      {listeningField === 'addr' ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600 dark:text-gray-400 ml-2">Ville</label>
                <div className="flex items-center gap-2">
                  <input
                    value={city}
                    onChange={(e) => {
                      setCity(e.target.value);
                      setSoiecAddressValidated(false);
                    }}
                    placeholder="Ville de l'intervention"
                    disabled={isOiLocked}
                    className="flex-1 md:flex-[0.7] bg-slate-100 dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-2xl px-3 py-2.5 text-slate-800 dark:text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  <button
                    type="button"
                    onClick={handleLocateAddress}
                    disabled={isGeolocating || isOiLocked}
                    className="p-3 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-red-300 dark:hover:border-red-500/40 text-slate-600 dark:text-gray-300 hover:text-red-500 dark:hover:text-red-400 transition disabled:opacity-60 disabled:cursor-not-allowed"
                    aria-label="Utiliser ma position"
                    title="Utiliser ma position"
                  >
                    <LocateFixed className={`w-4 h-4 ${isGeolocating ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSoiecAddressValidated(true)}
                    disabled={!fullAddress.trim() || isOiLocked}
                    className={`inline-flex items-center gap-2 px-3 py-2.5 rounded-2xl border text-sm font-semibold transition btn-success ${
                      soiecAddressValidated
                        ? 'bg-emerald-600/15 text-emerald-700 border-emerald-300 dark:text-emerald-300 dark:border-emerald-500/40'
                        : ''
                    } ${!fullAddress.trim() ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <Check className="w-4 h-4" />
                    Valider
                  </button>
                </div>
                {geoError && (
                  <div className="text-xs text-red-500">{geoError}</div>
                )}
                {soiecAddressValidated && (
                  <div className="text-xs text-emerald-600 dark:text-emerald-400">Adresse validée.</div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[1.4fr,0.6fr] gap-3">
              <div className="space-y-1 md:w-[70%]">
                <label className="text-sm font-medium text-slate-600 dark:text-gray-400 ml-2">Renseignements complémentaires</label>
                <div className="relative">
                  <input
                    value={additionalInfo}
                    onChange={(e) => setAdditionalInfo(e.target.value)}
                    placeholder={ADDITIONAL_INFO_PLACEHOLDER}
                    disabled={isOiLocked}
                    className="w-full bg-slate-100 dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-2xl px-3 py-2.5 pr-10 text-slate-800 dark:text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  {!isOiLocked && (
                    <button type="button" onClick={() => listeningField === 'addInfo' ? stopDictation() : startDictation('addInfo', (v) => setAdditionalInfo(v))} className={`absolute inset-y-0 right-2 flex items-center p-1.5 rounded-lg transition ${listeningField === 'addInfo' ? 'text-red-400 bg-red-500/10' : 'text-slate-400 hover:text-blue-500 hover:bg-blue-500/10'}`} title={listeningField === 'addInfo' ? 'Arrêter la dictée' : 'Dicter'}>
                      {listeningField === 'addInfo' ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600 dark:text-gray-400 ml-2">Groupe horaire</label>
                <div className="flex items-center gap-2">
                  <input
                    type="datetime-local"
                    value={orderTime}
                    onChange={(e) => {
                      setOrderTime(e.target.value);
                      setSoiecTimeValidated(false);
                    }}
                    disabled={isOiLocked}
                    className="flex-1 md:flex-[0.7] bg-slate-100 dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-2xl px-3 py-2.5 text-slate-800 dark:text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setOrderTime(getLocalDateTime(new Date()));
                      setSoiecTimeValidated(false);
                    }}
                    disabled={isOiLocked}
                    className="p-3 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-blue-300 dark:hover:border-blue-500/40 text-slate-600 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400 transition disabled:opacity-60 disabled:cursor-not-allowed"
                    aria-label="Utiliser l'heure actuelle"
                    title="Utiliser l'heure actuelle"
                  >
                    <Clock className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const nowValue = getLocalDateTime(new Date());
                      setOrderTime((prev) => prev || nowValue);
                      setSoiecTimeValidated(true);
                    }}
                    disabled={isOiLocked}
                    className={`inline-flex items-center gap-2 px-3 py-2.5 rounded-2xl border text-sm font-semibold transition btn-success ${
                      soiecTimeValidated
                        ? 'bg-emerald-600/15 text-emerald-700 border-emerald-300 dark:text-emerald-300 dark:border-emerald-500/40'
                        : ''
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    Valider
                  </button>
                </div>
                {soiecTimeValidated && (
                  <div className="text-xs text-emerald-600 dark:text-emerald-400">Groupe horaire validé.</div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 flex-1 min-w-[260px]">
            <label className="text-sm font-medium text-slate-600 dark:text-gray-400 ml-2 mb-1 block">
              Séléction du domaine de l'intervention (1er = principal, suivants = secondaires)
            </label>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <DominantSelector
                selectedRisks={selectedRisks}
                onChange={setSelectedRisks}
                className="justify-start flex-1"
                disabled={isOiLocked}
              />
              <div className="flex items-center gap-2">
                {hasHistory && (
                  <button
                    onClick={() => setHistoryModalOpen(true)}
                    className="px-3 py-2 rounded-xl text-sm font-semibold bg-white/70 hover:bg-white border border-slate-200 text-slate-700 dark:bg-white/10 dark:hover:bg-white/20 dark:border-white/15 dark:text-gray-200 transition"
                  >
                    Historique
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="w-full text-xs text-slate-500 dark:text-gray-500">
            Brouillon sauvegardé automatiquement sur cet appareil (adresse, heure, contenu).
          </div>
          {import.meta.env.DEV && (
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-gray-500">
              <span>ISA (dev)</span>
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => void submitIsa(value as 1 | 2 | 3 | 4 | 5, 'manual')}
                  className="px-2 py-1 rounded-md btn-neutral transition"
                >
                  {value}
                </button>
              ))}
            </div>
          )}

          <OrdreInitialView
            ordre={ordreData}
            onChange={setOrdreData}
            hideToolbar={true}
            dominante={selectedRisks[0]}
            means={selectedMeans}
            type={type as 'group' | 'column' | 'site' | 'communication'}
            boardRef={boardRef}
            readOnly={isOiLocked}
            interventionId={currentInterventionId}
            aiEventType="SOIEC_AI_GENERATED"
          />
        </div>
      );
    }

    if (activeTab === 'moyens') {
      return (
        <MeansModal
          key={`means-${meansResetKey}`}
          inline
          selected={selectedMeans}
          onChange={setSelectedMeans}
        />
      );
    }

    if (activeTab === 'oct') {
      return (
        <div className="w-full">
          <OctDiagram
            key={`oct-${octResetKey}`}
            embedded
            availableMeans={selectedMeans}
            exportMeta={{ adresse: fullAddress, heure: orderTime }}
          />
        </div>
      );
    }

    if (activeTab === 'message') {
      const isAddressAvailable = Boolean(fullAddress.trim());
      const hasValidatedMessages = Boolean(validatedAmbiance || validatedCompteRendu);
      const demandeOptions = settings.messageDemandeOptions || [];
      const surLesLieuxOptions = settings.messageSurLesLieuxOptions || [];
      const isAmbianceTab = messageSubTab === 'ambiance';
      const ambianceDemandesSummary = validatedAmbiance
        ? buildMessageDemandesSummary(validatedAmbiance.demandes, demandeOptions)
        : [];
      const ambianceSurLesLieuxSummary = validatedAmbiance
        ? buildMessageSurLesLieuxSummary(validatedAmbiance.surLesLieux, surLesLieuxOptions)
        : [];
      const compteRenduDemandesSummary = validatedCompteRendu
        ? buildMessageDemandesSummary(validatedCompteRendu.demandes, demandeOptions)
        : [];
      const compteRenduSurLesLieuxSummary = validatedCompteRendu
        ? buildMessageSurLesLieuxSummary(validatedCompteRendu.surLesLieux, surLesLieuxOptions)
        : [];
      return (
        <div className="space-y-4">
          {hasValidatedMessages && (
            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-white/5 shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => setValidatedMessagesExpanded((v) => !v)}
                className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-slate-50/60 dark:hover:bg-white/5 transition"
              >
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm font-medium text-slate-700 dark:text-gray-200">Messages validés</span>
                  <span className="text-xs text-slate-400 dark:text-gray-500">
                    {[validatedAmbiance && 'Ambiance', validatedCompteRendu && 'Compte rendu'].filter(Boolean).join(' · ')}
                  </span>
                </div>
                <svg
                  className={`w-4 h-4 text-slate-400 transition-transform ${validatedMessagesExpanded ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {validatedMessagesExpanded && (
                <div className="px-4 pb-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {validatedAmbiance && (
                    <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-slate-800 dark:text-gray-100">Ambiance</div>
                        <div className="text-xs text-slate-500 dark:text-gray-400">{validatedAmbiance.date} {validatedAmbiance.time}</div>
                      </div>
                      {[
                        { label: 'Je suis', value: validatedAmbiance.jeSuis },
                        { label: 'Je vois', value: validatedAmbiance.jeVois },
                        { label: 'Je demande', value: validatedAmbiance.jeDemande },
                        { label: 'Demandes', value: ambianceDemandesSummary.join(', ') || null },
                        { label: 'Sur les lieux', value: ambianceSurLesLieuxSummary.join(', ') || null },
                      ].map(({ label, value }) => value ? (
                        <div key={label}>
                          <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-gray-400">{label}</div>
                          <div className="text-sm text-slate-800 dark:text-gray-200 whitespace-pre-wrap">{value}</div>
                        </div>
                      ) : null)}
                    </div>
                  )}
                  {validatedCompteRendu && (
                    <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-slate-800 dark:text-gray-100">Compte rendu</div>
                        <div className="text-xs text-slate-500 dark:text-gray-400">{validatedCompteRendu.date} {validatedCompteRendu.time}</div>
                      </div>
                      {[
                        { label: 'Je suis', value: validatedCompteRendu.jeSuis },
                        { label: 'Je vois', value: validatedCompteRendu.jeVois },
                        { label: 'Je prévois', value: validatedCompteRendu.jePrevois },
                        { label: 'Je fais', value: validatedCompteRendu.jeFais },
                        { label: 'Je demande', value: validatedCompteRendu.jeDemande },
                        { label: 'Demandes', value: compteRenduDemandesSummary.join(', ') || null },
                        { label: 'Sur les lieux', value: compteRenduSurLesLieuxSummary.join(', ') || null },
                      ].map(({ label, value }) => value ? (
                        <div key={label}>
                          <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-gray-400">{label}</div>
                          <div className="text-sm text-slate-800 dark:text-gray-200 whitespace-pre-wrap">{value}</div>
                        </div>
                      ) : null)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-white/5 shadow-sm overflow-hidden">
            {/* Sous-onglets */}
            <div className="flex border-b border-slate-200 dark:border-white/10">
              {([
                { id: 'ambiance', label: "Message d'ambiance", validated: validatedAmbiance },
                { id: 'compte-rendu', label: 'Compte rendu', validated: validatedCompteRendu },
              ] as const).map(({ id, label, validated }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMessageSubTab(id)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition border-b-2 ${
                    messageSubTab === id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-500/5'
                      : 'border-transparent text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200'
                  }`}
                >
                  {validated && <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                  {label}
                </button>
              ))}
            </div>

            <div className="p-4 md:p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500 dark:text-gray-400">{roleLabel || 'Chef de groupe'}</span>
                {!isAddressAvailable && (
                  <span className="text-xs text-amber-600 dark:text-amber-400">Adresse non renseignée</span>
                )}
              </div>

              {/* Date / Heure */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase tracking-[0.25em] text-slate-500 dark:text-gray-400">Date</label>
                    <input
                      type="date"
                      value={isAmbianceTab ? ambianceMessage.date : compteRenduMessage.date}
                      onChange={(e) => isAmbianceTab
                        ? setAmbianceMessage((prev) => ({ ...prev, date: e.target.value, stamped: false }))
                        : setCompteRenduMessage((prev) => ({ ...prev, date: e.target.value, stamped: false }))
                      }
                      className="w-44 bg-white dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 shadow-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase tracking-[0.25em] text-slate-500 dark:text-gray-400">Heure</label>
                    <input
                      type="time"
                      value={isAmbianceTab ? ambianceMessage.time : compteRenduMessage.time}
                      onChange={(e) => isAmbianceTab
                        ? setAmbianceMessage((prev) => ({ ...prev, time: e.target.value, stamped: false }))
                        : setCompteRenduMessage((prev) => ({ ...prev, time: e.target.value, stamped: false }))
                      }
                      className="w-28 bg-white dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 shadow-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const nowStamp = getNowStamp();
                      if (isAmbianceTab) {
                        setAmbianceMessage((prev) => ({ ...prev, stamped: true, date: prev.date || nowStamp.date, time: prev.time || nowStamp.time }));
                      } else {
                        setCompteRenduMessage((prev) => ({ ...prev, stamped: true, date: prev.date || nowStamp.date, time: prev.time || nowStamp.time }));
                      }
                    }}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold transition btn-success ${
                      (isAmbianceTab ? ambianceMessage.stamped : compteRenduMessage.stamped)
                        ? 'bg-emerald-600/15 text-emerald-700 border-emerald-300 dark:text-emerald-300 dark:border-emerald-500/40'
                        : ''
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    Horodater
                  </button>
                </div>
                {(isAmbianceTab ? ambianceMessage.stamped : compteRenduMessage.stamped) && (
                  <div className="text-xs text-emerald-600 dark:text-emerald-400">Date/heure validées.</div>
                )}
              </div>

              {/* Champs */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-sm font-medium text-slate-600 dark:text-gray-300">Je suis</label>
                    <button
                      type="button"
                      onClick={() => {
                        if (!isAddressAvailable) return;
                        if (isAmbianceTab) {
                          setAmbianceMessage((prev) => ({ ...prev, jeSuis: fullAddress, addressConfirmed: true }));
                        } else {
                          setCompteRenduMessage((prev) => ({ ...prev, jeSuis: fullAddress, addressConfirmed: true }));
                        }
                      }}
                      disabled={!isAddressAvailable}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition btn-success ${
                        (isAmbianceTab ? ambianceMessage.addressConfirmed : compteRenduMessage.addressConfirmed)
                          ? 'bg-emerald-600/15 text-emerald-700 border-emerald-300 dark:text-emerald-300 dark:border-emerald-500/40'
                          : ''
                      } ${!isAddressAvailable ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      <Check className="w-4 h-4" />
                      Utiliser l&apos;adresse
                    </button>
                  </div>
                  <div className="relative">
                    <textarea
                      value={isAmbianceTab ? ambianceMessage.jeSuis : compteRenduMessage.jeSuis}
                      onChange={(e) => isAmbianceTab
                        ? setAmbianceMessage((prev) => ({ ...prev, jeSuis: e.target.value, addressConfirmed: false }))
                        : setCompteRenduMessage((prev) => ({ ...prev, jeSuis: e.target.value, addressConfirmed: false }))
                      }
                      rows={2}
                      placeholder="Votre position, votre mission, votre action en cours."
                      className="atlas-resizable-textarea w-full bg-slate-100 dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-2xl px-3 py-2.5 pr-10 text-slate-800 dark:text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 text-sm"
                    />
                    <button type="button"
                      onClick={() => { const fk = isAmbianceTab ? 'amb-jeSuis' : 'cr-jeSuis'; listeningField === fk ? stopDictation() : startDictation(fk, (v) => isAmbianceTab ? setAmbianceMessage(prev => ({ ...prev, jeSuis: v, addressConfirmed: false })) : setCompteRenduMessage(prev => ({ ...prev, jeSuis: v, addressConfirmed: false }))); }}
                      className={`absolute bottom-2 right-2 p-1.5 rounded-lg transition ${(isAmbianceTab ? listeningField === 'amb-jeSuis' : listeningField === 'cr-jeSuis') ? 'text-red-400 bg-red-500/10' : 'text-slate-400 hover:text-blue-500 hover:bg-blue-500/10'}`}
                      title={(isAmbianceTab ? listeningField === 'amb-jeSuis' : listeningField === 'cr-jeSuis') ? 'Arrêter la dictée' : 'Dicter'}
                    >
                      {(isAmbianceTab ? listeningField === 'amb-jeSuis' : listeningField === 'cr-jeSuis') ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-600 dark:text-gray-300">Je vois</label>
                  <div className="relative">
                    <textarea
                      value={isAmbianceTab ? ambianceMessage.jeVois : compteRenduMessage.jeVois}
                      onChange={(e) => isAmbianceTab
                        ? setAmbianceMessage((prev) => ({ ...prev, jeVois: e.target.value }))
                        : setCompteRenduMessage((prev) => ({ ...prev, jeVois: e.target.value }))
                      }
                      rows={2}
                      placeholder={isAmbianceTab ? 'Ce que vous observez sur place.' : 'Ce que vous constatez sur place.'}
                      className="atlas-resizable-textarea w-full bg-slate-100 dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-2xl px-3 py-2.5 pr-10 text-slate-800 dark:text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 text-sm"
                    />
                    <button type="button"
                      onClick={() => { const fk = isAmbianceTab ? 'amb-jeVois' : 'cr-jeVois'; listeningField === fk ? stopDictation() : startDictation(fk, (v) => isAmbianceTab ? setAmbianceMessage(prev => ({ ...prev, jeVois: v })) : setCompteRenduMessage(prev => ({ ...prev, jeVois: v }))); }}
                      className={`absolute bottom-2 right-2 p-1.5 rounded-lg transition ${(isAmbianceTab ? listeningField === 'amb-jeVois' : listeningField === 'cr-jeVois') ? 'text-red-400 bg-red-500/10' : 'text-slate-400 hover:text-blue-500 hover:bg-blue-500/10'}`}
                      title={(isAmbianceTab ? listeningField === 'amb-jeVois' : listeningField === 'cr-jeVois') ? 'Arrêter la dictée' : 'Dicter'}
                    >
                      {(isAmbianceTab ? listeningField === 'amb-jeVois' : listeningField === 'cr-jeVois') ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {!isAmbianceTab && (
                  <>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-600 dark:text-gray-300">Je prévois</label>
                      <div className="relative">
                        <textarea
                          value={compteRenduMessage.jePrevois}
                          onChange={(e) => setCompteRenduMessage((prev) => ({ ...prev, jePrevois: e.target.value }))}
                          rows={2}
                          placeholder="Hypothèses ou prochaines actions."
                          className="atlas-resizable-textarea w-full bg-slate-100 dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-2xl px-3 py-2.5 pr-10 text-slate-800 dark:text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 text-sm"
                        />
                        <button type="button"
                          onClick={() => listeningField === 'cr-jePrevois' ? stopDictation() : startDictation('cr-jePrevois', (v) => setCompteRenduMessage(prev => ({ ...prev, jePrevois: v })))}
                          className={`absolute bottom-2 right-2 p-1.5 rounded-lg transition ${listeningField === 'cr-jePrevois' ? 'text-red-400 bg-red-500/10' : 'text-slate-400 hover:text-blue-500 hover:bg-blue-500/10'}`}
                          title={listeningField === 'cr-jePrevois' ? 'Arrêter la dictée' : 'Dicter'}
                        >
                          {listeningField === 'cr-jePrevois' ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-600 dark:text-gray-300">Je fais</label>
                      <div className="relative">
                        <textarea
                          value={compteRenduMessage.jeFais}
                          onChange={(e) => setCompteRenduMessage((prev) => ({ ...prev, jeFais: e.target.value }))}
                          rows={2}
                          placeholder="Actions en cours ou réalisées."
                          className="atlas-resizable-textarea w-full bg-slate-100 dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-2xl px-3 py-2.5 pr-10 text-slate-800 dark:text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 text-sm"
                        />
                        <button type="button"
                          onClick={() => listeningField === 'cr-jeFais' ? stopDictation() : startDictation('cr-jeFais', (v) => setCompteRenduMessage(prev => ({ ...prev, jeFais: v })))}
                          className={`absolute bottom-2 right-2 p-1.5 rounded-lg transition ${listeningField === 'cr-jeFais' ? 'text-red-400 bg-red-500/10' : 'text-slate-400 hover:text-blue-500 hover:bg-blue-500/10'}`}
                          title={listeningField === 'cr-jeFais' ? 'Arrêter la dictée' : 'Dicter'}
                        >
                          {listeningField === 'cr-jeFais' ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </>
                )}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-600 dark:text-gray-300">Je demande</label>
                  <div className="relative">
                    <textarea
                      value={isAmbianceTab ? ambianceMessage.jeDemande : compteRenduMessage.jeDemande}
                      onChange={(e) => isAmbianceTab
                        ? setAmbianceMessage((prev) => ({ ...prev, jeDemande: e.target.value }))
                        : setCompteRenduMessage((prev) => ({ ...prev, jeDemande: e.target.value }))
                      }
                      rows={2}
                      placeholder="Renforts, moyens, consignes."
                      className="atlas-resizable-textarea w-full bg-slate-100 dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-2xl px-3 py-2.5 pr-10 text-slate-800 dark:text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 text-sm"
                    />
                    <button type="button"
                      onClick={() => { const fk = isAmbianceTab ? 'amb-jeDemande' : 'cr-jeDemande'; listeningField === fk ? stopDictation() : startDictation(fk, (v) => isAmbianceTab ? setAmbianceMessage(prev => ({ ...prev, jeDemande: v })) : setCompteRenduMessage(prev => ({ ...prev, jeDemande: v }))); }}
                      className={`absolute bottom-2 right-2 p-1.5 rounded-lg transition ${(isAmbianceTab ? listeningField === 'amb-jeDemande' : listeningField === 'cr-jeDemande') ? 'text-red-400 bg-red-500/10' : 'text-slate-400 hover:text-blue-500 hover:bg-blue-500/10'}`}
                      title={(isAmbianceTab ? listeningField === 'amb-jeDemande' : listeningField === 'cr-jeDemande') ? 'Arrêter la dictée' : 'Dicter'}
                    >
                      {(isAmbianceTab ? listeningField === 'amb-jeDemande' : listeningField === 'cr-jeDemande') ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <DemandesSection
                  value={isAmbianceTab ? ambianceMessage.demandes : compteRenduMessage.demandes}
                  onChange={(next) => isAmbianceTab
                    ? setAmbianceMessage((prev) => ({ ...prev, demandes: next }))
                    : setCompteRenduMessage((prev) => ({ ...prev, demandes: next }))
                  }
                  options={demandeOptions}
                />
                <SurLesLieuxSection
                  value={isAmbianceTab ? ambianceMessage.surLesLieux : compteRenduMessage.surLesLieux}
                  onChange={(next) => isAmbianceTab
                    ? setAmbianceMessage((prev) => ({ ...prev, surLesLieux: next }))
                    : setCompteRenduMessage((prev) => ({ ...prev, surLesLieux: next }))
                  }
                  options={surLesLieuxOptions}
                />
              </div>

              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={isAmbianceTab ? handleValidateAmbiance : handleValidateCompteRendu}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition border ${
                    (isAmbianceTab ? validatedAmbiance : validatedCompteRendu)
                      ? 'bg-emerald-600/15 text-emerald-700 border-emerald-300 dark:text-emerald-300 dark:border-emerald-500/40'
                      : 'btn-success'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  {(isAmbianceTab ? validatedAmbiance : validatedCompteRendu) ? 'Message validé' : 'Valider le message'}
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === 'sitac') {
      return (
        <div className="min-h-[320px]">
          <SitacMap key={`sitac-${sitacResetKey}`} embedded interventionAddress={fullAddress} />
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center h-full min-h-[280px]">
        <div className="text-center space-y-1">
          <div className="text-lg font-semibold text-slate-900 dark:text-white">En construction</div>
          <div className="text-sm text-slate-600 dark:text-gray-400">Cette section sera bientôt disponible.</div>
        </div>
      </div>
    );
  };

  const draftPayload = React.useMemo<DraftPayload>(() => ({
    ordreData: ordreData ?? undefined,
    selectedRisks,
    address,
    city,
    additionalInfo,
    orderTime,
    ordreConduite: ordreConduite ?? undefined,
    showConduite,
    selectedMeans,
    ambianceMessage,
    compteRenduMessage,
    validatedAmbiance: validatedAmbiance ?? undefined,
    validatedCompteRendu: validatedCompteRendu ?? undefined,
    ordreValidatedAt: ordreValidatedAt ?? undefined,
    conduiteValidatedAt: conduiteValidatedAt ?? undefined,
    conduiteSelectedRisks,
    conduiteAddress,
    conduiteCity,
    conduiteAdditionalInfo,
    conduiteOrderTime
  }), [
    additionalInfo,
    address,
    ambianceMessage,
    city,
    compteRenduMessage,
    conduiteAdditionalInfo,
    conduiteAddress,
    conduiteCity,
    conduiteOrderTime,
    conduiteSelectedRisks,
    conduiteValidatedAt,
    ordreConduite,
    ordreData,
    ordreValidatedAt,
    orderTime,
    selectedMeans,
    selectedRisks,
    showConduite,
    validatedAmbiance,
    validatedCompteRendu
  ]);

  const applyStoredDraft = React.useCallback((draft: DraftPayload) => {
    if (draft.ordreData) setOrdreData(draft.ordreData);
    if (draft.selectedRisks) setSelectedRisks(draft.selectedRisks);
    if (draft.address) setAddress(draft.address);
    if (draft.city) setCity(draft.city);
    if (draft.hasAdditionalInfo) {
      setAdditionalInfo(draft.additionalInfo ?? '');
    }
    if (draft.orderTime) setOrderTime(draft.orderTime);
    if (draft.selectedMeans) setSelectedMeans(normalizeMeans(draft.selectedMeans));
    if (draft.ambianceMessage) {
      setAmbianceMessage({
        ...createAmbianceMessage(),
        ...draft.ambianceMessage,
        demandes: normalizeDemandes(draft.ambianceMessage.demandes),
        surLesLieux: normalizeSurLesLieux(draft.ambianceMessage.surLesLieux)
      });
    }
    if (draft.compteRenduMessage) {
      setCompteRenduMessage({
        ...createCompteRenduMessage(),
        ...draft.compteRenduMessage,
        demandes: normalizeDemandes(draft.compteRenduMessage.demandes),
        surLesLieux: normalizeSurLesLieux(draft.compteRenduMessage.surLesLieux)
      });
    }
    if (draft.validatedAmbiance) {
      setValidatedAmbiance({
        ...createAmbianceMessage(),
        ...draft.validatedAmbiance,
        demandes: normalizeDemandes(draft.validatedAmbiance.demandes),
        surLesLieux: normalizeSurLesLieux(draft.validatedAmbiance.surLesLieux)
      });
    }
    if (draft.validatedCompteRendu) {
      setValidatedCompteRendu({
        ...createCompteRenduMessage(),
        ...draft.validatedCompteRendu,
        demandes: normalizeDemandes(draft.validatedCompteRendu.demandes),
        surLesLieux: normalizeSurLesLieux(draft.validatedCompteRendu.surLesLieux)
      });
    }
    if (draft.ordreValidatedAt) setOrdreValidatedAt(draft.ordreValidatedAt);
    if (draft.ordreConduite) setOrdreConduite(draft.ordreConduite);
    if (typeof draft.showConduite === 'boolean') setShowConduite(draft.showConduite);
    if (draft.conduiteValidatedAt) setConduiteValidatedAt(draft.conduiteValidatedAt);
    if (draft.conduiteSelectedRisks) setConduiteSelectedRisks(draft.conduiteSelectedRisks);
    if (draft.conduiteAddress) setConduiteAddress(draft.conduiteAddress);
    if (draft.conduiteCity) setConduiteCity(draft.conduiteCity);
    if (draft.conduiteAdditionalInfo) setConduiteAdditionalInfo(draft.conduiteAdditionalInfo);
    if (draft.conduiteOrderTime) setConduiteOrderTime(draft.conduiteOrderTime);
  }, [normalizeMeans, setAddress, setCity, setSelectedMeans]);

  const { clearDraft } = useDictationDraft({
    storageKey: INTERVENTION_DRAFT_KEY,
    parseDraft: parseDraftPayload,
    applyDraft: applyStoredDraft,
    payload: draftPayload
  });

  const canUploadDraftSnapshot = Boolean(
    currentInterventionId
    && interventionStatus === 'open'
  );

  const scheduleDraftSnapshot = React.useCallback((snapshot: Record<string, unknown>, snapshotHash: string) => {
    const state = draftSnapshotStateRef.current;
    if (state.failureCount >= 3) return;
    const now = Date.now();
    if (state.lastSentHash === snapshotHash && now - state.lastSentAt < 60_000) return;
    if (state.pendingTimer !== null) {
      window.clearTimeout(state.pendingTimer);
    }
    const elapsed = now - state.lastSentAt;
    const delay = elapsed >= 60_000 ? 3_000 : Math.max(60_000 - elapsed, 3_000);
    state.pendingTimer = window.setTimeout(() => {
      state.pendingTimer = null;
      void sendDraftSnapshot(snapshot, snapshotHash, draftSnapshotStateRef);
    }, delay);
  }, [sendDraftSnapshot]);

  React.useEffect(() => {
    const state = draftSnapshotStateRef.current;
    if (!canUploadDraftSnapshot) {
      if (state.pendingTimer !== null) {
        window.clearTimeout(state.pendingTimer);
        state.pendingTimer = null;
      }
      return;
    }
    const snapshot: Record<string, unknown> = {
      ordreData,
      selectedRisks,
      address,
      city,
      orderTime,
      selectedMeans,
      ambianceMessage,
      compteRenduMessage,
      validatedAmbiance,
      validatedCompteRendu,
      ordreConduite
    };
    let snapshotHash = '';
    try {
      snapshotHash = JSON.stringify(snapshot);
    } catch (error) {
      console.warn('[draft] Failed to serialize snapshot', error);
      return;
    }
    if (snapshotHash === state.lastQueuedHash) return;
    state.lastQueuedHash = snapshotHash;
    scheduleDraftSnapshot(snapshot, snapshotHash);
  }, [
    address,
    ambianceMessage,
    canUploadDraftSnapshot,
    compteRenduMessage,
    city,
    ordreConduite,
    ordreData,
    orderTime,
    selectedMeans,
    selectedRisks,
    validatedAmbiance,
    validatedCompteRendu,
    scheduleDraftSnapshot
  ]);

  React.useEffect(() => {
    const state = draftSnapshotStateRef.current;
    return () => {
      if (state.pendingTimer !== null) {
        window.clearTimeout(state.pendingTimer);
        state.pendingTimer = null;
      }
    };
  }, []);

  React.useEffect(() => {
    const state = location.state as {
      meta?: { address?: string; city?: string; date?: string; time?: string; role?: string };
      interventionId?: string;
      startedAtMs?: number;
      mode?: 'create' | 'resume';
    } | null;
    if (state?.meta) {
      const { address: addr, city: c, date, time } = state.meta;
      if (addr) setAddress(addr);
      if (c) setCity(c);
      if (date || time) {
        const defaultDate = date || getLocalDate(new Date());
        const defaultTime = time || '00:00';
        setOrderTime(`${defaultDate}T${defaultTime}`);
      }
    }
    if (state?.interventionId) {
      setCurrentIntervention(state.interventionId, state.startedAtMs);
    } else if (state?.mode === 'resume' || state?.mode === 'create') {
      clearCurrentIntervention();
    }
  }, [clearCurrentIntervention, location.state, setAddress, setCity, setCurrentIntervention]);

  React.useEffect(() => {
    if (!fullAddress) return;
    setAmbianceMessage((prev) => {
      if (!prev.jeSuis || prev.addressConfirmed) {
        return { ...prev, jeSuis: fullAddress };
      }
      return prev;
    });
    setCompteRenduMessage((prev) => {
      if (!prev.jeSuis || prev.addressConfirmed) {
        return { ...prev, jeSuis: fullAddress };
      }
      return prev;
    });
  }, [fullAddress]);

  React.useEffect(() => {
    if (address && !conduiteAddress) setConduiteAddress(address);
    if (city && !conduiteCity) setConduiteCity(city);
  }, [address, city, conduiteAddress, conduiteCity]);

  React.useEffect(() => {
    if (activeTab !== 'soiec') {
      setShowShareMenu(false);
    }
  }, [activeTab]);

  React.useEffect(() => {
    if (activeTab !== 'moyens') return;
    if (!currentInterventionId) return;
    if (selectedMeans.length > 0) return;
    if (lastHydratedInterventionId === currentInterventionId) return;
    hydrateIntervention(currentInterventionId).catch((error) => {
      console.error('Erreur hydratation moyens', error);
    });
  }, [activeTab, currentInterventionId, lastHydratedInterventionId, selectedMeans.length]);

  React.useEffect(() => {
    const query = fullAddress.trim();
    if (!query) return;
    const timeout = window.setTimeout(() => {
      setExternalSearch(query);
    }, 600);
    return () => window.clearTimeout(timeout);
  }, [fullAddress, setExternalSearch]);

  const meansTelemetry = React.useMemo(
    () =>
      debounce((means: unknown) => {
        const normalizedMeans = Array.isArray(means) ? normalizeMeans(means) : [];
        telemetryBuffer.addSample({
          interventionId: currentInterventionId,
          stream: 'MEANS',
          patch: { selectedMeansIds: normalizedMeans.map((mean) => mean.id) },
          interventionStartedAtMs,
          uiContext: 'dictation.moyens'
        });
      }, 2000),
    [currentInterventionId, interventionStartedAtMs, normalizeMeans]
  );

  React.useEffect(() => {
    meansTelemetry(selectedMeans);
  }, [meansTelemetry, selectedMeans]);

  React.useEffect(() => {
    if (!currentInterventionId) return;
    const skipState = skipMeansSyncRef.current;
    if (skipState.interventionId !== currentInterventionId || skipState.hydrationId !== meansHydrationId) {
      skipMeansSyncRef.current = { interventionId: currentInterventionId, hydrationId: meansHydrationId };
      lastMeansStateRef.current = JSON.stringify({
        interventionId: currentInterventionId,
        payload: { selectedMeans, octTree }
      });
      return;
    }
    persistMeansState(selectedMeans, octTree);
  }, [currentInterventionId, meansHydrationId, octTree, persistMeansState, selectedMeans]);

  React.useEffect(() => {
    return () => {
      meansTelemetry.flush();
      meansTelemetry.cancel();
      persistMeansState.flush();
      persistMeansState.cancel();
    };
  }, [meansTelemetry, persistMeansState]);

  React.useEffect(() => {
    const wasMeans = previousTabRef.current === 'moyens';
    if (wasMeans && activeTab !== 'moyens') {
      meansTelemetry.flush();
      persistMeansState.flush();
    }
    telemetryBuffer.flushAll();
    previousTabRef.current = activeTab;
  }, [activeTab, meansTelemetry, persistMeansState]);

  const handleValidateAmbiance = () => {
    const nowStamp = getNowStamp();
    const stampedMessage: AmbianceMessage = {
      ...ambianceMessage,
      stamped: true,
      date: ambianceMessage.date || nowStamp.date,
      time: ambianceMessage.time || nowStamp.time
    };
    setAmbianceMessage(stampedMessage);
    setValidatedAmbiance(stampedMessage);
    logInterventionEventSafe(
      'MESSAGE_AMBIANCE_VALIDATED',
      stampedMessage,
      buildInterventionMetrics('dictation.message.ambiance')
    );
  };

  const handleValidateCompteRendu = () => {
    const nowStamp = getNowStamp();
    const stampedMessage: CompteRenduMessage = {
      ...compteRenduMessage,
      stamped: true,
      date: compteRenduMessage.date || nowStamp.date,
      time: compteRenduMessage.time || nowStamp.time
    };
    setCompteRenduMessage(stampedMessage);
    setValidatedCompteRendu(stampedMessage);
    logInterventionEventSafe(
      'MESSAGE_COMPTE_RENDU_VALIDATED',
      stampedMessage,
      buildInterventionMetrics('dictation.message.compte_rendu')
    );
  };


  const handleValidateConduite = () => {
    if (!ordreConduite) {
      alert("Veuillez remplir l'ordre de conduite avant de le valider.");
      return;
    }
    if (conduiteValidatedAt) return;
    const resolvedConduiteAddress = conduiteAddress || address;
    const resolvedConduiteCity = conduiteCity || city;
    const resolvedConduiteOrderTime = conduiteOrderTime || orderTime;
    setConduiteValidatedAt(
      new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    );
    logInterventionEventSafe(
      'ORDRE_CONDUITE_VALIDATED',
      {
        soiecType: soiecLabel,
        conduiteSelectedRisks,
        conduiteAdditionalInfo,
        conduiteAddress: resolvedConduiteAddress,
        conduiteCity: resolvedConduiteCity,
        conduiteOrderTime: resolvedConduiteOrderTime,
        ordreConduite
      },
      buildInterventionMetrics('dictation.ordre_conduite', { edit_count: conduiteSelectedRisks.length }),
      undefined,
      conduiteLogicalId ? { logical_id: conduiteLogicalId } : undefined
    );
  };

  const handleGenerateConduite = () => {
    if (!ordreValidatedAt) {
      alert("Veuillez valider l'ordre initial avant de rédiger un ordre de conduite.");
      return;
    }
    if (!ordreData) {
      alert("Impossible de préparer l'ordre de conduite sans ordre initial.");
      return;
    }
    setShowConduite(true);
    setOrdreConduite((prev) => prev ?? JSON.parse(JSON.stringify(ordreData)));
    setConduiteSelectedRisks((prev) => (prev.length ? prev : [...selectedRisks]));
    setConduiteAddress((prev) => (prev ? prev : address));
    setConduiteCity((prev) => (prev ? prev : city));
    setConduiteAdditionalInfo((prev) => (prev ? prev : additionalInfo));
    setConduiteOrderTime((prev) => (prev ? prev : orderTime));
  };

  const meta = { adresse: address, heure: orderTime, role: roleLabel, moyens: selectedMeans };

  const handleShareText = (channel: 'sms' | 'whatsapp' | 'mail') => {
    if (!ordreData) {
      setShowShareHint(true);
      return;
    }
    shareOrdreAsText(ordreData, channel, meta);
  };

  const handleShareFile = async (format: 'pdf' | 'word') => {
    if (!ordreData) {
      setShowShareHint(true);
      return;
    }
    const ordre = ordreData;
    if (format === 'pdf') {
      if (boardRef.current) {
        await exportBoardDesignPdf(boardRef.current, meta);
      } else {
        await exportOrdreToPdf(ordre, meta);
      }
    } else {
      await exportBoardDesignWordEditable(ordre, meta);
    }
  };

  const handleDownloadImage = async () => {
    if (!ordreData) {
      setShowShareHint(true);
      return;
    }
    if (boardRef.current) {
      await exportBoardDesignImage(boardRef.current, meta);
    } else {
      await exportOrdreToImage(ordreData, meta);
    }
  };

  const handleCopyDraft = async () => {
    if (!ordreData) {
      setShowShareHint(true);
      return;
    }
    await exportOrdreToClipboard(ordreData, meta);
  };

  const handleGenerateShare = async () => {
    setShareStatus('loading');
    setShareError(null);
    setShareLink(null);
    try {
      if (!currentInterventionId) {
        throw new Error('Intervention active manquante pour partager.');
      }
      const joinUrl = await generateShareLink(currentInterventionId);
      setShareLink(joinUrl);
      setShareStatus('ready');
    } catch (error) {
      console.error('Erreur génération QR Code', error);
      const message = error instanceof Error ? error.message : 'Impossible de générer le QR code.';
      setShareError(message);
      setShareStatus('error');
    }
  };

  const handleOpenShareModal = () => {
    setShareModalOpen(true);
    setShowShareMenu(false);
    setShowShareHint(false);
    void handleGenerateShare();
  };

  const handleConfirmCloseIntervention = async () => {
    clearCloseError();
    try {
      const success = await closeActiveIntervention({ orderTime });
      if (!success) {
        return;
      }
      setCloseDialogOpen(false);
      setCloseNotice('Intervention clôturée.');
      window.setTimeout(() => setCloseNotice(null), 4000);
    } catch (error) {
      console.error('Erreur clôture intervention', error);
    }
  };

  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const buildShareMessage = (url: string) => `Rejoins mon intervention ATLAS : ${url}`;

  const handleShareInvite = async () => {
    if (!shareLink) return;
    if (!canNativeShare) {
      setShareError('Partage natif indisponible sur cet appareil.');
      return;
    }
    try {
      await navigator.share({
        title: 'Invitation ATLAS',
        text: 'Rejoins mon intervention ATLAS',
        url: shareLink
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.warn('Partage natif échoué', error);
      setShareError('Impossible de partager via le menu natif.');
    }
  };

  const handleShareFallback = (channel: 'mail' | 'sms' | 'whatsapp') => {
    if (!shareLink) return;
    const message = buildShareMessage(shareLink);
    const encoded = encodeURIComponent(message);
    if (channel === 'mail') {
      window.location.href = `mailto:?subject=Invitation%20ATLAS&body=${encoded}`;
      return;
    }
    if (channel === 'sms') {
      window.location.href = `sms:?body=${encoded}`;
      return;
    }
    if (channel === 'whatsapp') {
      window.open(`https://wa.me/?text=${encoded}`, '_blank', 'noopener,noreferrer');
    }
  };

  const resetSoiecState = () => {
    setOrdreData(null);
    setSelectedRisks([]);
    setAddress('');
    setCity('');
    setAdditionalInfo('');
    setSoiecAddressValidated(false);
    setSoiecTimeValidated(false);
    setOrdreValidatedAt(null);
    setLastOiValidatedAt(null);
    setConduiteValidatedAt(null);
    setOrdreConduite(null);
    setShowConduite(false);
    setConduiteSelectedRisks([]);
    setConduiteAddress('');
    setConduiteCity('');
    setConduiteAdditionalInfo('');
    setConduiteOrderTime('');
    setConduiteTimeValidated(false);
    setOrderTime(getLocalDateTime(new Date()));
    setShowShareHint(false);
    setShowShareMenu(false);
    try {
      clearDraft();
    } catch (err) {
      console.error('Erreur réinitialisation brouillon', err);
    }
  };

  const resetMeansState = () => {
    setSelectedMeans([]);
    setMeansResetKey((k) => k + 1);
  };

  const resetOctState = () => {
    resetOctTree();
    setOctResetKey((k) => k + 1);
  };

  const resetSitacState = () => {
    setSitacResetKey((k) => k + 1);
  };

  const resetMessageState = () => {
    setAmbianceMessage(createAmbianceMessage());
    setCompteRenduMessage(createCompteRenduMessage());
    setValidatedAmbiance(null);
    setValidatedCompteRendu(null);
  };

  const handleResetTab = () => {
    const label = tabs.find((t) => t.id === activeTab)?.label || 'onglet';
    if (!window.confirm(`Réinitialiser l'onglet ${label} ?`)) return;
    if (activeTab === 'soiec') resetSoiecState();
    if (activeTab === 'moyens') resetMeansState();
    if (activeTab === 'oct') resetOctState();
    if (activeTab === 'sitac') resetSitacState();
    if (activeTab === 'message') resetMessageState();
    setResetDialogOpen(false);
  };

  const handleResetAll = () => {
    if (!window.confirm('Réinitialiser toute l’intervention ?')) return;
    resetSoiecState();
    resetMeansState();
    resetOctState();
    resetSitacState();
    resetMessageState();
    setResetDialogOpen(false);
  };

  return (
    <div className="min-h-screen md:min-h-[100dvh] md:h-auto flex flex-col items-center justify-start relative overflow-hidden md:overflow-y-auto md:overflow-x-hidden bg-slate-50 text-slate-900 dark:bg-[#0A0A0A] dark:text-white">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-200/70 dark:bg-blue-900/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-green-200/60 dark:bg-green-900/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-[98%] mx-auto px-4 pt-4 pb-6 flex flex-col items-center">
        <div className="flex flex-col items-center mb-6 animate-fade-in-down">
          <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-500 dark:from-white dark:to-gray-400 mb-1">
            A.T.L.A.S
          </h1>
          <p className="text-slate-600 dark:text-gray-400 text-center text-xs md:text-sm font-light tracking-wide">
            Aide Tactique et Logique pour l'Action des Secours
          </p>
        </div>

        <div className="w-full flex-1 flex flex-col relative animate-fade-in-down md:min-h-0" style={{ animationDelay: '0.3s' }}>
          <div className="w-full flex-1 flex flex-col bg-white/90 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl overflow-visible md:overflow-hidden md:min-h-0 shadow-lg shadow-black/30 backdrop-blur-sm">
            <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-slate-200 dark:border-white/10 bg-slate-100/70 dark:bg-white/5">
              <div className="flex flex-wrap gap-2">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      aria-selected={isActive}
                      className={`px-3 py-2 rounded-full text-sm font-semibold transition btn-neutral ${isActive ? 'text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white'}`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
              <div className="ml-auto flex items-center gap-3">
                {syncStatus !== 'idle' && (
                  <div
                    className={`text-[11px] leading-tight ${
                      syncStatus === 'error'
                        ? 'text-red-500 dark:text-red-300'
                        : syncStatus === 'loading'
                          ? 'text-slate-500 dark:text-gray-400'
                          : 'text-emerald-600 dark:text-emerald-300'
                    }`}
                  >
                    <div>{syncStatus === 'loading' ? 'Synchronisation…' : syncStatus === 'error' ? 'Sync échouée' : 'Synchronisé'}</div>
                    {lastOiValidatedAt && syncStatus === 'ready' && (
                      <div className="text-[10px] text-slate-500 dark:text-gray-400">
                        OI validé à {lastOiValidatedAt}
                      </div>
                    )}
                  </div>
                )}
                {closeNotice && (
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-300">
                    {closeNotice}
                  </div>
                )}
                {activeTab === 'soiec' && (
                  <div className="relative">
                    <button
                      onClick={() => setShowShareMenu((v) => !v)}
                      className="flex items-center gap-2 px-3 py-2 btn-neutral rounded-xl text-sm"
                    >
                      <Share2 className="w-4 h-4" />
                      Partage et export
                    </button>
                    {showShareMenu && (
                      <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-[#0F121A] border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl p-3 space-y-2 z-30">
                        <div className="text-xs text-slate-500 dark:text-gray-400">Invitation</div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={handleOpenShareModal}
                            className="px-3 py-1.5 btn-neutral rounded-lg text-xs flex items-center gap-1"
                          >
                            <QrCode className="w-4 h-4" />
                            QR Code
                          </button>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-gray-400 pt-1">Texte</div>
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => handleShareText('sms')} className="px-3 py-1.5 btn-neutral rounded-lg text-xs">SMS</button>
                          <button onClick={() => handleShareText('whatsapp')} className="px-3 py-1.5 btn-neutral rounded-lg text-xs">WhatsApp</button>
                          <button onClick={() => handleShareText('mail')} className="px-3 py-1.5 btn-neutral rounded-lg text-xs">Mail</button>
                          <button onClick={handleCopyDraft} className="px-3 py-1.5 btn-neutral rounded-lg text-xs flex items-center gap-1"><ClipboardCopy className="w-4 h-4" />Copier</button>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-gray-400 pt-1">Téléchargements</div>
                        <div className="flex flex-wrap gap-2">
                          <button onClick={handleDownloadImage} className="px-3 py-1.5 btn-neutral rounded-lg text-xs flex items-center gap-1"><ImageDown className="w-4 h-4" />Image</button>
                          <button onClick={() => handleShareFile('pdf')} className="px-3 py-1.5 btn-neutral rounded-lg text-xs">PDF</button>
                          <button onClick={() => handleShareFile('word')} className="px-3 py-1.5 btn-neutral rounded-lg text-xs flex items-center gap-1"><FileText className="w-4 h-4" />Word</button>
                        </div>
                        {showShareHint && <div className="text-[11px] text-red-400">Ajoutez au moins un élément avant de partager.</div>}
                      </div>
                    )}
                  </div>
                )}
                <button
                  onClick={() => setResetDialogOpen(true)}
                  className="px-3 py-2 rounded-xl text-sm font-semibold btn-danger transition"
                >
                  Réinitialiser
                </button>
                <button
                  onClick={() => {
                    clearCloseError();
                    if (!isInterventionClosed) setCloseDialogOpen(true);
                  }}
                  disabled={isCloseDisabled}
                  className={`px-3 py-2 rounded-xl text-sm font-semibold border text-white transition flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed ${
                    isInterventionClosed
                      ? 'bg-emerald-600/90 border-emerald-500/70'
                      : 'bg-red-600/90 hover:bg-red-500 border-red-500/70'
                  }`}
                >
                  <Archive className="w-4 h-4" />
                  {closeButtonLabel}
                </button>
              </div>
            </div>
            <div className="flex-1 p-3 md:p-5 overflow-visible md:overflow-y-auto md:overflow-x-hidden md:min-h-0">
              {renderTabContent()}
            </div>
      </div>

      {activeTab !== 'sitac' && activeTab !== 'moyens' && activeTab !== 'oct' && activeTab !== 'message' && (
        <>

              {showConduite && (
                <div className="w-full mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Ordre de conduite n°1</h3>
                  </div>
                  <div className="space-y-4 mb-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium text-slate-600 dark:text-gray-400 ml-2">
                        Sélection du domaine de l&apos;intervention (1er = principal, suivants = secondaires)
                      </label>
                      <DominantSelector
                        selectedRisks={conduiteSelectedRisks}
                        onChange={setConduiteSelectedRisks}
                        className="justify-start"
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-[1.4fr,0.6fr] gap-3">
                        <div className="space-y-1">
                          <label className="text-sm font-medium text-slate-600 dark:text-gray-400 ml-2">Adresse de l&apos;intervention</label>
                          <input
                            value={conduiteAddress}
                            onChange={(e) => setConduiteAddress(e.target.value)}
                            placeholder="Ex: 12 rue de la Paix"
                            className="w-full bg-slate-100 dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-2xl px-3 py-2.5 text-slate-800 dark:text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-sm font-medium text-slate-600 dark:text-gray-400 ml-2">Ville</label>
                          <input
                            value={conduiteCity}
                            onChange={(e) => setConduiteCity(e.target.value)}
                            placeholder="Ville de l'intervention"
                            className="w-full bg-slate-100 dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-2xl px-3 py-2.5 text-slate-800 dark:text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 text-sm"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-[1.4fr,0.6fr] gap-3">
                        <div className="space-y-1">
                          <label className="text-sm font-medium text-slate-600 dark:text-gray-400 ml-2">Renseignements complémentaires</label>
                          <input
                            value={conduiteAdditionalInfo}
                            onChange={(e) => setConduiteAdditionalInfo(e.target.value)}
                            placeholder={ADDITIONAL_INFO_PLACEHOLDER}
                            className="w-full bg-slate-100 dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-2xl px-3 py-2.5 text-slate-800 dark:text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-sm font-medium text-slate-600 dark:text-gray-400 ml-2">Groupe horaire</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="datetime-local"
                              value={conduiteOrderTime}
                              onChange={(e) => {
                                setConduiteOrderTime(e.target.value);
                                setConduiteTimeValidated(false);
                              }}
                              className="flex-1 bg-slate-100 dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-2xl px-3 py-2.5 text-slate-800 dark:text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setConduiteOrderTime(getLocalDateTime(new Date()));
                                setConduiteTimeValidated(false);
                              }}
                              className="p-3 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-blue-300 dark:hover:border-blue-500/40 text-slate-600 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400 transition"
                              aria-label="Utiliser l'heure actuelle"
                              title="Utiliser l'heure actuelle"
                            >
                              <Clock className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const nowValue = getLocalDateTime(new Date());
                                setConduiteOrderTime((prev) => prev || nowValue);
                                setConduiteTimeValidated(true);
                              }}
                              className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition ${
                                conduiteTimeValidated
                                  ? 'bg-emerald-600/15 text-emerald-700 border-emerald-300 dark:text-emerald-300 dark:border-emerald-500/40'
                                  : 'btn-success'
                              }`}
                            >
                              <Check className="w-4 h-4" />
                              Valider
                            </button>
                          </div>
                          {conduiteTimeValidated && (
                            <div className="text-xs text-emerald-600 dark:text-emerald-400">Groupe horaire validé.</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white/90 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-3 md:p-5 shadow-lg shadow-black/20 backdrop-blur-sm">
                    <OrdreInitialView
                      ordre={ordreConduite}
                      onChange={setOrdreConduite}
                      hideToolbar={true}
                      dominante={conduiteSelectedRisks[0] || selectedRisks[0]}
                      means={selectedMeans}
                      type={type as 'group' | 'column' | 'site' | 'communication'}
                      aiGenerateLabel="Générer ordre de conduite avec l'IA"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                    <button
                      type="button"
                      onClick={handleValidateConduite}
                      data-no-pill
                      className={`group w-full transition-all duration-300 text-white py-3 rounded-2xl text-base font-bold shadow-lg hover:-translate-y-0.5 flex items-center justify-center gap-3 ${
                        conduiteValidatedAt
                          ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 shadow-emerald-500/25 hover:shadow-emerald-500/40'
                          : 'bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 shadow-slate-500/25 hover:shadow-slate-500/40'
                      }`}
                    >
                      {conduiteValidatedAt ? (
                        <>
                          Ordre de conduite validé à {conduiteValidatedAt}
                          <Check className="w-5 h-5 text-emerald-200 group-hover:text-white" />
                        </>
                      ) : (
                        <>
                          Valider l&apos;ordre de conduite
                          <Check className="w-5 h-5 text-slate-200 group-hover:text-white" />
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleGenerateConduite}
                      data-no-pill
                      className="group w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 transition-all duration-300 text-white py-3 rounded-2xl text-base font-bold shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:-translate-y-0.5 flex items-center justify-center gap-3"
                    >
                      Rédiger un ordre de conduite
                      <FileText className="w-5 h-5 text-purple-200 group-hover:text-white" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {shareModalOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-[#0f121a] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Inviter par QR Code</h3>
                <p className="text-xs text-slate-500 dark:text-gray-400">Scannez pour rejoindre l’intervention.</p>
              </div>
              <button
                onClick={() => setShareModalOpen(false)}
                className="text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
                aria-label="Fermer la fenêtre"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-4">
              {shareStatus === 'loading' && (
                <div className="flex flex-col items-center gap-3 text-slate-600 dark:text-gray-300">
                  <div className="w-8 h-8 border-2 border-slate-300 dark:border-white/30 border-t-slate-600 dark:border-t-white rounded-full animate-spin" />
                  Génération du QR code…
                </div>
              )}
              {shareStatus === 'error' && (
                <div className="space-y-3">
                  <p className="text-sm text-red-600 dark:text-red-300">{shareError || 'Une erreur est survenue.'}</p>
                  <button
                    onClick={handleGenerateShare}
                    className="w-full px-3 py-2 rounded-xl btn-neutral text-sm transition"
                  >
                    Réessayer
                  </button>
                </div>
              )}
              {shareStatus === 'ready' && (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-52 h-52 rounded-2xl bg-slate-100 dark:bg-white/10 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-white/10">
                    {shareLink ? (
                      <QRCode value={shareLink} size={192} bgColor="#FFFFFF" fgColor="#0F172A" className="w-full h-full" />
                    ) : (
                      <span className="text-xs text-slate-500 dark:text-gray-400">QR code indisponible</span>
                    )}
                  </div>
                  <button
                    onClick={handleShareInvite}
                    className="px-3 py-2 rounded-xl btn-neutral text-sm transition flex items-center gap-2"
                  >
                    <Share2 className="w-4 h-4" />
                    Partager
                  </button>
                  {!canNativeShare && (
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <button
                        onClick={() => handleShareFallback('mail')}
                        className="px-3 py-1.5 rounded-lg btn-neutral text-[11px] transition"
                      >
                        Email
                      </button>
                      <button
                        onClick={() => handleShareFallback('sms')}
                        className="px-3 py-1.5 rounded-lg btn-neutral text-[11px] transition"
                      >
                        SMS
                      </button>
                      <button
                        onClick={() => handleShareFallback('whatsapp')}
                        className="px-3 py-1.5 rounded-lg btn-neutral text-[11px] transition"
                      >
                        WhatsApp
                      </button>
                    </div>
                  )}
                  {shareError && <div className="text-xs text-red-500 dark:text-red-300">{shareError}</div>}
                </div>
              )}
            </div>
            <div className="px-4 py-3 border-t border-slate-200 dark:border-white/10 flex justify-end gap-2">
              <button
                onClick={() => setShareModalOpen(false)}
                className="px-3 py-2 rounded-lg btn-neutral text-sm transition"
              >
                Fermer
              </button>
              <button
                onClick={handleGenerateShare}
                disabled={shareStatus === 'loading'}
                className="px-3 py-2 rounded-lg btn-neutral text-sm disabled:opacity-60 transition"
              >
                Régénérer
              </button>
            </div>
          </div>
        </div>
      )}

      {historyModalOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-[#0f121a] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Historique de l’intervention</h3>
                <p className="text-xs text-slate-500 dark:text-gray-400">Versions validées disponibles.</p>
              </div>
              <button
                onClick={() => setHistoryModalOpen(false)}
                className="text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
                aria-label="Fermer l'historique"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-5 max-h-[70vh] overflow-y-auto">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-slate-800 dark:text-gray-100">Ordre initial</h4>
                {ordreInitialHistory.length ? (
                  <div className="space-y-2">
                    {ordreInitialHistory.map((entry) => (
                      <div key={entry.id} className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 px-3 py-2">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-semibold text-slate-900 dark:text-white">
                              Validé le {formatHistoryTimestamp(entry.createdAt)}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-gray-400">
                              {entry.payload.soiecType ? `${entry.payload.soiecType} • ` : ''}Risques: {entry.payload.selectedRisks?.length ?? 0}
                              {entry.userId ? ` • Auteur: ${entry.userId.slice(0, 8)}` : ''}
                            </div>
                          </div>
                          <button
                            onClick={() => handleLoadOrdreInitialHistory(entry.payload)}
                            className="px-3 py-1.5 rounded-lg btn-neutral text-xs transition"
                          >
                            Charger cette version
                          </button>
                        </div>
                        <div className="mt-3 grid gap-3 text-xs">
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-gray-400">Situation</div>
                            <div className="text-sm text-slate-800 dark:text-gray-200 whitespace-pre-wrap">
                              {getSimpleSectionText(entry.payload.ordreData?.S) || '-'}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-gray-400">Objectifs</div>
                            <div className="text-sm text-slate-800 dark:text-gray-200 whitespace-pre-wrap">{formatSoiecList(entry.payload.ordreData?.O)}</div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-gray-400">Idée de manœuvre</div>
                            <div className="text-sm text-slate-800 dark:text-gray-200 whitespace-pre-wrap">{formatIdeeManoeuvreList(entry.payload.ordreData?.I || [])}</div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-gray-400">Exécution</div>
                            <div className="text-sm text-slate-800 dark:text-gray-200 whitespace-pre-wrap">{formatExecutionValue(entry.payload.ordreData?.E)}</div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-gray-400">Commandement</div>
                            <div className="text-sm text-slate-800 dark:text-gray-200 whitespace-pre-wrap">
                              {getSimpleSectionText(entry.payload.ordreData?.C) || '-'}
                            </div>
                          </div>
                          {getSimpleSectionContentList(entry.payload.ordreData?.A).length > 0 && (
                            <div>
                              <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-gray-400">Anticipation</div>
                              <div className="text-sm text-slate-800 dark:text-gray-200 whitespace-pre-wrap">{formatSoiecList(entry.payload.ordreData?.A)}</div>
                            </div>
                          )}
                          {getSimpleSectionContentList(entry.payload.ordreData?.L).length > 0 && (
                            <div>
                              <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-gray-400">Logistique</div>
                              <div className="text-sm text-slate-800 dark:text-gray-200 whitespace-pre-wrap">{formatSoiecList(entry.payload.ordreData?.L)}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 dark:text-gray-400">Aucun ordre initial validé.</div>
                )}
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-slate-800 dark:text-gray-100">Ordre de conduite</h4>
                {ordreConduiteHistory.length ? (
                  <div className="space-y-2">
                    {ordreConduiteHistory.map((entry) => (
                      <div key={entry.id} className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 px-3 py-2">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                          Validé le {formatHistoryTimestamp(entry.createdAt)}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-gray-400">
                          Risques: {entry.payload.conduiteSelectedRisks?.length ?? 0}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 dark:text-gray-400">Aucun ordre de conduite validé.</div>
                )}
              </div>
            </div>
            <div className="px-4 py-3 border-t border-slate-200 dark:border-white/10 flex justify-end">
              <button
                onClick={() => setHistoryModalOpen(false)}
                className="px-3 py-2 rounded-lg btn-neutral text-sm transition"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {closeDialogOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-[#0f121a] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Clôturer l’intervention</h3>
              <button
                onClick={() => {
                  setCloseDialogOpen(false);
                  clearCloseError();
                }}
                className="text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-slate-600 dark:text-gray-300">
                Êtes-vous sûr de vouloir clôturer cette intervention ? Elle restera accessible dans l&apos;historique.
              </p>
              {closeError && (
                <div className="text-sm text-red-600 dark:text-red-300">{closeError}</div>
              )}
            </div>
            <div className="px-4 py-3 border-t border-slate-200 dark:border-white/10 flex justify-end gap-2">
              <button
                onClick={() => {
                  setCloseDialogOpen(false);
                  clearCloseError();
                }}
                className="px-3 py-2 rounded-lg btn-neutral text-sm transition"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmCloseIntervention}
                disabled={closeStatus === 'loading'}
                className="px-3 py-2 rounded-lg btn-danger text-sm transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {closeStatus === 'loading' ? 'Clôture…' : 'Clôturer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {resetDialogOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-[#0f121a] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Réinitialiser</h3>
              <button onClick={() => setResetDialogOpen(false)} className="text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white">✕</button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-slate-600 dark:text-gray-300">
                Choisissez de réinitialiser uniquement l&apos;onglet courant ou toute l&apos;intervention. Une confirmation est demandée à chaque action.
              </p>
              <button
                onClick={handleResetTab}
                className="w-full px-3 py-2 rounded-xl btn-danger text-sm transition"
              >
                Réinitialiser l&apos;onglet en cours
              </button>
              <button
                onClick={handleResetAll}
                className="w-full px-3 py-2 rounded-xl btn-danger text-sm transition"
              >
                Réinitialiser toute l&apos;intervention
              </button>
            </div>
            <div className="px-4 py-3 border-t border-slate-200 dark:border-white/10 flex justify-end">
              <button
                onClick={() => setResetDialogOpen(false)}
                className="px-3 py-2 rounded-lg btn-neutral text-sm transition"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DictationInput;
