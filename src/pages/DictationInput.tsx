import React, { useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Sparkles, ClipboardCopy, Share2, FileText, ImageDown, Check, QrCode } from 'lucide-react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { saveDictationData, saveCommunicationData, saveInterventionShare, type InterventionSharePayload } from '../utils/firestore';
import * as QRCode from 'qrcode';
import DominantSelector, { DominanteType } from '../components/DominantSelector';
import OrdreInitialView from '../components/OrdreInitialView';
import { OrdreInitial } from '../types/soiec';
import { addToHistory } from '../utils/history';
import { exportBoardDesignImage, exportBoardDesignPdf, exportBoardDesignWordEditable, exportOrdreToClipboard, exportOrdreToImage, exportOrdreToPdf, shareOrdreAsText } from '../utils/export';
import MeansModal, { MeanItem } from '../components/MeansModal';
import SitacMap from './SitacMap';
import { OctDiagram } from './OctDiagram';
import { getOctTree, resetOctTree } from '../utils/octTreeStore';
import { useInterventionStore } from '../stores/useInterventionStore';
import { useSitacStore } from '../stores/useSitacStore';
import { INTERVENTION_DRAFT_KEY, INTERVENTION_SHARE_PREFIX } from '../constants/intervention';
import { useSessionSettings, type MessageCheckboxOption } from '../utils/sessionSettings';

const generateMeanId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `mean-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const getNowStamp = () => {
  const now = new Date();
  return {
    date: now.toISOString().slice(0, 10),
    time: now.toISOString().slice(11, 16)
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
  const record = input as Record<string, unknown>;
  return Object.keys(record).reduce<MessageSelections>((acc, key) => {
    if (typeof record[key] === 'boolean') acc[key] = Boolean(record[key]);
    return acc;
  }, {});
};

const normalizeDemandes = (input: unknown): MessageDemandes => {
  const base = createMessageDemandes();
  if (!input || typeof input !== 'object') return base;
  const record = input as Record<string, unknown>;
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
  const record = input as Record<string, unknown>;
  const selections = record.selections && typeof record.selections === 'object'
    ? normalizeSelections(record.selections)
    : normalizeSelections(record);
  return {
    ...base,
    selections,
    feuEteintHeure: typeof record.feuEteintHeure === 'string' ? record.feuEteintHeure : base.feuEteintHeure
  };
};

const buildDemandesSummary = (demandes: MessageDemandes | undefined, options: MessageCheckboxOption[]) => {
  if (!demandes) return [];
  const selected = options.filter((opt) => demandes.selections[opt.id]).map((opt) => opt.label);
  const moyensSp = MOYENS_SP_FIELDS
    .map(({ key, label }) => {
      const value = demandes[key].trim();
      return value ? `${label} ${value}` : '';
    })
    .filter(Boolean)
    .join(', ');
  if (moyensSp) selected.push(`Moyens SP: ${moyensSp}`);
  if (demandes.autresMoyensSp.trim()) selected.push(`Autres moyens SP: ${demandes.autresMoyensSp.trim()}`);
  if (demandes.autres.trim()) selected.push(`Autre(s): ${demandes.autres.trim()}`);
  return selected;
};

const buildSurLesLieuxSummary = (surLesLieux: MessageSurLesLieux | undefined, options: MessageCheckboxOption[]) => {
  if (!surLesLieux) return [];
  const selected = options
    .filter((opt) => opt.id !== FEU_ETEINT_ID && surLesLieux.selections[opt.id])
    .map((opt) => opt.label);
  const feuEteintOption = options.find((opt) => opt.id === FEU_ETEINT_ID);
  if (feuEteintOption && surLesLieux.selections[FEU_ETEINT_ID]) {
    const timeLabel = surLesLieux.feuEteintHeure.trim();
    selected.push(timeLabel ? `${feuEteintOption.label} ${timeLabel}` : feuEteintOption.label);
  }
  return selected;
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

const DictationInput = () => {
  const { type } = useParams();
  const [ordreData, setOrdreData] = useState<OrdreInitial | null>(null);
  const [selectedRisks, setSelectedRisks] = useState<DominanteType[]>([]);
  const address = useInterventionStore((s) => s.address);
  const city = useInterventionStore((s) => s.city);
  const setAddress = useInterventionStore((s) => s.setAddress);
  const setCity = useInterventionStore((s) => s.setCity);
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [soiecAddressValidated, setSoiecAddressValidated] = useState(false);
  const [soiecTimeValidated, setSoiecTimeValidated] = useState(false);
  const [orderTime, setOrderTime] = useState<string>(() => new Date().toISOString().slice(0, 16));
  const [isLoading, setIsLoading] = useState(false);
  const [ordreValidatedAt, setOrdreValidatedAt] = useState<string | null>(null);
  const [conduiteValidatedAt, setConduiteValidatedAt] = useState<string | null>(null);
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
  const [shareStatus, setShareStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [shareQrDataUrl, setShareQrDataUrl] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [selectedMeans, setSelectedMeans] = useState<MeanItem[]>([]);
  const [activeTab, setActiveTab] = useState<'soiec' | 'moyens' | 'oct' | 'message' | 'sitac' | 'aide'>('soiec');
  const [ambianceMessage, setAmbianceMessage] = useState<AmbianceMessage>(() => createAmbianceMessage());
  const [compteRenduMessage, setCompteRenduMessage] = useState<CompteRenduMessage>(() => createCompteRenduMessage());
  const [validatedAmbiance, setValidatedAmbiance] = useState<AmbianceMessage | null>(null);
  const [validatedCompteRendu, setValidatedCompteRendu] = useState<CompteRenduMessage | null>(null);
  const boardRef = React.useRef<HTMLDivElement>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [octResetKey, setOctResetKey] = useState(0);
  const [meansResetKey, setMeansResetKey] = useState(0);
  const [sitacResetKey, setSitacResetKey] = useState(0);
  const setExternalSearch = useSitacStore((s) => s.setExternalSearch);
  const { settings } = useSessionSettings();
  const fullAddress = React.useMemo(
    () => [address, city].filter(Boolean).join(', '),
    [address, city]
  );

  const normalizeMeans = React.useCallback((items: unknown[] | undefined): MeanItem[] => {
    if (!Array.isArray(items)) return [];
    return items.map((m) => {
      const record = (m ?? {}) as Record<string, unknown>;
      return {
        id: typeof record.id === 'string' ? record.id : generateMeanId(),
        name: typeof record.name === 'string' ? record.name : 'Moyen',
        status: record.status === 'demande' ? 'demande' : 'sur_place',
        category: typeof record.category === 'string' ? record.category : undefined
      };
    });
  }, []);

  const tabs = [
    { id: 'soiec' as const, label: 'SOIEC' },
    { id: 'moyens' as const, label: 'Moyens' },
    { id: 'oct' as const, label: 'OCT' },
    { id: 'message' as const, label: 'Message' },
    { id: 'sitac' as const, label: 'SITAC' },
    { id: 'aide' as const, label: 'Aide opérationnelle' }
  ];

  const renderTabContent = () => {
    if (activeTab === 'soiec') {
      return (
        <div className="flex flex-col gap-4 md:gap-5">
          <div className="flex flex-col gap-2 flex-1 min-w-[260px]">
            <label className="text-sm font-medium text-slate-600 dark:text-gray-400 ml-2 mb-1 block">
              Séléction du domaine de l'intervention (1er = principal, suivants = secondaires)
            </label>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <DominantSelector
                selectedRisks={selectedRisks}
                onChange={setSelectedRisks}
                className="justify-start flex-1"
                disabled={Boolean(ordreValidatedAt)}
              />
              <div className="relative">
                <button
                  onClick={() => setShowShareMenu((v) => !v)}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-200 hover:bg-slate-300 border border-slate-300 dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10 rounded-xl text-sm text-slate-700 dark:text-gray-200"
                >
                  <Share2 className="w-4 h-4" />
                  Partage & export
                </button>
                {showShareMenu && (
                  <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-[#0F121A] border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl p-3 space-y-2 z-30">
                    <div className="text-xs text-slate-500 dark:text-gray-400">Texte</div>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => handleShareText('sms')} className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-white/5 dark:hover:bg-white/10 rounded-lg text-xs text-slate-700 dark:text-gray-200">SMS</button>
                      <button onClick={() => handleShareText('whatsapp')} className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-white/5 dark:hover:bg-white/10 rounded-lg text-xs text-slate-700 dark:text-gray-200">WhatsApp</button>
                      <button onClick={() => handleShareText('mail')} className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-white/5 dark:hover:bg-white/10 rounded-lg text-xs text-slate-700 dark:text-gray-200">Mail</button>
                      <button onClick={handleCopyDraft} className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-white/5 dark:hover:bg-white/10 rounded-lg text-xs text-slate-700 dark:text-gray-200 flex items-center gap-1"><ClipboardCopy className="w-4 h-4" />Copier</button>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-gray-400 pt-1">Téléchargements</div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={handleDownloadImage} className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-white/5 dark:hover:bg-white/10 rounded-lg text-xs text-slate-700 dark:text-gray-200 flex items-center gap-1"><ImageDown className="w-4 h-4" />Image</button>
                    <button onClick={() => handleShareFile('pdf')} className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-white/5 dark:hover:bg-white/10 rounded-lg text-xs text-slate-700 dark:text-gray-200">PDF</button>
                    <button onClick={() => handleShareFile('word')} className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-white/5 dark:hover:bg-white/10 rounded-lg text-xs text-slate-700 dark:text-gray-200 flex items-center gap-1"><FileText className="w-4 h-4" />Word</button>
                  </div>
                  {showShareHint && <div className="text-[11px] text-red-400">Ajoutez au moins un élément avant de partager.</div>}
                </div>
              )}
            </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-[1.4fr,0.6fr] gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600 dark:text-gray-400 ml-2">Adresse de l'intervention</label>
                <input
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    setSoiecAddressValidated(false);
                  }}
                  placeholder="Ex: 12 rue de la Paix"
                  disabled={Boolean(ordreValidatedAt)}
                  className="w-full bg-slate-100 dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-2xl px-3 py-2.5 text-slate-800 dark:text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                />
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
                    disabled={Boolean(ordreValidatedAt)}
                    className="flex-1 bg-slate-100 dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-2xl px-3 py-2.5 text-slate-800 dark:text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  <button
                    type="button"
                    onClick={() => setSoiecAddressValidated(true)}
                    disabled={!fullAddress.trim() || Boolean(ordreValidatedAt)}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition ${
                      soiecAddressValidated
                        ? 'bg-emerald-600/15 text-emerald-700 border-emerald-300 dark:text-emerald-300 dark:border-emerald-500/40'
                        : 'bg-slate-200 text-slate-700 border-slate-300 hover:bg-slate-300 dark:bg-white/5 dark:text-gray-200 dark:border-white/10 dark:hover:bg-white/10'
                    } ${!fullAddress.trim() ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <Check className="w-4 h-4" />
                    Valider
                  </button>
                </div>
                {soiecAddressValidated && (
                  <div className="text-xs text-emerald-600 dark:text-emerald-400">Adresse validée.</div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[1.4fr,0.6fr] gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600 dark:text-gray-400 ml-2">Renseignements complémentaires</label>
                <input
                  value={additionalInfo}
                  onChange={(e) => setAdditionalInfo(e.target.value)}
                  placeholder={ADDITIONAL_INFO_PLACEHOLDER}
                  disabled={Boolean(ordreValidatedAt)}
                  className="w-full bg-slate-100 dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-2xl px-3 py-2.5 text-slate-800 dark:text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                />
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
                    disabled={Boolean(ordreValidatedAt)}
                    className="flex-1 bg-slate-100 dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-2xl px-3 py-2.5 text-slate-800 dark:text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const nowValue = new Date().toISOString().slice(0, 16);
                      setOrderTime((prev) => prev || nowValue);
                      setSoiecTimeValidated(true);
                    }}
                    disabled={Boolean(ordreValidatedAt)}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition ${
                      soiecTimeValidated
                        ? 'bg-emerald-600/15 text-emerald-700 border-emerald-300 dark:text-emerald-300 dark:border-emerald-500/40'
                        : 'bg-slate-200 text-slate-700 border-slate-300 hover:bg-slate-300 dark:bg-white/5 dark:text-gray-200 dark:border-white/10 dark:hover:bg-white/10'
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

          <div className="w-full text-xs text-slate-500 dark:text-gray-500">
            Brouillon sauvegardé automatiquement sur cet appareil (adresse, heure, contenu).
          </div>

          <OrdreInitialView
            ordre={ordreData}
            onChange={setOrdreData}
            hideToolbar={true}
            dominante={selectedRisks[0]}
            means={selectedMeans}
            type={type as 'group' | 'column' | 'site' | 'communication'}
            boardRef={boardRef}
            readOnly={Boolean(ordreValidatedAt)}
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
      const ambianceDemandesSummary = validatedAmbiance
        ? buildDemandesSummary(validatedAmbiance.demandes, demandeOptions)
        : [];
      const ambianceSurLesLieuxSummary = validatedAmbiance
        ? buildSurLesLieuxSummary(validatedAmbiance.surLesLieux, surLesLieuxOptions)
        : [];
      const compteRenduDemandesSummary = validatedCompteRendu
        ? buildDemandesSummary(validatedCompteRendu.demandes, demandeOptions)
        : [];
      const compteRenduSurLesLieuxSummary = validatedCompteRendu
        ? buildSurLesLieuxSummary(validatedCompteRendu.surLesLieux, surLesLieuxOptions)
        : [];
      return (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-white/5 p-4 md:p-5 space-y-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-xs uppercase text-slate-500 dark:text-gray-400 tracking-[0.2em]">Messages validés</p>
              </div>
              <span className="text-xs text-slate-500 dark:text-gray-400">Derniers messages validés</span>
            </div>

            {hasValidatedMessages ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {validatedAmbiance && (
                  <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-slate-800 dark:text-gray-100">Message d&apos;ambiance</div>
                      <div className="text-xs text-slate-500 dark:text-gray-400">
                        {validatedAmbiance.date} {validatedAmbiance.time}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-gray-400">Je suis</div>
                        <div className="text-sm text-slate-800 dark:text-gray-200 whitespace-pre-wrap">
                          {validatedAmbiance.jeSuis || '-'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-gray-400">Je vois</div>
                        <div className="text-sm text-slate-800 dark:text-gray-200 whitespace-pre-wrap">
                          {validatedAmbiance.jeVois || '-'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-gray-400">Je demande</div>
                        <div className="text-sm text-slate-800 dark:text-gray-200 whitespace-pre-wrap">
                          {validatedAmbiance.jeDemande || '-'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-gray-400">Demandes</div>
                        <div className="text-sm text-slate-800 dark:text-gray-200 whitespace-pre-wrap">
                          {ambianceDemandesSummary.length ? ambianceDemandesSummary.join(', ') : '-'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-gray-400">Sur les lieux</div>
                        <div className="text-sm text-slate-800 dark:text-gray-200 whitespace-pre-wrap">
                          {ambianceSurLesLieuxSummary.length ? ambianceSurLesLieuxSummary.join(', ') : '-'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {validatedCompteRendu && (
                  <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-slate-800 dark:text-gray-100">Message de compte rendu</div>
                      <div className="text-xs text-slate-500 dark:text-gray-400">
                        {validatedCompteRendu.date} {validatedCompteRendu.time}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-gray-400">Je suis</div>
                        <div className="text-sm text-slate-800 dark:text-gray-200 whitespace-pre-wrap">
                          {validatedCompteRendu.jeSuis || '-'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-gray-400">Je vois</div>
                        <div className="text-sm text-slate-800 dark:text-gray-200 whitespace-pre-wrap">
                          {validatedCompteRendu.jeVois || '-'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-gray-400">Je prévois</div>
                        <div className="text-sm text-slate-800 dark:text-gray-200 whitespace-pre-wrap">
                          {validatedCompteRendu.jePrevois || '-'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-gray-400">Je fais</div>
                        <div className="text-sm text-slate-800 dark:text-gray-200 whitespace-pre-wrap">
                          {validatedCompteRendu.jeFais || '-'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-gray-400">Je demande</div>
                        <div className="text-sm text-slate-800 dark:text-gray-200 whitespace-pre-wrap">
                          {validatedCompteRendu.jeDemande || '-'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-gray-400">Demandes</div>
                        <div className="text-sm text-slate-800 dark:text-gray-200 whitespace-pre-wrap">
                          {compteRenduDemandesSummary.length ? compteRenduDemandesSummary.join(', ') : '-'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-gray-400">Sur les lieux</div>
                        <div className="text-sm text-slate-800 dark:text-gray-200 whitespace-pre-wrap">
                          {compteRenduSurLesLieuxSummary.length ? compteRenduSurLesLieuxSummary.join(', ') : '-'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-slate-500 dark:text-gray-400">
                Aucun message validé pour le moment.
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-white/5 p-4 md:p-5 space-y-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-xl font-semibold">Message d&apos;ambiance</h3>
                </div>
                <span className="text-xs text-slate-500 dark:text-gray-400">Chef de groupe</span>
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex flex-col gap-1">
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
                      className="w-44 bg-white dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 shadow-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
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
                      className="w-28 bg-white dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 shadow-sm"
                    />
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
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold transition ${
                      ambianceMessage.stamped
                        ? 'bg-emerald-600/15 text-emerald-700 border-emerald-300 dark:text-emerald-300 dark:border-emerald-500/40'
                        : 'bg-slate-200 text-slate-700 border-slate-300 hover:bg-slate-300 dark:bg-white/5 dark:text-gray-200 dark:border-white/10 dark:hover:bg-white/10'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    Valider
                  </button>
                </div>
                {ambianceMessage.stamped && (
                  <div className="text-xs text-emerald-600 dark:text-emerald-400">Date/heure validées.</div>
                )}
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
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
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${
                        ambianceMessage.addressConfirmed
                          ? 'bg-emerald-600/15 text-emerald-700 border-emerald-300 dark:text-emerald-300 dark:border-emerald-500/40'
                          : 'bg-slate-200 text-slate-700 border-slate-300 hover:bg-slate-300 dark:bg-white/5 dark:text-gray-200 dark:border-white/10 dark:hover:bg-white/10'
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
                    rows={2}
                    placeholder="Votre position, votre mission, votre action en cours."
                    className="w-full bg-slate-100 dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-2xl px-3 py-2.5 text-slate-800 dark:text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 text-sm"
                  />
                  {!isAddressAvailable && (
                    <div className="text-xs text-amber-600 dark:text-amber-400">
                      Adresse non renseignée dans l&apos;intervention.
                    </div>
                  )}
                  {ambianceMessage.addressConfirmed && (
                    <div className="text-xs text-emerald-600 dark:text-emerald-400">
                      Adresse validée.
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-600 dark:text-gray-300">Je vois</label>
                  <input
                    value={ambianceMessage.jeVois}
                    onChange={(e) => setAmbianceMessage((prev) => ({ ...prev, jeVois: e.target.value }))}
                    placeholder="Ce que vous observez sur place."
                    className="w-full bg-slate-100 dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-2xl px-3 py-2.5 text-slate-800 dark:text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-600 dark:text-gray-300">Je demande</label>
                  <textarea
                    value={ambianceMessage.jeDemande}
                    onChange={(e) => setAmbianceMessage((prev) => ({ ...prev, jeDemande: e.target.value }))}
                    rows={2}
                    placeholder="Renforts, moyens, consignes."
                    className="w-full bg-slate-100 dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-2xl px-3 py-2.5 text-slate-800 dark:text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 text-sm"
                  />
                </div>
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

              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleValidateAmbiance}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition border ${
                    validatedAmbiance
                      ? 'bg-emerald-600/15 text-emerald-700 border-emerald-300 dark:text-emerald-300 dark:border-emerald-500/40'
                      : 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800 dark:bg-white/15 dark:text-white dark:border-white/30 dark:hover:bg-white/20'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  {validatedAmbiance ? 'Message validé' : 'Valider le message'}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-white/5 p-4 md:p-5 space-y-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-xl font-semibold">Message de compte rendu</h3>
                </div>
                <span className="text-xs text-slate-500 dark:text-gray-400">Chef de groupe</span>
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex flex-col gap-1">
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
                      className="w-44 bg-white dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 shadow-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
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
                      className="w-28 bg-white dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 shadow-sm"
                    />
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
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold transition ${
                      compteRenduMessage.stamped
                        ? 'bg-emerald-600/15 text-emerald-700 border-emerald-300 dark:text-emerald-300 dark:border-emerald-500/40'
                        : 'bg-slate-200 text-slate-700 border-slate-300 hover:bg-slate-300 dark:bg-white/5 dark:text-gray-200 dark:border-white/10 dark:hover:bg-white/10'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    Valider
                  </button>
                </div>
                {compteRenduMessage.stamped && (
                  <div className="text-xs text-emerald-600 dark:text-emerald-400">Date/heure validées.</div>
                )}
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
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
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${
                        compteRenduMessage.addressConfirmed
                          ? 'bg-emerald-600/15 text-emerald-700 border-emerald-300 dark:text-emerald-300 dark:border-emerald-500/40'
                          : 'bg-slate-200 text-slate-700 border-slate-300 hover:bg-slate-300 dark:bg-white/5 dark:text-gray-200 dark:border-white/10 dark:hover:bg-white/10'
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
                    className="w-full bg-slate-100 dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-2xl px-3 py-2.5 text-slate-800 dark:text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 text-sm"
                  />
                  {!isAddressAvailable && (
                    <div className="text-xs text-amber-600 dark:text-amber-400">
                      Adresse non renseignée dans l&apos;intervention.
                    </div>
                  )}
                  {compteRenduMessage.addressConfirmed && (
                    <div className="text-xs text-emerald-600 dark:text-emerald-400">
                      Adresse validée.
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-600 dark:text-gray-300">Je vois</label>
                  <textarea
                    value={compteRenduMessage.jeVois}
                    onChange={(e) => setCompteRenduMessage((prev) => ({ ...prev, jeVois: e.target.value }))}
                    rows={2}
                    placeholder="Ce que vous constatez sur place."
                    className="w-full bg-slate-100 dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-2xl px-3 py-2.5 text-slate-800 dark:text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-600 dark:text-gray-300">Je prévois</label>
                  <textarea
                    value={compteRenduMessage.jePrevois}
                    onChange={(e) => setCompteRenduMessage((prev) => ({ ...prev, jePrevois: e.target.value }))}
                    rows={2}
                    placeholder="Hypothèses ou prochaines actions."
                    className="w-full bg-slate-100 dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-2xl px-3 py-2.5 text-slate-800 dark:text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-600 dark:text-gray-300">Je fais</label>
                  <textarea
                    value={compteRenduMessage.jeFais}
                    onChange={(e) => setCompteRenduMessage((prev) => ({ ...prev, jeFais: e.target.value }))}
                    rows={2}
                    placeholder="Actions en cours ou réalisées."
                    className="w-full bg-slate-100 dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-2xl px-3 py-2.5 text-slate-800 dark:text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-600 dark:text-gray-300">Je demande</label>
                  <textarea
                    value={compteRenduMessage.jeDemande}
                    onChange={(e) => setCompteRenduMessage((prev) => ({ ...prev, jeDemande: e.target.value }))}
                    rows={2}
                    placeholder="Renforts, moyens, consignes."
                    className="w-full bg-slate-100 dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-2xl px-3 py-2.5 text-slate-800 dark:text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 text-sm"
                  />
                </div>
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

              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleValidateCompteRendu}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition border ${
                    validatedCompteRendu
                      ? 'bg-emerald-600/15 text-emerald-700 border-emerald-300 dark:text-emerald-300 dark:border-emerald-500/40'
                      : 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800 dark:bg-white/15 dark:text-white dark:border-white/30 dark:hover:bg-white/20'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  {validatedCompteRendu ? 'Message validé' : 'Valider le message'}
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

  // Load draft
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(INTERVENTION_DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.ordreData) setOrdreData(parsed.ordreData);
        if (parsed.selectedRisks) setSelectedRisks(parsed.selectedRisks);
        if (parsed.address) setAddress(parsed.address);
        if (parsed.city) setCity(parsed.city);
        if (Object.prototype.hasOwnProperty.call(parsed, 'additionalInfo')) {
          setAdditionalInfo(parsed.additionalInfo ?? '');
        }
        if (parsed.orderTime) setOrderTime(parsed.orderTime);
        if (parsed.selectedMeans) setSelectedMeans(normalizeMeans(parsed.selectedMeans));
        if (parsed.ambianceMessage) {
          const draftAmbiance = parsed.ambianceMessage as Partial<AmbianceMessage>;
          setAmbianceMessage({
            ...createAmbianceMessage(),
            ...draftAmbiance,
            demandes: normalizeDemandes(draftAmbiance.demandes),
            surLesLieux: normalizeSurLesLieux(draftAmbiance.surLesLieux)
          });
        }
        if (parsed.compteRenduMessage) {
          const draftCompteRendu = parsed.compteRenduMessage as Partial<CompteRenduMessage>;
          setCompteRenduMessage({
            ...createCompteRenduMessage(),
            ...draftCompteRendu,
            demandes: normalizeDemandes(draftCompteRendu.demandes),
            surLesLieux: normalizeSurLesLieux(draftCompteRendu.surLesLieux)
          });
        }
        if (parsed.validatedAmbiance) {
          const validated = parsed.validatedAmbiance as Partial<AmbianceMessage>;
          setValidatedAmbiance({
            ...createAmbianceMessage(),
            ...validated,
            demandes: normalizeDemandes(validated.demandes),
            surLesLieux: normalizeSurLesLieux(validated.surLesLieux)
          });
        }
        if (parsed.validatedCompteRendu) {
          const validated = parsed.validatedCompteRendu as Partial<CompteRenduMessage>;
          setValidatedCompteRendu({
            ...createCompteRenduMessage(),
            ...validated,
            demandes: normalizeDemandes(validated.demandes),
            surLesLieux: normalizeSurLesLieux(validated.surLesLieux)
          });
        }
        if (parsed.ordreValidatedAt) {
          setOrdreValidatedAt(parsed.ordreValidatedAt);
        }
        if (parsed.ordreConduite) {
          setOrdreConduite(parsed.ordreConduite);
        }
        if (typeof parsed.showConduite === 'boolean') {
          setShowConduite(parsed.showConduite);
        }
        if (parsed.conduiteValidatedAt) {
          setConduiteValidatedAt(parsed.conduiteValidatedAt);
        }
        if (parsed.conduiteSelectedRisks) {
          setConduiteSelectedRisks(parsed.conduiteSelectedRisks);
        }
        if (parsed.conduiteAddress) setConduiteAddress(parsed.conduiteAddress);
        if (parsed.conduiteCity) setConduiteCity(parsed.conduiteCity);
        if (parsed.conduiteAdditionalInfo) setConduiteAdditionalInfo(parsed.conduiteAdditionalInfo);
        if (parsed.conduiteOrderTime) setConduiteOrderTime(parsed.conduiteOrderTime);
      }
    } catch (err) {
      console.error('Erreur lecture brouillon', err);
    }
  }, [normalizeMeans]);

  // Persist draft
  React.useEffect(() => {
    const payload = {
      ordreData,
      selectedRisks,
      address,
      city,
      additionalInfo,
      orderTime,
      ordreConduite,
      showConduite,
      selectedMeans,
      ambianceMessage,
      compteRenduMessage,
      validatedAmbiance,
      validatedCompteRendu,
      ordreValidatedAt,
      conduiteValidatedAt,
      conduiteSelectedRisks,
      conduiteAddress,
      conduiteCity,
      conduiteAdditionalInfo,
      conduiteOrderTime
    };
    try {
      localStorage.setItem(INTERVENTION_DRAFT_KEY, JSON.stringify(payload));
    } catch (err) {
      console.error('Erreur sauvegarde brouillon', err);
    }
  }, [ordreData, selectedRisks, address, city, additionalInfo, orderTime, ordreConduite, showConduite, selectedMeans, ambianceMessage, compteRenduMessage, validatedAmbiance, validatedCompteRendu, ordreValidatedAt, conduiteValidatedAt, conduiteSelectedRisks, conduiteAddress, conduiteCity, conduiteAdditionalInfo, conduiteOrderTime]);

  React.useEffect(() => {
    const state = location.state as { meta?: { address?: string; city?: string; date?: string; time?: string; role?: string } } | null;
    if (state?.meta) {
      const { address: addr, city: c, date, time } = state.meta;
      if (addr) setAddress(addr);
      if (c) setCity(c);
      if (date || time) {
        const defaultDate = date || new Date().toISOString().slice(0, 10);
        const defaultTime = time || '00:00';
        setOrderTime(`${defaultDate}T${defaultTime}`);
      }
    }
  }, [location.state]);

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
    if (activeTab !== 'soiec') {
      setShowShareMenu(false);
    }
  }, [activeTab]);

  React.useEffect(() => {
    const query = fullAddress.trim();
    if (!query) return;
    const timeout = window.setTimeout(() => {
      setExternalSearch(query);
    }, 600);
    return () => window.clearTimeout(timeout);
  }, [fullAddress, setExternalSearch]);

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
  };

  const handleValidateOrdreInitial = () => {
    if (!ordreData) {
      alert('Veuillez remplir au moins une section avant de valider.');
      return;
    }
    if (ordreValidatedAt) return;
    setOrdreValidatedAt(
      new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    );
  };

  const handleValidateConduite = () => {
    if (!ordreConduite) {
      alert("Veuillez remplir l'ordre de conduite avant de le valider.");
      return;
    }
    if (conduiteValidatedAt) return;
    setConduiteValidatedAt(
      new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
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

      const messageAmbiance = validatedAmbiance ?? ambianceMessage;
      const messageCompteRendu = validatedCompteRendu ?? compteRenduMessage;
      const dominante = selectedRisks.length > 0 ? selectedRisks[0] : 'Incendie';

      if (type === 'communication') {
        const communicationData = {
          situation: `S: ${ordreData.S}\\nO: ${ordreData.O.join(', ')}\\nI: ${ordreData.I.map(i => i.mission).join(', ')}\\nE: ${ordreData.E}\\nC: ${ordreData.C}`,
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
        const dataToSave = {
          type: type as 'group' | 'column' | 'site',
          situation: ordreData.S || '',
          objectifs: ordreData.O.join('\\n') || '',
          idees: ordreData.I.map(i => i.mission).join('\\n') || '',
          execution: Array.isArray(ordreData.E)
            ? ordreData.E.map((entry) => {
                if (typeof entry === 'string') return entry;
                const record = (entry ?? {}) as Record<string, unknown>;
                const mission = typeof record.mission === 'string' ? record.mission : '';
                const moyen = typeof record.moyen === 'string' ? record.moyen : '';
                return mission || moyen ? `${mission}: ${moyen}`.trim() : JSON.stringify(entry);
              }).join('\\n')
            : ordreData.E || '',
          commandement: ordreData.C || '',
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
          addToHistory({
            type,
            situation: dataToSave.situation,
            analysis: `${dataToSave.objectifs}\\n${dataToSave.idees}\\n${dataToSave.execution}\\n${dataToSave.commandement}`
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
      console.error('Error saving to Firestore:', error);
      const message = error instanceof Error ? error.message : 'Une erreur est survenue lors de la sauvegarde. Veuillez réessayer.';
      alert(message);
    }
    setIsLoading(false);
  };

  const meta = { adresse: address, heure: orderTime, moyens: selectedMeans };

  const handleShareText = (channel: 'sms' | 'whatsapp' | 'mail') => {
    if (!ordreData) {
      setShowShareHint(true);
      return;
    }
    const ordre = ordreData;
    shareOrdreAsText(
      {
        S: ordre.S,
        O: ordre.O,
        I: ordre.I,
        E: ordre.E,
        C: ordre.C
      },
      channel,
      meta
    );
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

  const buildSharePayload = (): InterventionSharePayload => {
    const shareType = type === 'group' || type === 'column' || type === 'site' || type === 'communication' ? type : undefined;
    const draft = {
      ordreData,
      selectedRisks,
      address,
      city,
      additionalInfo,
      orderTime,
      ordreConduite,
      showConduite,
      selectedMeans,
      ambianceMessage,
      compteRenduMessage,
      validatedAmbiance,
      validatedCompteRendu,
      ordreValidatedAt,
      conduiteValidatedAt,
      conduiteSelectedRisks,
      conduiteAddress,
      conduiteCity,
      conduiteAdditionalInfo,
      conduiteOrderTime
    };
    const interventionState = useInterventionStore.getState();
    const sitacState = useSitacStore.getState();
    return {
      version: 1,
      shareType,
      draft,
      octTree: getOctTree(),
      sitacState: {
        geoJSON: sitacState.geoJSON,
        snapshots: sitacState.snapshots,
        drawingColor: sitacState.drawingColor,
        lineStyle: sitacState.lineStyle,
        locked: sitacState.locked
      },
      interventionMeta: {
        streetNumber: interventionState.streetNumber,
        streetName: interventionState.streetName,
        role: interventionState.role,
        lat: interventionState.lat,
        lng: interventionState.lng
      }
    };
  };

  const handleGenerateShare = async () => {
    setShareStatus('loading');
    setShareError(null);
    setShareCode(null);
    setShareQrDataUrl(null);
    setShareCopied(false);
    try {
      const payload = buildSharePayload();
      const sanitizedPayload = JSON.parse(JSON.stringify(payload)) as InterventionSharePayload;
      const shareId = await saveInterventionShare(sanitizedPayload);
      const qrValue = `${INTERVENTION_SHARE_PREFIX}${shareId}`;
      const dataUrl = await QRCode.toDataURL(qrValue, { margin: 1, width: 280 });
      setShareCode(shareId);
      setShareQrDataUrl(dataUrl);
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

  const handleCopyShareCode = async () => {
    if (!shareCode) return;
    try {
      await navigator.clipboard.writeText(shareCode);
      setShareCopied(true);
    } catch (error) {
      console.error('Erreur copie code partage', error);
      setShareError('Impossible de copier le code. Copiez-le manuellement.');
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
    setConduiteValidatedAt(null);
    setOrdreConduite(null);
    setShowConduite(false);
    setConduiteSelectedRisks([]);
    setConduiteAddress('');
    setConduiteCity('');
    setConduiteAdditionalInfo('');
    setConduiteOrderTime('');
    setConduiteTimeValidated(false);
    setOrderTime(new Date().toISOString().slice(0, 16));
    setShowShareHint(false);
    setShowShareMenu(false);
    try {
      localStorage.removeItem(INTERVENTION_DRAFT_KEY);
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
                      className={`px-3 py-2 rounded-xl text-sm font-semibold transition border ${isActive ? 'bg-slate-900/90 border-slate-300 text-white shadow-inner shadow-black/10 dark:bg-white/15 dark:border-white/40 dark:text-white dark:shadow-white/10' : 'bg-transparent border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-200 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/5'}`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={handleOpenShareModal}
                  className="px-3 py-2 rounded-xl text-sm font-semibold bg-white/70 hover:bg-white border border-slate-200 text-slate-700 dark:bg-white/10 dark:hover:bg-white/20 dark:border-white/15 dark:text-gray-200 transition flex items-center gap-2"
                >
                  <QrCode className="w-4 h-4" />
                  QR Code
                </button>
                <button
                  onClick={() => setResetDialogOpen(true)}
                  className="px-3 py-2 rounded-xl text-sm font-semibold bg-slate-200 hover:bg-slate-300 border border-slate-300 text-slate-700 dark:bg-white/10 dark:hover:bg-white/20 dark:border-white/15 dark:text-gray-200 transition"
                >
                  Réinitialiser
                </button>
              </div>
            </div>
            <div className="flex-1 p-3 md:p-5 overflow-visible md:overflow-y-auto md:overflow-x-hidden md:min-h-0">
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
                                const nowValue = new Date().toISOString().slice(0, 16);
                                setConduiteOrderTime((prev) => prev || nowValue);
                                setConduiteTimeValidated(true);
                              }}
                              className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition ${
                                conduiteTimeValidated
                                  ? 'bg-emerald-600/15 text-emerald-700 border-emerald-300 dark:text-emerald-300 dark:border-emerald-500/40'
                                  : 'bg-slate-200 text-slate-700 border-slate-300 hover:bg-slate-300 dark:bg-white/5 dark:text-gray-200 dark:border-white/10 dark:hover:bg-white/10'
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
                <h3 className="text-lg font-semibold">Partager par QR Code</h3>
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
                    className="w-full px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 border border-slate-300 text-sm text-slate-700 dark:bg-white/10 dark:hover:bg-white/15 dark:border-white/15 dark:text-gray-100 transition"
                  >
                    Réessayer
                  </button>
                </div>
              )}
              {shareStatus === 'ready' && (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-52 h-52 rounded-2xl bg-slate-100 dark:bg-white/10 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-white/10">
                    {shareQrDataUrl ? (
                      <img src={shareQrDataUrl} alt="QR Code de partage" className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-xs text-slate-500 dark:text-gray-400">QR code indisponible</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-gray-400">
                    Code : <span className="font-mono text-slate-900 dark:text-white">{shareCode}</span>
                  </div>
                  <button
                    onClick={handleCopyShareCode}
                    className="px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 border border-slate-300 text-sm text-slate-700 dark:bg-white/10 dark:hover:bg-white/15 dark:border-white/15 dark:text-gray-100 transition flex items-center gap-2"
                  >
                    <ClipboardCopy className="w-4 h-4" />
                    Copier le code
                  </button>
                  {shareCopied && <div className="text-xs text-emerald-600 dark:text-emerald-300">Code copié.</div>}
                  {shareError && <div className="text-xs text-red-500 dark:text-red-300">{shareError}</div>}
                </div>
              )}
            </div>
            <div className="px-4 py-3 border-t border-slate-200 dark:border-white/10 flex justify-end gap-2">
              <button
                onClick={() => setShareModalOpen(false)}
                className="px-3 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-sm text-slate-700 dark:bg-white/5 dark:hover:bg-white/10 dark:text-gray-200 transition"
              >
                Fermer
              </button>
              <button
                onClick={handleGenerateShare}
                disabled={shareStatus === 'loading'}
                className="px-3 py-2 rounded-lg bg-slate-900 text-sm text-white hover:bg-slate-800 disabled:opacity-60 transition"
              >
                Regénérer
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
                className="w-full px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 border border-slate-300 text-sm text-slate-700 dark:bg-white/10 dark:hover:bg-white/15 dark:border-white/15 dark:text-gray-100 transition"
              >
                Réinitialiser l&apos;onglet en cours
              </button>
              <button
                onClick={handleResetAll}
                className="w-full px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-sm text-white transition"
              >
                Réinitialiser toute l&apos;intervention
              </button>
            </div>
            <div className="px-4 py-3 border-t border-slate-200 dark:border-white/10 flex justify-end">
              <button
                onClick={() => setResetDialogOpen(false)}
                className="px-3 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-sm text-slate-700 dark:bg-white/5 dark:hover:bg-white/10 dark:text-gray-200 transition"
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
