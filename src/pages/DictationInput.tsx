import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Sparkles, ClipboardCopy, Share2, FileText, ImageDown, Check, QrCode, LocateFixed, Archive, Clock, ChevronRight, X, Radio, MessageSquareText, Pencil, Trash2 } from 'lucide-react';
import { Swiper, SwiperSlide } from 'swiper/react';
import type { Swiper as SwiperInstance } from 'swiper';
import 'swiper/css';
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
import { addToHistory } from '../utils/history';
import { exportBoardDesignImage, exportBoardDesignPdf, exportBoardDesignWordEditable, exportOrdreToClipboard, exportOrdreToImage, exportOrdreToPdf, shareOrdreAsText } from '../utils/export';
import MeansModal from '../components/MeansModal';
import ViewportModal from '../components/ViewportModal';
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
  validatedAmbianceList?: Partial<AmbianceMessage>[];
  validatedCompteRenduList?: Partial<CompteRenduMessage>[];
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
    validatedAmbianceList: Array.isArray(value.validatedAmbianceList)
      ? value.validatedAmbianceList.filter(isRecord)
      : undefined,
    validatedCompteRenduList: Array.isArray(value.validatedCompteRenduList)
      ? value.validatedCompteRenduList.filter(isRecord)
      : undefined,
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

const normalizeAmbianceMessage = (input: Partial<AmbianceMessage>): AmbianceMessage => ({
  ...createAmbianceMessage(),
  ...input,
  demandes: normalizeDemandes(input.demandes),
  surLesLieux: normalizeSurLesLieux(input.surLesLieux)
});

const normalizeCompteRenduMessage = (input: Partial<CompteRenduMessage>): CompteRenduMessage => ({
  ...createCompteRenduMessage(),
  ...input,
  demandes: normalizeDemandes(input.demandes),
  surLesLieux: normalizeSurLesLieux(input.surLesLieux)
});

type MessageSummaryRowProps = {
  label: string;
  value: string;
};

const MessageSummaryRow: React.FC<MessageSummaryRowProps> = ({ label, value }) => (
  <div className="grid grid-cols-[96px,minmax(0,1fr)] gap-2 items-start">
    <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 dark:text-gray-400">
      {label}
    </div>
    <div className="text-sm text-slate-800 dark:text-gray-200 whitespace-pre-wrap break-words">
      {value || '-'}
    </div>
  </div>
);

const MESSAGE_INPUT_CLASS = 'min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition focus:border-slate-400/70 focus:ring-2 focus:ring-slate-200/70 dark:border-white/10 dark:bg-[#151515] dark:text-gray-200 dark:focus:border-white/20 dark:focus:ring-white/10';
const MESSAGE_SMALL_INPUT_CLASS = 'min-h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-slate-400/70 focus:ring-2 focus:ring-slate-200/70 dark:border-white/10 dark:bg-[#151515] dark:text-gray-200 dark:focus:border-white/20 dark:focus:ring-white/10';

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
    <div className="space-y-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-gray-400">Je demande</div>
        <p className="mt-1 text-sm text-slate-600 dark:text-gray-400">Sélectionnez rapidement les renforts et compléments nécessaires.</p>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {options.map((opt) => (
          <label
            key={opt.id}
            className={`flex min-h-11 min-w-0 w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-sm leading-5 transition cursor-pointer md:max-w-[280px] md:justify-self-start ${
              value.selections[opt.id]
                ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                : 'border-slate-200 bg-slate-50/90 text-slate-700 hover:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:border-white/20'
            }`}
          >
            <input
              type="checkbox"
              checked={Boolean(value.selections[opt.id])}
              onChange={() => toggleOption(opt.id)}
              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500 dark:border-white/20"
            />
            <span className="font-medium">{opt.label}</span>
          </label>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(220px,0.85fr)_minmax(0,1.9fr)] md:items-start">
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-gray-400">Autres moyens SP</label>
          <input
            value={value.autresMoyensSp}
            onChange={(e) => handleFieldChange('autresMoyensSp', e.target.value)}
            placeholder="Précisions"
            className={MESSAGE_INPUT_CLASS}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-gray-400">Moyens Sapeurs-Pompiers</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {MOYENS_SP_FIELDS.map(({ key, label }) => (
              <div key={key} className="flex flex-col gap-1 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-white/5 p-2">
                <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500 dark:text-gray-400">{label}</span>
                <input
                  value={value[key]}
                  onChange={(e) => handleFieldChange(key, e.target.value)}
                  inputMode="numeric"
                  placeholder="0"
                  className={MESSAGE_SMALL_INPUT_CLASS}
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
          className={MESSAGE_INPUT_CLASS}
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
    <div className="space-y-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-gray-400">Sur les lieux</div>
        <p className="mt-1 text-sm text-slate-600 dark:text-gray-400">Cochez les faits marquants et précisez l’horaire si nécessaire.</p>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {options.filter((opt) => opt.id !== FEU_ETEINT_ID).map((opt) => (
          <label
            key={opt.id}
            className={`flex min-h-11 min-w-0 w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-sm leading-5 transition cursor-pointer md:max-w-[280px] md:justify-self-start ${
              value.selections[opt.id]
                ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                : 'border-slate-200 bg-slate-50/90 text-slate-700 hover:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:border-white/20'
            }`}
          >
            <input
              type="checkbox"
              checked={Boolean(value.selections[opt.id])}
              onChange={() => toggleOption(opt.id)}
              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500 dark:border-white/20"
            />
            <span className="font-medium">{opt.label}</span>
          </label>
        ))}
        {feuEteintOption && (
          <div className="w-fit max-w-full justify-self-start rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/5 sm:col-span-2 md:col-span-3 xl:col-span-4 2xl:col-span-5">
            <div className="flex flex-wrap items-center gap-3">
            <label className={`inline-flex items-center gap-3 text-sm ${value.selections[FEU_ETEINT_ID] ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-gray-200'}`}>
              <input
                type="checkbox"
                checked={Boolean(value.selections[FEU_ETEINT_ID])}
                onChange={() => toggleOption(FEU_ETEINT_ID)}
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500 dark:border-white/20"
              />
              <span className="font-medium">{feuEteintOption.label}</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={value.feuEteintHeure}
                onChange={(e) => onChange({ ...value, feuEteintHeure: e.target.value })}
                disabled={!value.selections[FEU_ETEINT_ID]}
                className={`w-32 ${MESSAGE_SMALL_INPUT_CLASS} disabled:opacity-60`}
              />
              <span className="text-xs text-slate-500 dark:text-gray-400">hrs</span>
            </div>
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
  const streetNumber = useInterventionStore((s) => s.streetNumber);
  const streetName = useInterventionStore((s) => s.streetName);
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
  const [isLoading, setIsLoading] = useState(false);
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
  const navigate = useNavigate();
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
  const oiLogicalId = useInterventionStore((s) => s.oiLogicalId);
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
  const [validatedAmbianceList, setValidatedAmbianceList] = useState<AmbianceMessage[]>([]);
  const [validatedCompteRenduList, setValidatedCompteRenduList] = useState<CompteRenduMessage[]>([]);
  const [collapsedValidatedMessages, setCollapsedValidatedMessages] = useState<Record<string, boolean>>({});
  const [validatedMessagesOpen, setValidatedMessagesOpen] = useState(true);
  const [messageModal, setMessageModal] = useState<'ambiance' | 'compte-rendu' | null>(null);
  const [editingMessage, setEditingMessage] = useState<{ type: 'ambiance' | 'compte-rendu'; index: number } | null>(null);
  const messageMobileSwiperRef = React.useRef<SwiperInstance | null>(null);
  const [messageMobileSlideIndex, setMessageMobileSlideIndex] = useState(0);
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

  React.useEffect(() => {
    setMessageMobileSlideIndex(0);
    messageMobileSwiperRef.current?.slideTo(0, 0);
  }, [messageModal]);
  const latestValidatedAmbiance = validatedAmbianceList[0] ?? null;
  const latestValidatedCompteRendu = validatedCompteRenduList[0] ?? null;
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
  const buildOiPayloadData = React.useCallback(() => {
    if (!ordreData) return null;
    const commandLevel = type === 'group' ? 'CDG' : type === 'column' ? 'CDC' : type === 'site' ? 'CDS' : 'CDG';
    const situationText = getSimpleSectionText(ordreData.S);
    const commandementText = getSimpleSectionText(ordreData.C);
    const objectifsList = getSimpleSectionContentList(ordreData.O);
    const anticipationList = getSimpleSectionContentList(ordreData.A);
    const logistiqueList = getSimpleSectionContentList(ordreData.L);
    const ideeManoeuvre = ordreData.I.filter((idea) => idea?.type !== 'separator' && idea?.type !== 'empty');
    const execution = Array.isArray(ordreData.E)
      ? ordreData.E.filter((entry) => {
          if (!entry || typeof entry !== 'object') return true;
          const record = entry as unknown as Record<string, unknown>;
          return record.type !== 'separator' && record.type !== 'empty';
        })
      : ordreData.E ?? '';
    return {
      schema_version: 1,
      command_level: commandLevel,
      command_level_key: type,
      ordreData,
      address: {
        address,
        city,
        street_number: streetNumber || undefined,
        street_name: streetName || undefined
      },
      soiec: {
        situation: situationText,
        objectifs: objectifsList,
        idee_manoeuvre: ideeManoeuvre,
        execution,
        commandement: commandementText,
        anticipation: anticipationList,
        logistique: logistiqueList
      },
      meta: {
        soiec_type: soiecLabel,
        selected_risks: selectedRisks,
        additional_info: additionalInfo,
        order_time: orderTime,
        author_role: roleLabel
      }
    };
  }, [ordreData, type, address, city, streetNumber, streetName, soiecLabel, selectedRisks, additionalInfo, orderTime, roleLabel]);
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
      const addressSection = (
        <div className="space-y-3">
            <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-[1.4fr,0.6fr]">
              <div className="space-y-1 md:w-[70%]">
                <label className="text-sm font-medium text-slate-600 dark:text-gray-400 ml-2">Adresse de l'intervention</label>
                <input
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    setSoiecAddressValidated(false);
                  }}
                  placeholder="Ex: 12 rue de la Paix"
                  disabled={isOiLocked}
                  className="w-full bg-slate-100 dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-2xl px-3 py-2.5 text-slate-800 dark:text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600 dark:text-gray-400 ml-2">Ville</label>
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    value={city}
                    onChange={(e) => {
                      setCity(e.target.value);
                      setSoiecAddressValidated(false);
                    }}
                    placeholder="Ville de l'intervention"
                    disabled={isOiLocked}
                    className="min-w-0 w-full flex-1 bg-slate-100 dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-2xl px-3 py-2.5 text-slate-800 dark:text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  <div className="flex w-full gap-2 sm:w-auto">
                    <button
                    type="button"
                    onClick={handleLocateAddress}
                    disabled={isGeolocating || isOiLocked}
                    className="shrink-0 rounded-2xl bg-slate-100 p-3 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-red-300 dark:hover:border-red-500/40 text-slate-600 dark:text-gray-300 hover:text-red-500 dark:hover:text-red-400 transition disabled:opacity-60 disabled:cursor-not-allowed"
                    aria-label="Utiliser ma position"
                    title="Utiliser ma position"
                  >
                    <LocateFixed className={`w-4 h-4 ${isGeolocating ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                    type="button"
                    onClick={() => setSoiecAddressValidated(true)}
                    disabled={!fullAddress.trim() || isOiLocked}
                    className={`inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border px-3 py-2.5 text-sm font-semibold transition btn-success sm:flex-none ${
                      soiecAddressValidated
                        ? 'bg-emerald-600/15 text-emerald-700 border-emerald-300 dark:text-emerald-300 dark:border-emerald-500/40'
                        : ''
                    } ${!fullAddress.trim() ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <Check className="w-4 h-4" />
                    Valider
                    </button>
                  </div>
                </div>
                {geoError && (
                  <div className="text-xs text-red-500">{geoError}</div>
                )}
                {soiecAddressValidated && (
                  <div className="text-xs text-emerald-600 dark:text-emerald-400">Adresse validée.</div>
                )}
              </div>
            </div>
            <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-[1.4fr,0.6fr]">
              <div className="space-y-1 md:w-[70%]">
                <label className="text-sm font-medium text-slate-600 dark:text-gray-400 ml-2">Renseignements complémentaires</label>
                <input
                  value={additionalInfo}
                  onChange={(e) => setAdditionalInfo(e.target.value)}
                  placeholder={ADDITIONAL_INFO_PLACEHOLDER}
                  disabled={isOiLocked}
                  className="w-full bg-slate-100 dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-2xl px-3 py-2.5 text-slate-800 dark:text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600 dark:text-gray-400 ml-2">Groupe horaire</label>
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type="datetime-local"
                    value={orderTime}
                    onChange={(e) => {
                      setOrderTime(e.target.value);
                      setSoiecTimeValidated(false);
                    }}
                    disabled={isOiLocked}
                    className="min-w-0 w-full flex-1 bg-slate-100 dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-2xl px-3 py-2.5 text-slate-800 dark:text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  <div className="flex w-full gap-2 sm:w-auto">
                    <button
                    type="button"
                    onClick={() => {
                      setOrderTime(getLocalDateTime(new Date()));
                      setSoiecTimeValidated(false);
                    }}
                    disabled={isOiLocked}
                    className="shrink-0 rounded-2xl bg-slate-100 p-3 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-blue-300 dark:hover:border-blue-500/40 text-slate-600 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400 transition disabled:opacity-60 disabled:cursor-not-allowed"
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
                    className={`inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border px-3 py-2.5 text-sm font-semibold transition btn-success sm:flex-none ${
                      soiecTimeValidated
                        ? 'bg-emerald-600/15 text-emerald-700 border-emerald-300 dark:text-emerald-300 dark:border-emerald-500/40'
                        : ''
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    Valider
                    </button>
                  </div>
                </div>
                {soiecTimeValidated && (
                  <div className="text-xs text-emerald-600 dark:text-emerald-400">Groupe horaire validé.</div>
                )}
              </div>
            </div>
          </div>

      );

      const dominantSection = (
          <div className="flex min-w-0 flex-1 flex-col gap-2">
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

      );

      const draftStatusSection = (
        <>
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

        </>
      );

      return (
        <div className="flex flex-col gap-4 md:gap-5">
          <div className="hidden space-y-4 md:block">
            {addressSection}
            {dominantSection}
            {draftStatusSection}
          </div>

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
            mobileIntroSlides={[
              {
                id: 'address',
                label: 'Adresse',
                content: (
                  <div className="w-full rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
                    <h3 className="mb-3 text-base font-semibold text-slate-900 dark:text-white">Adresse et contexte</h3>
                    {addressSection}
                  </div>
                )
              },
              {
                id: 'dominante',
                label: 'Dominante',
                content: (
                  <div className="w-full rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
                    <h3 className="mb-3 text-base font-semibold text-slate-900 dark:text-white">Dominante de l&apos;intervention</h3>
                    {dominantSection}
                  </div>
                )
              }
            ]}
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
      const hasValidatedMessages = validatedAmbianceList.length > 0 || validatedCompteRenduList.length > 0;
      const demandeOptions = settings.messageDemandeOptions || [];
      const surLesLieuxOptions = settings.messageSurLesLieuxOptions || [];

      const ambianceModalContent = (
        <div className="grid min-w-0 grid-cols-1 gap-4 auto-rows-min xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.8fr)] 2xl:grid-cols-[minmax(0,1.85fr)_minmax(340px,0.65fr)]">
          <div className="order-2 min-w-0 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5 xl:order-2">
            <div>
              <h4 className="text-lg font-semibold text-slate-900 dark:text-white">Contexte du message</h4>
              <p className="text-sm text-slate-600 dark:text-gray-400">Cadrez l&apos;émission avant de rédiger.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-white/10 px-3 py-1 text-xs font-medium text-slate-600 dark:text-gray-300">
                {roleLabel || 'Chef de groupe'}
              </span>
              <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
                ambianceMessage.stamped
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                  : 'bg-slate-200/80 text-slate-600 dark:bg-white/10 dark:text-gray-300'
              }`}>
                <Clock className="w-3.5 h-3.5" />
                {ambianceMessage.stamped ? 'Horodaté' : 'À horodater'}
              </span>
            </div>
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_110px]">
              <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_112px]">
                <div className="flex min-w-0 flex-col gap-1">
                  <label className="text-[10px] uppercase tracking-[0.25em] text-slate-500 dark:text-gray-400">Date</label>
                  <input
                    type="date"
                    value={ambianceMessage.date}
                    onChange={(e) =>
                      setAmbianceMessage((prev) => ({
                        ...prev,
                        date: e.target.value,
                        stamped: false
                      }))
                    }
                    className={`${MESSAGE_INPUT_CLASS} min-w-0 text-center sm:text-left`}
                  />
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <label className="text-[10px] uppercase tracking-[0.25em] text-slate-500 dark:text-gray-400">Heure</label>
                  <input
                    type="time"
                    value={ambianceMessage.time}
                    onChange={(e) =>
                      setAmbianceMessage((prev) => ({
                        ...prev,
                        time: e.target.value,
                        stamped: false
                      }))
                    }
                    className={`${MESSAGE_INPUT_CLASS} min-w-0 text-center sm:text-left`}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const nowStamp = getNowStamp();
                  setAmbianceMessage((prev) => ({
                    ...prev,
                    stamped: true,
                    date: prev.date || nowStamp.date,
                    time: prev.time || nowStamp.time
                  }));
                }}
                data-no-pill
                className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition self-end sm:w-auto ${
                  ambianceMessage.stamped
                    ? 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100'
                    : 'bg-red-600 hover:bg-red-500 text-white'
                }`}
              >
                <Check className="w-4 h-4" />
                Horodater
              </button>
            </div>
          </div>

          <div className="order-1 min-w-0 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5 xl:col-span-1 xl:grid xl:grid-cols-2 xl:gap-x-4 xl:gap-y-4 xl:space-y-0">
            <div className="xl:col-span-2">
              <h4 className="text-lg font-semibold text-slate-900 dark:text-white">Rédiger le message</h4>
              <p className="text-sm text-slate-600 dark:text-gray-400">Renseignez uniquement les éléments utiles à la transmission.</p>
            </div>
            <div className="min-w-0 space-y-1 xl:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-sm font-medium text-slate-600 dark:text-gray-300">Je suis</label>
                <button
                  type="button"
                  onClick={() => {
                    if (!isAddressAvailable) return;
                    setAmbianceMessage((prev) => ({
                      ...prev,
                      jeSuis: fullAddress,
                      addressConfirmed: true
                    }));
                  }}
                  disabled={!isAddressAvailable}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                    ambianceMessage.addressConfirmed
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-300 dark:bg-white/5 dark:border-white/10 dark:text-gray-200'
                  } ${!isAddressAvailable ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <Check className="w-4 h-4" />
                  Utiliser l&apos;adresse
                </button>
              </div>
              <textarea
                value={ambianceMessage.jeSuis}
                onChange={(e) =>
                  setAmbianceMessage((prev) => ({
                    ...prev,
                    jeSuis: e.target.value,
                    addressConfirmed: false
                  }))
                }
                rows={3}
                placeholder="Votre position, votre mission, votre action en cours."
                className={`atlas-resizable-textarea ${MESSAGE_INPUT_CLASS}`}
              />
              {!isAddressAvailable && (
                <div className="text-xs text-amber-600 dark:text-amber-400">
                  Adresse non renseignée dans l&apos;intervention.
                </div>
              )}
            </div>
            <div className="min-w-0 space-y-1">
              <label className="text-sm font-medium text-slate-600 dark:text-gray-300">Je vois</label>
              <textarea
                value={ambianceMessage.jeVois}
                onChange={(e) => setAmbianceMessage((prev) => ({ ...prev, jeVois: e.target.value }))}
                rows={3}
                placeholder="Ce que vous observez sur place."
                className={`atlas-resizable-textarea ${MESSAGE_INPUT_CLASS}`}
              />
            </div>
            <div className="min-w-0 space-y-1">
              <label className="text-sm font-medium text-slate-600 dark:text-gray-300">Je demande</label>
              <textarea
                value={ambianceMessage.jeDemande}
                onChange={(e) => setAmbianceMessage((prev) => ({ ...prev, jeDemande: e.target.value }))}
                rows={3}
                placeholder="Renforts, moyens, consignes."
                className={`atlas-resizable-textarea ${MESSAGE_INPUT_CLASS}`}
              />
            </div>
          </div>

          <details className="group order-3 min-w-0 rounded-2xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5 xl:col-span-2">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-left">
              <span>
                <span className="block text-base font-semibold text-slate-900 dark:text-white">Compléments opérationnels</span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-open:rotate-90" />
            </summary>
            <div className="space-y-3 border-t border-slate-200 p-4 dark:border-white/10">
              <DemandesSection
                value={ambianceMessage.demandes}
                onChange={(next) => setAmbianceMessage((prev) => ({ ...prev, demandes: next }))}
                options={demandeOptions}
              />
              <SurLesLieuxSection
                value={ambianceMessage.surLesLieux}
                onChange={(next) => setAmbianceMessage((prev) => ({ ...prev, surLesLieux: next }))}
                options={surLesLieuxOptions}
              />
            </div>
          </details>

        </div>
      );

      const compteRenduModalContent = (
        <div className="grid min-w-0 grid-cols-1 gap-4 auto-rows-min xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.8fr)] 2xl:grid-cols-[minmax(0,1.85fr)_minmax(340px,0.65fr)]">
          <div className="order-2 min-w-0 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5 xl:order-2">
            <div>
              <h4 className="text-lg font-semibold text-slate-900 dark:text-white">Contexte du message</h4>
              <p className="text-sm text-slate-600 dark:text-gray-400">Cadrez l&apos;émission avant de renseigner le compte rendu.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-white/10 px-3 py-1 text-xs font-medium text-slate-600 dark:text-gray-300">
                {roleLabel || 'Chef de groupe'}
              </span>
              <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
                compteRenduMessage.stamped
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                  : 'bg-slate-200/80 text-slate-600 dark:bg-white/10 dark:text-gray-300'
              }`}>
                <Clock className="w-3.5 h-3.5" />
                {compteRenduMessage.stamped ? 'Horodaté' : 'À horodater'}
              </span>
            </div>
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_110px]">
              <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_112px]">
                <div className="flex min-w-0 flex-col gap-1">
                  <label className="text-[10px] uppercase tracking-[0.25em] text-slate-500 dark:text-gray-400">Date</label>
                  <input
                    type="date"
                    value={compteRenduMessage.date}
                    onChange={(e) =>
                      setCompteRenduMessage((prev) => ({
                        ...prev,
                        date: e.target.value,
                        stamped: false
                      }))
                    }
                    className={`${MESSAGE_INPUT_CLASS} min-w-0 text-center sm:text-left`}
                  />
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <label className="text-[10px] uppercase tracking-[0.25em] text-slate-500 dark:text-gray-400">Heure</label>
                  <input
                    type="time"
                    value={compteRenduMessage.time}
                    onChange={(e) =>
                      setCompteRenduMessage((prev) => ({
                        ...prev,
                        time: e.target.value,
                        stamped: false
                      }))
                    }
                    className={`${MESSAGE_INPUT_CLASS} min-w-0 text-center sm:text-left`}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const nowStamp = getNowStamp();
                  setCompteRenduMessage((prev) => ({
                    ...prev,
                    stamped: true,
                    date: prev.date || nowStamp.date,
                    time: prev.time || nowStamp.time
                  }));
                }}
                data-no-pill
                className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition self-end sm:w-auto ${
                  compteRenduMessage.stamped
                    ? 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100'
                    : 'bg-red-600 hover:bg-red-500 text-white'
                }`}
              >
                <Check className="w-4 h-4" />
                Horodater
              </button>
            </div>
          </div>

          <div className="order-1 min-w-0 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5 xl:col-span-1 xl:grid xl:grid-cols-2 xl:gap-x-4 xl:gap-y-4 xl:space-y-0">
            <div className="xl:col-span-2">
              <h4 className="text-lg font-semibold text-slate-900 dark:text-white">Rédiger le compte rendu</h4>
              <p className="text-sm text-slate-600 dark:text-gray-400">Présentez la situation, l&apos;évolution et les besoins de manière concise.</p>
            </div>
            <div className="min-w-0 space-y-1 xl:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-sm font-medium text-slate-600 dark:text-gray-300">Je suis</label>
                <button
                  type="button"
                  onClick={() => {
                    if (!isAddressAvailable) return;
                    setCompteRenduMessage((prev) => ({
                      ...prev,
                      jeSuis: fullAddress,
                      addressConfirmed: true
                    }));
                  }}
                  disabled={!isAddressAvailable}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                    compteRenduMessage.addressConfirmed
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-300 dark:bg-white/5 dark:border-white/10 dark:text-gray-200'
                  } ${!isAddressAvailable ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <Check className="w-4 h-4" />
                  Utiliser l&apos;adresse
                </button>
              </div>
              <textarea
                value={compteRenduMessage.jeSuis}
                onChange={(e) =>
                  setCompteRenduMessage((prev) => ({
                    ...prev,
                    jeSuis: e.target.value,
                    addressConfirmed: false
                  }))
                }
                rows={2}
                placeholder="Votre position, votre mission, votre action en cours."
                className={`atlas-resizable-textarea ${MESSAGE_INPUT_CLASS}`}
              />
              {!isAddressAvailable && (
                <div className="text-xs text-amber-600 dark:text-amber-400">
                  Adresse non renseignée dans l&apos;intervention.
                </div>
              )}
            </div>
            <div className="min-w-0 space-y-1">
              <label className="text-sm font-medium text-slate-600 dark:text-gray-300">Je vois</label>
              <textarea
                value={compteRenduMessage.jeVois}
                onChange={(e) => setCompteRenduMessage((prev) => ({ ...prev, jeVois: e.target.value }))}
                rows={2}
                placeholder="Ce que vous constatez sur place."
                className={`atlas-resizable-textarea ${MESSAGE_INPUT_CLASS}`}
              />
            </div>
            <div className="min-w-0 space-y-1">
              <label className="text-sm font-medium text-slate-600 dark:text-gray-300">Je prévois</label>
              <textarea
                value={compteRenduMessage.jePrevois}
                onChange={(e) => setCompteRenduMessage((prev) => ({ ...prev, jePrevois: e.target.value }))}
                rows={2}
                placeholder="Hypothèses ou prochaines actions."
                className={`atlas-resizable-textarea ${MESSAGE_INPUT_CLASS}`}
              />
            </div>
            <div className="min-w-0 space-y-1">
              <label className="text-sm font-medium text-slate-600 dark:text-gray-300">Je fais</label>
              <textarea
                value={compteRenduMessage.jeFais}
                onChange={(e) => setCompteRenduMessage((prev) => ({ ...prev, jeFais: e.target.value }))}
                rows={2}
                placeholder="Actions en cours ou réalisées."
                className={`atlas-resizable-textarea ${MESSAGE_INPUT_CLASS}`}
              />
            </div>
            <div className="min-w-0 space-y-1">
              <label className="text-sm font-medium text-slate-600 dark:text-gray-300">Je demande</label>
              <textarea
                value={compteRenduMessage.jeDemande}
                onChange={(e) => setCompteRenduMessage((prev) => ({ ...prev, jeDemande: e.target.value }))}
                rows={2}
                placeholder="Renforts, moyens, consignes."
                className={`atlas-resizable-textarea ${MESSAGE_INPUT_CLASS}`}
              />
            </div>
          </div>

          <details className="group order-3 min-w-0 rounded-2xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5 xl:col-span-2">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-left">
              <span>
                <span className="block text-base font-semibold text-slate-900 dark:text-white">Compléments opérationnels</span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-open:rotate-90" />
            </summary>
            <div className="space-y-3 border-t border-slate-200 p-4 dark:border-white/10">
              <DemandesSection
                value={compteRenduMessage.demandes}
                onChange={(next) => setCompteRenduMessage((prev) => ({ ...prev, demandes: next }))}
                options={demandeOptions}
              />
              <SurLesLieuxSection
                value={compteRenduMessage.surLesLieux}
                onChange={(next) => setCompteRenduMessage((prev) => ({ ...prev, surLesLieux: next }))}
                options={surLesLieuxOptions}
              />
            </div>
          </details>

        </div>
      );

      const isAmbianceModal = messageModal === 'ambiance';
      const activeModalContent = isAmbianceModal ? ambianceModalContent : compteRenduModalContent;
      const [contextSection, draftSection, complementsSection] = React.Children.toArray(activeModalContent.props.children);
      const complementsBody = React.isValidElement<{ children?: React.ReactNode }>(complementsSection)
        ? React.Children.toArray(complementsSection.props.children)[1]
        : null;
      const mobileComplementsCard = (
        <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5">
          <div className="flex min-h-14 items-center justify-between gap-4 px-4 py-3 text-left">
            <span className="block text-base font-semibold text-slate-900 dark:text-white">Compléments opérationnels</span>
            <ChevronRight className="h-5 w-5 shrink-0 rotate-90 text-slate-400" />
          </div>
          {complementsBody}
        </div>
      );
      const mobileModalContent = (
        <div className="min-w-0">
          <Swiper
            slidesPerView={1}
            spaceBetween={12}
            autoHeight
            observer
            observeParents
            observeSlideChildren
            allowTouchMove
            resistance
            resistanceRatio={0.85}
            onSwiper={(swiper) => {
              messageMobileSwiperRef.current = swiper;
            }}
            onSlideChange={(swiper) => setMessageMobileSlideIndex(swiper.activeIndex)}
            pagination={false}
            className="atlas-mobile-slider"
            aria-label="Navigation de la rédaction du message"
          >
            <SwiperSlide className="!h-auto">{contextSection}</SwiperSlide>
            <SwiperSlide className="!h-auto">{draftSection}</SwiperSlide>
            <SwiperSlide className="!h-auto">{mobileComplementsCard}</SwiperSlide>
          </Swiper>
          <div className="mt-2 flex min-h-7 items-center justify-center gap-1.5" aria-label="Position dans la rédaction du message">
            {['Contexte', 'Rédaction', 'Compléments'].map((label, index) => (
              <button
                key={label}
                type="button"
                onClick={() => messageMobileSwiperRef.current?.slideTo(index)}
                className="flex min-h-7 min-w-7 items-center justify-center rounded-full"
                aria-label={`Afficher la carte ${label}`}
                aria-current={messageMobileSlideIndex === index ? 'step' : undefined}
              >
                <span
                  className={`block h-2 rounded-full transition-all ${messageMobileSlideIndex === index ? 'w-5 bg-red-600' : 'w-2 bg-slate-300 dark:bg-slate-600'}`}
                />
              </button>
            ))}
          </div>
        </div>
      );
      const activeDraftMessage = isAmbianceModal ? ambianceMessage : compteRenduMessage;
      const activeTitle = isAmbianceModal ? 'Message d’ambiance' : 'Message de compte rendu';
      const isEditingActiveMessage = editingMessage?.type === messageModal;
      const activeActionLabel = isEditingActiveMessage
        ? 'Enregistrer la modification'
        : isAmbianceModal
          ? (latestValidatedAmbiance ? 'Ajouter ce message' : 'Valider le message')
          : (latestValidatedCompteRendu ? 'Ajouter ce message' : 'Valider le compte rendu');
      const activeAction = isAmbianceModal ? handleValidateAmbiance : handleValidateCompteRendu;
      const activeActionClass = isAmbianceModal
        ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/20'
        : 'bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/20 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100';

      return (
        <div className="flex flex-col gap-5">
          <details
            className="group order-2 rounded-2xl border border-slate-200 bg-white/90 shadow-sm dark:border-white/10 dark:bg-white/5"
            open={validatedMessagesOpen}
            onToggle={(event) => setValidatedMessagesOpen(event.currentTarget.open)}
          >
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-left md:px-5">
              <span className="min-w-0">
                <span className="block text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-gray-400">Messages validés</span>
                <span className="mt-1 block text-xs text-slate-500 dark:text-gray-400">Derniers messages validés</span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-open:rotate-90" />
            </summary>

            <div className="space-y-4 border-t border-slate-200 p-4 dark:border-white/10 md:p-5">
              {hasValidatedMessages ? (
                <div className="space-y-3">
                {validatedAmbianceList.map((message, index) => {
                  const demandesSummary = buildMessageDemandesSummary(message.demandes, demandeOptions);
                  const surLesLieuxSummary = buildMessageSurLesLieuxSummary(message.surLesLieux, surLesLieuxOptions);
                  const messageKey = `ambiance-${message.date}-${message.time}-${index}`;
                  const isCollapsed = Boolean(collapsedValidatedMessages[messageKey]);
                  return (
                    <div
                      key={messageKey}
                      className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 p-3 md:p-4 space-y-3"
                    >
                      <div className="flex flex-wrap items-start gap-2">
                        <button
                          type="button"
                          onClick={() => toggleValidatedMessage(messageKey)}
                          className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-2 text-left"
                        >
                          <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-gray-100">
                            <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
                            <span>Message d&apos;ambiance #{index + 1}</span>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-gray-400">
                            {message.date} {message.time}
                          </div>
                        </button>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleEditAmbiance(index)}
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:border-white/20 dark:hover:text-white"
                            aria-label={`Modifier le message d’ambiance ${index + 1}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Modifier</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAmbiance(index)}
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 text-xs font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-100 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300 dark:hover:border-red-500/40"
                            aria-label={`Supprimer le message d’ambiance ${index + 1}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Supprimer</span>
                          </button>
                        </div>
                      </div>
                      {!isCollapsed && (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-6 gap-y-2">
                          <MessageSummaryRow label="Je suis" value={message.jeSuis} />
                          <MessageSummaryRow label="Je vois" value={message.jeVois} />
                          <MessageSummaryRow label="Je demande" value={message.jeDemande} />
                          <MessageSummaryRow label="Demandes" value={demandesSummary.length ? demandesSummary.join(', ') : '-'} />
                          <MessageSummaryRow label="Sur les lieux" value={surLesLieuxSummary.length ? surLesLieuxSummary.join(', ') : '-'} />
                        </div>
                      )}
                    </div>
                  );
                })}

                {validatedCompteRenduList.map((message, index) => {
                  const demandesSummary = buildMessageDemandesSummary(message.demandes, demandeOptions);
                  const surLesLieuxSummary = buildMessageSurLesLieuxSummary(message.surLesLieux, surLesLieuxOptions);
                  const messageKey = `compte-rendu-${message.date}-${message.time}-${index}`;
                  const isCollapsed = Boolean(collapsedValidatedMessages[messageKey]);
                  return (
                    <div
                      key={messageKey}
                      className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 p-3 md:p-4 space-y-3"
                    >
                      <div className="flex flex-wrap items-start gap-2">
                        <button
                          type="button"
                          onClick={() => toggleValidatedMessage(messageKey)}
                          className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-2 text-left"
                        >
                          <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-gray-100">
                            <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
                            <span>Message de compte rendu #{index + 1}</span>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-gray-400">
                            {message.date} {message.time}
                          </div>
                        </button>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleEditCompteRendu(index)}
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:border-white/20 dark:hover:text-white"
                            aria-label={`Modifier le compte rendu ${index + 1}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Modifier</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCompteRendu(index)}
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 text-xs font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-100 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300 dark:hover:border-red-500/40"
                            aria-label={`Supprimer le compte rendu ${index + 1}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Supprimer</span>
                          </button>
                        </div>
                      </div>
                      {!isCollapsed && (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-6 gap-y-2">
                          <MessageSummaryRow label="Je suis" value={message.jeSuis} />
                          <MessageSummaryRow label="Je vois" value={message.jeVois} />
                          <MessageSummaryRow label="Je prévois" value={message.jePrevois} />
                          <MessageSummaryRow label="Je fais" value={message.jeFais} />
                          <MessageSummaryRow label="Je demande" value={message.jeDemande} />
                          <MessageSummaryRow label="Demandes" value={demandesSummary.length ? demandesSummary.join(', ') : '-'} />
                          <MessageSummaryRow label="Sur les lieux" value={surLesLieuxSummary.length ? surLesLieuxSummary.join(', ') : '-'} />
                        </div>
                      )}
                    </div>
                  );
                })}
                </div>
              ) : (
                <div className="text-sm text-slate-500 dark:text-gray-400">
                  Aucun message validé pour le moment.
                </div>
              )}
            </div>
          </details>

          <section className="order-1 space-y-4">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setEditingMessage(null);
                setMessageModal('ambiance');
              }}
              className="group rounded-2xl border border-red-200 bg-white p-5 text-left shadow-sm transition hover:border-red-300 hover:shadow-md dark:border-red-500/25 dark:bg-[#121722] dark:hover:border-red-500/40 md:p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300">
                    <Radio className="h-6 w-6" />
                  </span>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Message d&apos;ambiance</h3>
                    <p className="mt-1 max-w-xl text-sm leading-6 text-slate-600 dark:text-gray-300">
                      Transmettre rapidement la situation initiale, ce que vous voyez et vos premières demandes.
                    </p>
                  </div>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-red-600 transition-transform group-hover:translate-x-0.5 dark:text-red-300">
                  <ChevronRight className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-white/10 dark:text-gray-400">
                <span><strong className="font-semibold text-slate-700 dark:text-gray-200">{ambianceMessage.date || '-'}</strong> · {ambianceMessage.time || '-'}</span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {ambianceMessage.stamped ? 'Horodaté' : 'Brouillon à horodater'}
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingMessage(null);
                setMessageModal('compte-rendu');
              }}
              className="group rounded-2xl border border-slate-300 bg-white p-5 text-left shadow-sm transition hover:border-slate-400 hover:shadow-md dark:border-white/15 dark:bg-[#121722] dark:hover:border-white/25 md:p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-800 dark:bg-white/10 dark:text-white">
                    <MessageSquareText className="h-6 w-6" />
                  </span>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Message de compte rendu</h3>
                    <p className="mt-1 max-w-xl text-sm leading-6 text-slate-600 dark:text-gray-300">
                      Actualiser l&apos;évolution, les actions menées, les prévisions et les besoins.
                    </p>
                  </div>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-600 transition-transform group-hover:translate-x-0.5 dark:text-gray-300">
                  <ChevronRight className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-white/10 dark:text-gray-400">
                <span><strong className="font-semibold text-slate-700 dark:text-gray-200">{compteRenduMessage.date || '-'}</strong> · {compteRenduMessage.time || '-'}</span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {compteRenduMessage.stamped ? 'Horodaté' : 'Brouillon à horodater'}
                </span>
              </div>
            </button>
            </div>
          </section>

          {messageModal && typeof document !== 'undefined' && createPortal(
            <div className="fixed inset-0 z-[999] overflow-hidden bg-slate-950/60 backdrop-blur-[6px]">
              <div className="absolute inset-0 atlas-grid opacity-40" />
              <div className="relative flex h-[100dvh] w-[100dvw] flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.95),_rgba(241,245,249,0.98)_48%,_rgba(226,232,240,0.98)_100%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.98),_rgba(10,14,24,0.99)_52%,_rgba(2,6,23,1)_100%)]">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-white/75 via-white/30 to-transparent dark:from-white/5 dark:via-transparent" />
                <div className="relative flex min-h-0 h-full w-full flex-1 flex-col overflow-hidden border-white/70 bg-white/88 shadow-[0_28px_90px_-40px_rgba(15,23,42,0.5)] backdrop-blur-xl dark:border-white/10 dark:bg-[#0c1220]/92">
                  <div className="border-b border-slate-200/80 bg-white/80 px-3 py-3 backdrop-blur dark:border-white/10 dark:bg-[#0c1220]/85 sm:px-4 md:px-6 md:py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                          isAmbianceModal
                            ? 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300'
                            : 'bg-slate-100 text-slate-800 dark:bg-white/10 dark:text-white'
                        }`}>
                          {isAmbianceModal ? <Radio className="h-5 w-5" /> : <MessageSquareText className="h-5 w-5" />}
                        </span>
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-gray-400">
                            {isEditingActiveMessage ? 'Modification du message' : 'Rédaction du message'}
                          </p>
                          <h3 className="mt-0.5 break-words text-lg font-bold text-slate-950 dark:text-white sm:text-xl md:text-2xl">{activeTitle}</h3>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
                              {roleLabel || 'Chef de groupe'}
                            </span>
                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium ${
                              activeDraftMessage.stamped
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                                : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-gray-300'
                            }`}>
                              <Clock className="h-3.5 w-3.5" />
                              {activeDraftMessage.stamped ? 'Horodaté' : 'Brouillon en cours'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleCloseMessageModal}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:border-white/20 dark:hover:text-white"
                        aria-label="Fermer la fenêtre"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 pb-28 sm:px-4 sm:py-4 md:px-6 md:py-5 md:pb-28">
                    <div className="hidden md:block">
                      {activeModalContent}
                    </div>
                    <div className="md:hidden">
                      {mobileModalContent}
                    </div>
                  </div>

                  <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-4 md:px-6 md:pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
                    <div className="pointer-events-auto flex w-full items-center rounded-2xl border border-slate-200/80 bg-white/95 p-2.5 shadow-[0_18px_48px_-34px_rgba(15,23,42,0.4)] backdrop-blur dark:border-white/10 dark:bg-[#0f172a]/95 md:p-3">
                      <button
                        type="button"
                        onClick={activeAction}
                        data-no-pill
                        className={`min-h-12 flex-1 rounded-xl px-4 py-3 text-sm font-bold transition sm:px-5 sm:text-base ${activeActionClass}`}
                      >
                        {activeActionLabel}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )}
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
    validatedAmbiance: latestValidatedAmbiance ?? undefined,
    validatedCompteRendu: latestValidatedCompteRendu ?? undefined,
    validatedAmbianceList: validatedAmbianceList.length ? validatedAmbianceList : undefined,
    validatedCompteRenduList: validatedCompteRenduList.length ? validatedCompteRenduList : undefined,
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
    latestValidatedAmbiance,
    latestValidatedCompteRendu,
    validatedAmbianceList,
    validatedCompteRenduList
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
      setAmbianceMessage(normalizeAmbianceMessage(draft.ambianceMessage));
    }
    if (draft.compteRenduMessage) {
      setCompteRenduMessage(normalizeCompteRenduMessage(draft.compteRenduMessage));
    }
    if (draft.validatedAmbianceList?.length) {
      setValidatedAmbianceList(draft.validatedAmbianceList.map((message) => normalizeAmbianceMessage(message)));
    } else if (draft.validatedAmbiance) {
      setValidatedAmbianceList([normalizeAmbianceMessage(draft.validatedAmbiance)]);
    }
    if (draft.validatedCompteRenduList?.length) {
      setValidatedCompteRenduList(draft.validatedCompteRenduList.map((message) => normalizeCompteRenduMessage(message)));
    } else if (draft.validatedCompteRendu) {
      setValidatedCompteRenduList([normalizeCompteRenduMessage(draft.validatedCompteRendu)]);
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
      validatedAmbiance: latestValidatedAmbiance,
      validatedCompteRendu: latestValidatedCompteRendu,
      validatedAmbianceList,
      validatedCompteRenduList,
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
    latestValidatedAmbiance,
    latestValidatedCompteRendu,
    validatedAmbianceList,
    validatedCompteRenduList,
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

  const toggleValidatedMessage = React.useCallback((key: string) => {
    setCollapsedValidatedMessages((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  }, []);

  const handleValidateAmbiance = () => {
    const nowStamp = getNowStamp();
    const isEditing = editingMessage?.type === 'ambiance';
    const stampedMessage: AmbianceMessage = {
      ...ambianceMessage,
      stamped: true,
      date: isEditing ? nowStamp.date : (ambianceMessage.date || nowStamp.date),
      time: isEditing ? nowStamp.time : (ambianceMessage.time || nowStamp.time)
    };
    if (isEditing && editingMessage) {
      setValidatedAmbianceList((prev) => prev.map((message, index) => (
        index === editingMessage.index ? stampedMessage : message
      )));
    } else {
      setValidatedAmbianceList((prev) => [stampedMessage, ...prev]);
    }
    setAmbianceMessage(() => {
      const next = createAmbianceMessage();
      return fullAddress ? { ...next, jeSuis: fullAddress } : next;
    });
    setEditingMessage(null);
    setMessageModal(null);
    logInterventionEventSafe(
      'MESSAGE_AMBIANCE_VALIDATED',
      stampedMessage,
      buildInterventionMetrics('dictation.message.ambiance')
    );
  };

  const handleValidateCompteRendu = () => {
    const nowStamp = getNowStamp();
    const isEditing = editingMessage?.type === 'compte-rendu';
    const stampedMessage: CompteRenduMessage = {
      ...compteRenduMessage,
      stamped: true,
      date: isEditing ? nowStamp.date : (compteRenduMessage.date || nowStamp.date),
      time: isEditing ? nowStamp.time : (compteRenduMessage.time || nowStamp.time)
    };
    if (isEditing && editingMessage) {
      setValidatedCompteRenduList((prev) => prev.map((message, index) => (
        index === editingMessage.index ? stampedMessage : message
      )));
    } else {
      setValidatedCompteRenduList((prev) => [stampedMessage, ...prev]);
    }
    setCompteRenduMessage(() => {
      const next = createCompteRenduMessage();
      return fullAddress ? { ...next, jeSuis: fullAddress } : next;
    });
    setEditingMessage(null);
    setMessageModal(null);
    logInterventionEventSafe(
      'MESSAGE_COMPTE_RENDU_VALIDATED',
      stampedMessage,
      buildInterventionMetrics('dictation.message.compte_rendu')
    );
  };

  const handleEditAmbiance = (index: number) => {
    const message = validatedAmbianceList[index];
    if (!message) return;
    setAmbianceMessage(normalizeAmbianceMessage(message));
    setEditingMessage({ type: 'ambiance', index });
    setMessageModal('ambiance');
  };

  const handleEditCompteRendu = (index: number) => {
    const message = validatedCompteRenduList[index];
    if (!message) return;
    setCompteRenduMessage(normalizeCompteRenduMessage(message));
    setEditingMessage({ type: 'compte-rendu', index });
    setMessageModal('compte-rendu');
  };

  const handleDeleteAmbiance = (index: number) => {
    if (!validatedAmbianceList[index]) return;
    if (!window.confirm('Supprimer ce message d’ambiance validé ?')) return;
    setValidatedAmbianceList((prev) => prev.filter((_, messageIndex) => messageIndex !== index));
    setCollapsedValidatedMessages({});
    if (editingMessage?.type === 'ambiance' && editingMessage.index === index) {
      setEditingMessage(null);
      setMessageModal(null);
    }
  };

  const handleDeleteCompteRendu = (index: number) => {
    if (!validatedCompteRenduList[index]) return;
    if (!window.confirm('Supprimer ce compte rendu validé ?')) return;
    setValidatedCompteRenduList((prev) => prev.filter((_, messageIndex) => messageIndex !== index));
    setCollapsedValidatedMessages({});
    if (editingMessage?.type === 'compte-rendu' && editingMessage.index === index) {
      setEditingMessage(null);
      setMessageModal(null);
    }
  };

  const handleCloseMessageModal = () => {
    if (editingMessage?.type === 'ambiance') {
      const originalMessage = validatedAmbianceList[editingMessage.index];
      setAmbianceMessage(originalMessage ? normalizeAmbianceMessage(originalMessage) : createAmbianceMessage());
    }
    if (editingMessage?.type === 'compte-rendu') {
      const originalMessage = validatedCompteRenduList[editingMessage.index];
      setCompteRenduMessage(originalMessage ? normalizeCompteRenduMessage(originalMessage) : createCompteRenduMessage());
    }
    setEditingMessage(null);
    setMessageModal(null);
  };

  const handleValidateOrdreInitial = () => {
    if (!ordreData) {
      alert('Veuillez remplir au moins une section avant de valider.');
      return;
    }
    if (ordreValidatedAt && !isExtendedOps) return;
    const payload = buildOiPayloadData();
    if (!payload) {
      alert('Impossible de préparer les données de validation.');
      return;
    }
    const validatedLabel = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    setOrdreValidatedAt(validatedLabel);
    setLastOiValidatedAt(validatedLabel);
    logInterventionEventSafe(
      'OI_VALIDATED',
      payload,
      buildInterventionMetrics('dictation.soiec', { edit_count: selectedRisks.length }),
      undefined,
      oiLogicalId ? { logical_id: oiLogicalId } : undefined
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

  const handleSubmit = async () => {
    setIsLoading(true);
    try { await Haptics.impact({ style: ImpactStyle.Light }); } catch (err) {
      console.error('Haptics error', err);
    }

    try {
      if (!ordreData) {
        throw new Error('Veuillez remplir au moins une section avant de générer.');
      }

      const messageAmbiance = latestValidatedAmbiance ?? ambianceMessage;
      const messageCompteRendu = latestValidatedCompteRendu ?? compteRenduMessage;
      const dominante = selectedRisks.length > 0 ? selectedRisks[0] : 'Incendie';

      if (type === 'communication') {
        const situationText = getSimpleSectionText(ordreData.S);
        const objectifsList = getSimpleSectionContentList(ordreData.O);
        const ideeList = ordreData.I
          .filter((idea) => idea?.type !== 'separator' && idea?.type !== 'empty')
          .map((idea) => idea.mission);
        const executionText = Array.isArray(ordreData.E)
          ? ordreData.E
              .filter((entry) => {
                if (!entry || typeof entry !== 'object') return true;
                const record = entry as unknown as Record<string, unknown>;
                return record.type !== 'separator' && record.type !== 'empty';
              })
              .map((entry) => {
                if (typeof entry === 'string') return entry;
                const record = (entry ?? {}) as unknown as Record<string, unknown>;
                const mission = typeof record.mission === 'string' ? record.mission : '';
                const moyen = typeof record.moyen === 'string' ? record.moyen : '';
                return mission || moyen ? `${mission}: ${moyen}`.trim() : JSON.stringify(entry);
              })
              .join('\\n')
          : ordreData.E || '';
        const commandementText = getSimpleSectionText(ordreData.C);
        const communicationData = {
          situation: `S: ${situationText}\\nO: ${objectifsList.join(', ')}\\nI: ${ideeList.join(', ')}\\nE: ${executionText}\\nC: ${commandementText}`,
          groupe_horaire: new Date(),
          Engagement_secours: '',
          Situation_appel: '',
          Situation_arrivee: '',
          Nombre_victimes: '',
          Moyens: '',
          Actions_secours: '',
          Conseils_population: '',
          dominante,
          message_ambiance: messageAmbiance,
          message_compte_rendu: messageCompteRendu
        };

        await saveCommunicationData(communicationData);

        addToHistory({
          type: 'communication',
          situation: communicationData.situation,
          analysis: communicationData.situation
        });

        navigate('/results', {
          state: {
            analysis: communicationData.situation,
            type: 'communication',
            fromDictation: true
          }
        });
      } else {
        const anticipationItems = getSimpleSectionContentList(ordreData.A);
        const logistiqueItems = getSimpleSectionContentList(ordreData.L);
        const anticipation = anticipationItems.length > 0 ? anticipationItems.join('\\n') : undefined;
        const logistique = logistiqueItems.length > 0 ? logistiqueItems.join('\\n') : undefined;
        const situationText = getSimpleSectionText(ordreData.S);
        const objectifsList = getSimpleSectionContentList(ordreData.O);
        const commandementText = getSimpleSectionText(ordreData.C);
        const dataToSave = {
          type: type as 'group' | 'column' | 'site',
          situation: situationText || '',
          objectifs: objectifsList.join('\\n') || '',
          idees: ordreData.I
            .filter((idea) => idea?.type !== 'separator' && idea?.type !== 'empty')
            .map((idea) => idea.mission)
            .join('\\n') || '',
          execution: Array.isArray(ordreData.E)
            ? ordreData.E
                .filter((entry) => {
                  if (!entry || typeof entry !== 'object') return true;
                  const record = entry as unknown as Record<string, unknown>;
                  return record.type !== 'separator' && record.type !== 'empty';
                })
                .map((entry) => {
                  if (typeof entry === 'string') return entry;
                  const record = (entry ?? {}) as unknown as Record<string, unknown>;
                  const mission = typeof record.mission === 'string' ? record.mission : '';
                  const moyen = typeof record.moyen === 'string' ? record.moyen : '';
                  return mission || moyen ? `${mission}: ${moyen}`.trim() : JSON.stringify(entry);
                }).join('\\n')
            : ordreData.E || '',
          commandement: commandementText || '',
          ...(anticipation !== undefined ? { anticipation } : {}),
          ...(logistique !== undefined ? { logistique } : {}),
          groupe_horaire: new Date(),
          dominante,
          adresse: address,
          heure_ordre: orderTime,
          moyens: selectedMeans,
          message_ambiance: messageAmbiance,
          message_compte_rendu: messageCompteRendu
        };
        await saveDictationData(dataToSave);

        if (type === 'group' || type === 'column' || type === 'site') {
          const analysisParts = [
            dataToSave.anticipation,
            dataToSave.objectifs,
            dataToSave.idees,
            dataToSave.execution,
            dataToSave.commandement,
            dataToSave.logistique
          ].filter((part) => typeof part === 'string' && part.trim());
          addToHistory({
            type,
            situation: dataToSave.situation,
            analysis: analysisParts.join('\\n')
          });
        }

        navigate('/results', {
          state: {
            ordre: ordreData,
            type,
            fromDictation: true,
            isGroup: type === 'group',
            adresse: address,
            heure_ordre: orderTime
          }
        });
      }
    } catch (error) {
      console.error('Error saving data:', error);
      const message = error instanceof Error ? error.message : 'Une erreur est survenue lors de la sauvegarde. Veuillez réessayer.';
      alert(message);
    }
    setIsLoading(false);
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
    setValidatedAmbianceList([]);
    setValidatedCompteRenduList([]);
    setCollapsedValidatedMessages({});
    setValidatedMessagesOpen(true);
    setEditingMessage(null);
    setMessageModal(null);
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
    <div className="min-h-screen md:min-h-[100dvh] md:h-auto flex flex-col items-center justify-start relative overflow-x-hidden overflow-y-auto bg-slate-50 text-slate-900 dark:bg-[#0A0A0A] dark:text-white">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-200/70 dark:bg-blue-900/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-green-200/60 dark:bg-green-900/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-[98%] mx-auto px-2 pt-20 pb-4 sm:px-4 sm:pt-4 sm:pb-6 flex flex-col items-center">
        <div className="hidden sm:flex flex-col items-center mb-6 animate-fade-in-down">
          <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-500 dark:from-white dark:to-gray-400 mb-1">
            A.T.L.A.S
          </h1>
          <p className="text-slate-600 dark:text-gray-400 text-center text-xs md:text-sm font-light tracking-wide">
            Aide Tactique et Logique pour l'Action des Secours
          </p>
        </div>

        <div className="w-full flex-1 flex flex-col relative animate-fade-in-down md:min-h-0" style={{ animationDelay: '0.3s' }}>
          <div className="w-full flex-1 flex flex-col bg-white/90 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl overflow-visible md:overflow-hidden md:min-h-0 shadow-lg shadow-black/30 backdrop-blur-sm">
            <div className="flex flex-col gap-2 px-2 py-2 border-b border-slate-200 dark:border-white/10 bg-slate-100/70 dark:bg-white/5 sm:flex-row sm:flex-wrap sm:items-center sm:px-3">
              <div className="flex min-w-0 w-full gap-1.5 overflow-x-auto overscroll-x-contain pb-0.5 [scrollbar-width:none] sm:w-auto sm:flex-wrap sm:gap-2 sm:overflow-visible sm:pb-0">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      aria-selected={isActive}
                      className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-2 text-xs font-semibold transition btn-neutral sm:px-3 sm:text-sm ${isActive ? 'text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white'}`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-1.5 sm:ml-auto sm:w-auto sm:gap-3">
                {syncStatus !== 'idle' && (
                  <div
                    className={`min-w-0 shrink text-[10px] leading-tight sm:text-[11px] ${
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
                  <div className="max-w-20 truncate text-[10px] text-emerald-600 dark:text-emerald-300 sm:max-w-none sm:text-[11px]">
                    {closeNotice}
                  </div>
                )}
                {activeTab === 'soiec' && (
                  <div>
                    <button
                      onClick={() => setShowShareMenu((v) => !v)}
                      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-xs btn-neutral sm:h-auto sm:px-3 sm:py-2 sm:text-sm"
                      title="Partage et export"
                    >
                      <Share2 className="w-4 h-4" />
                      <span className="hidden sm:inline">Partage et export</span>
                      <span className="sm:hidden">Partager</span>
                    </button>
                  </div>
                )}
                {showShareMenu && (
                  <ViewportModal onClose={() => setShowShareMenu(false)} closeOnBackdrop>
                    <div
                      className="max-h-[calc(100dvh-1.5rem)] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-white/10 dark:bg-[#0f121a] sm:max-h-[calc(100dvh-2rem)] sm:p-5"
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="share-menu-title"
                    >
                      <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4 dark:border-white/10">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-gray-400">Partage et export</p>
                          <h3 id="share-menu-title" className="mt-1 text-xl font-bold text-slate-900 dark:text-white">Partager l&apos;intervention</h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowShareMenu(false)}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:text-gray-300 dark:hover:border-white/20 dark:hover:text-white"
                          aria-label="Fermer le partage"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>

                      <div className="mt-4 space-y-4">
                        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
                          <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-gray-400">Invitation</h4>
                          <button
                            onClick={handleOpenShareModal}
                            className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl btn-neutral px-4 py-3 text-sm font-semibold"
                          >
                            <QrCode className="h-4 w-4" />
                            Générer un QR Code
                          </button>
                        </section>

                        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
                          <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-gray-400">Partager le texte</h4>
                          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                            <button onClick={() => handleShareText('sms')} className="min-h-11 rounded-xl btn-neutral px-3 py-2 text-xs font-semibold">SMS</button>
                            <button onClick={() => handleShareText('whatsapp')} className="min-h-11 rounded-xl btn-neutral px-3 py-2 text-xs font-semibold">WhatsApp</button>
                            <button onClick={() => handleShareText('mail')} className="min-h-11 rounded-xl btn-neutral px-3 py-2 text-xs font-semibold">Mail</button>
                            <button onClick={handleCopyDraft} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl btn-neutral px-3 py-2 text-xs font-semibold"><ClipboardCopy className="h-4 w-4" />Copier</button>
                          </div>
                        </section>

                        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
                          <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-gray-400">Téléchargements</h4>
                          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                            <button onClick={handleDownloadImage} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl btn-neutral px-3 py-2 text-xs font-semibold"><ImageDown className="h-4 w-4" />Image</button>
                            <button onClick={() => handleShareFile('pdf')} className="min-h-11 rounded-xl btn-neutral px-3 py-2 text-xs font-semibold">PDF</button>
                            <button onClick={() => handleShareFile('word')} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl btn-neutral px-3 py-2 text-xs font-semibold"><FileText className="h-4 w-4" />Word</button>
                          </div>
                        </section>

                        {showShareHint && <div className="text-xs text-red-500 dark:text-red-300">Ajoutez au moins un élément avant de partager.</div>}
                      </div>
                    </div>
                  </ViewportModal>
                )}
                <button
                  onClick={() => setResetDialogOpen(true)}
                  className="shrink-0 whitespace-nowrap rounded-xl px-2.5 py-2 text-xs font-semibold btn-danger transition sm:px-3 sm:text-sm"
                >
                  Réinitialiser
                </button>
                <button
                  onClick={() => {
                    clearCloseError();
                    if (!isInterventionClosed) setCloseDialogOpen(true);
                  }}
                  disabled={isCloseDisabled}
                  className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border px-2.5 py-2 text-xs font-semibold text-white transition disabled:opacity-60 disabled:cursor-not-allowed sm:gap-2 sm:px-3 sm:text-sm ${
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
            <div className="flex-1 min-w-0 p-2 sm:p-3 md:p-5 overflow-visible md:overflow-y-auto md:overflow-x-hidden md:min-h-0">
              {renderTabContent()}
            </div>
      </div>

      {activeTab !== 'sitac' && activeTab !== 'moyens' && activeTab !== 'oct' && activeTab !== 'message' && (
        <>
          <div className="grid w-full grid-cols-1 md:grid-cols-2 gap-3 mt-6 mb-[calc(env(safe-area-inset-bottom,0)+12px)]">
            <button
              onClick={() => {
                if (type === 'communication') {
                  handleSubmit();
                } else {
                  handleValidateOrdreInitial();
                }
              }}
              disabled={isLoading}
              data-no-pill
              className={`group w-full transition-all duration-300 text-white py-4 rounded-2xl text-lg font-bold shadow-lg hover:-translate-y-0.5 flex items-center justify-center gap-3 ${
                ordreValidatedAt
                  ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 shadow-emerald-500/25 hover:shadow-emerald-500/40'
                      : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 shadow-red-500/25 hover:shadow-red-500/40'
                  } ${isLoading ? 'disabled:from-gray-700 disabled:to-gray-800' : ''}`}
                >
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Validation en cours...
                    </>
                  ) : ordreValidatedAt ? (
                    <>
                      Ordre initial validé à {ordreValidatedAt}
                      <Check className="w-5 h-5 text-emerald-200 group-hover:text-white" />
                    </>
                  ) : (
                    <>
                      Valider l&apos;ordre initial
                      <Sparkles className="w-5 h-5 text-blue-200 group-hover:text-white animate-pulse" />
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleGenerateConduite}
                  disabled={isLoading}
                  data-no-pill
                  className="group w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 disabled:from-gray-700 disabled:to-gray-800 transition-all duration-300 text-white py-4 rounded-2xl text-lg font-bold shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:-translate-y-0.5 flex items-center justify-center gap-3"
                >
                  Rédiger un ordre de conduite
                  <FileText className="w-5 h-5 text-purple-200 group-hover:text-white" />
                </button>
              </div>

              {showShareHint && activeTab === 'soiec' && (
                <div className="text-xs text-red-400 mt-2 text-right">Ajoutez au moins un élément avant de partager.</div>
              )}

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
        <ViewportModal onClose={() => setShareModalOpen(false)}>
          <div className="max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0f121a] sm:max-h-[calc(100dvh-2rem)]">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Inviter par QR Code</h3>
                <p className="text-xs text-slate-500 dark:text-gray-400">Scannez pour rejoindre l’intervention.</p>
              </div>
              <button
                type="button"
                onClick={() => setShareModalOpen(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:text-gray-400 dark:hover:border-white/20 dark:hover:text-white"
                aria-label="Fermer la fenêtre"
              >
                <X className="h-5 w-5" />
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
        </ViewportModal>
      )}

      {historyModalOpen && (
        <ViewportModal onClose={() => setHistoryModalOpen(false)}>
          <div className="w-full max-w-2xl max-h-[calc(100dvh-1.5rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0f121a] sm:max-h-[calc(100dvh-2rem)]">
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
            <div className="max-h-[calc(100dvh-7rem)] space-y-5 overflow-y-auto overscroll-contain p-4">
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
        </ViewportModal>
      )}

      {closeDialogOpen && (
        <ViewportModal onClose={() => {
          setCloseDialogOpen(false);
          clearCloseError();
        }}>
          <div className="w-full max-w-md max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0f121a] sm:max-h-[calc(100dvh-2rem)]">
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
        </ViewportModal>
      )}

      {resetDialogOpen && (
        <ViewportModal onClose={() => setResetDialogOpen(false)}>
          <div className="w-full max-w-md max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0f121a] sm:max-h-[calc(100dvh-2rem)]">
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
        </ViewportModal>
      )}
    </div>
  );
};

export default DictationInput;
