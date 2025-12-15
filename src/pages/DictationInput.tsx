import React, { useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { saveDictationData, saveCommunicationData } from '../utils/firestore';
import CommandIcon from '../components/CommandIcon';
import DominantSelector, { DominanteType } from '../components/DominantSelector';
import OrdreInitialView from '../components/OrdreInitialView';
import { OrdreInitial } from '../types/soiec';
import { addToHistory } from '../utils/history';
import { ClipboardCopy, Share2, FileText, ImageDown } from 'lucide-react';
import { exportBoardDesignImage, exportBoardDesignPdf, exportBoardDesignWordEditable, exportOrdreToClipboard, exportOrdreToImage, exportOrdreToPdf, shareOrdreAsText } from '../utils/export';
import MeansModal, { MeanItem } from '../components/MeansModal';
import SitacMap from './SitacMap';
import { OctDiagram } from './OctDiagram';
import { resetOctTree } from '../utils/octTreeStore';

const generateMeanId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `mean-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const DictationInput = () => {
  const { type } = useParams();
  const [ordreData, setOrdreData] = useState<OrdreInitial | null>(null);
  const [selectedRisks, setSelectedRisks] = useState<DominanteType[]>([]);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [orderTime, setOrderTime] = useState<string>(() => new Date().toISOString().slice(0, 16));
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const DRAFT_KEY = 'atlas-ordre-initial-draft';
  const [showShareHint, setShowShareHint] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [selectedMeans, setSelectedMeans] = useState<MeanItem[]>([]);
  const [activeTab, setActiveTab] = useState<'soiec' | 'moyens' | 'oct' | 'message' | 'sitac' | 'aide'>('soiec');
  const boardRef = React.useRef<HTMLDivElement>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [octResetKey, setOctResetKey] = useState(0);
  const [meansResetKey, setMeansResetKey] = useState(0);
  const [sitacResetKey, setSitacResetKey] = useState(0);

  const normalizeMeans = React.useCallback((items: any[] | undefined): MeanItem[] => {
    if (!Array.isArray(items)) return [];
    return items.map((m) => ({
      id: m?.id || generateMeanId(),
      name: m?.name || 'Moyen',
      status: m?.status === 'demande' ? 'demande' : 'sur_place',
      category: m?.category
    }));
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
            <label className="text-sm font-medium text-gray-400 ml-2 mb-1 block">
              Séléction du domaine de l'intervention (1er = principal, suivants = secondaires)
            </label>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <DominantSelector selectedRisks={selectedRisks} onChange={setSelectedRisks} className="justify-start flex-1" />
              <div className="relative">
                <button
                  onClick={() => setShowShareMenu((v) => !v)}
                  className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-gray-200"
                >
                  <Share2 className="w-4 h-4" />
                  Partage & export
                </button>
                {showShareMenu && (
                  <div className="absolute right-0 mt-2 w-64 bg-[#0F121A] border border-white/10 rounded-xl shadow-2xl p-3 space-y-2 z-30">
                    <div className="text-xs text-gray-400">Texte</div>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => handleShareText('sms')} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-gray-200">SMS</button>
                      <button onClick={() => handleShareText('whatsapp')} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-gray-200">WhatsApp</button>
                      <button onClick={() => handleShareText('mail')} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-gray-200">Mail</button>
                      <button onClick={handleCopyDraft} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-gray-200 flex items-center gap-1"><ClipboardCopy className="w-4 h-4" />Copier</button>
                  </div>
                  <div className="text-xs text-gray-400 pt-1">Téléchargements</div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={handleDownloadImage} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-gray-200 flex items-center gap-1"><ImageDown className="w-4 h-4" />Image</button>
                    <button onClick={() => handleShareFile('pdf')} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-gray-200">PDF</button>
                    <button onClick={() => handleShareFile('word')} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-gray-200 flex items-center gap-1"><FileText className="w-4 h-4" />Word</button>
                  </div>
                  {showShareHint && <div className="text-[11px] text-red-400">Ajoutez au moins un élément avant de partager.</div>}
                </div>
              )}
            </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-400 ml-2">Adresse de l'intervention</label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ex: 12 rue de la Paix"
                className="w-full bg-[#151515] border border-white/10 rounded-2xl px-3 py-2.5 text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 text-sm"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[1fr,0.6fr] gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-400 ml-2">Ville</label>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Ville de l'intervention"
                  className="w-full bg-[#151515] border border-white/10 rounded-2xl px-3 py-2.5 text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-400 ml-2">Heure de saisie</label>
                <input
                  type="datetime-local"
                  value={orderTime}
                  onChange={(e) => setOrderTime(e.target.value)}
                  className="w-full bg-[#151515] border border-white/10 rounded-2xl px-3 py-2.5 text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="w-full text-xs text-gray-500">
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
          <OctDiagram key={`oct-${octResetKey}`} embedded availableMeans={selectedMeans} />
        </div>
      );
    }

    if (activeTab === 'sitac') {
      return (
        <div className="min-h-[320px]">
          <SitacMap key={`sitac-${sitacResetKey}`} embedded />
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center h-full min-h-[280px]">
        <div className="text-center space-y-1">
          <div className="text-lg font-semibold text-white">En construction</div>
          <div className="text-sm text-gray-400">Cette section sera bientôt disponible.</div>
        </div>
      </div>
    );
  };

  // Load draft
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.ordreData) setOrdreData(parsed.ordreData);
        if (parsed.selectedRisks) setSelectedRisks(parsed.selectedRisks);
        if (parsed.address) setAddress(parsed.address);
        if (parsed.city) setCity(parsed.city);
        if (parsed.orderTime) setOrderTime(parsed.orderTime);
        if (parsed.selectedMeans) setSelectedMeans(normalizeMeans(parsed.selectedMeans));
      }
    } catch (err) {
      console.error('Erreur lecture brouillon', err);
    }
  }, [normalizeMeans]);

  // Persist draft
  React.useEffect(() => {
    const payload = { ordreData, selectedRisks, address, city, orderTime, selectedMeans };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    } catch (err) {
      console.error('Erreur sauvegarde brouillon', err);
    }
  }, [ordreData, selectedRisks, address, city, orderTime, selectedMeans]);

  React.useEffect(() => {
    const state = location.state as { meta?: { address?: string; city?: string; date?: string; time?: string } } | null;
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
    if (activeTab !== 'soiec') {
      setShowShareMenu(false);
    }
  }, [activeTab]);

  const handleSubmit = async () => {
    setIsLoading(true);
    try { await Haptics.impact({ style: ImpactStyle.Light }); } catch (err) {
      console.error('Haptics error', err);
    }

    try {
      if (!ordreData) {
        throw new Error('Veuillez remplir au moins une section avant de générer.');
      }

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
          dominante
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
            ? ordreData.E.map((e: any) => `${e.mission}: ${e.moyen}`).join('\\n')
            : ordreData.E || '',
          commandement: ordreData.C || '',
          groupe_horaire: new Date(),
          dominante,
          adresse: address,
          heure_ordre: orderTime,
          moyens: selectedMeans
        };
        await saveDictationData(dataToSave);

        if (type === 'group' || type === 'column' || type === 'site') {
          addToHistory({
            type: type as any,
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
    } catch (error: any) {
      console.error('Error saving to Firestore:', error);
      alert(error.message || 'Une erreur est survenue lors de la sauvegarde. Veuillez réessayer.');
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

  const resetSoiecState = () => {
    setOrdreData(null);
    setSelectedRisks([]);
    setAddress('');
    setCity('');
    setOrderTime(new Date().toISOString().slice(0, 16));
    setShowShareHint(false);
    setShowShareMenu(false);
    try {
      localStorage.removeItem(DRAFT_KEY);
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

  const handleResetTab = () => {
    const label = tabs.find((t) => t.id === activeTab)?.label || 'onglet';
    if (!window.confirm(`Réinitialiser l'onglet ${label} ?`)) return;
    if (activeTab === 'soiec') resetSoiecState();
    if (activeTab === 'moyens') resetMeansState();
    if (activeTab === 'oct') resetOctState();
    if (activeTab === 'sitac') resetSitacState();
    setResetDialogOpen(false);
  };

  const handleResetAll = () => {
    if (!window.confirm('Réinitialiser toute l’intervention ?')) return;
    resetSoiecState();
    resetMeansState();
    resetOctState();
    resetSitacState();
    setResetDialogOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-[#0A0A0A] text-white">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-900/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-green-900/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-[98%] mx-auto px-4 py-6 flex flex-col items-center h-full">
        <div className="flex flex-col items-center mb-6 animate-fade-in-down">
          <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 mb-1">
            A.T.L.A.S
          </h1>
          <p className="text-gray-400 text-center text-xs md:text-sm font-light tracking-wide">
            Aide Tactique et Logique pour l'Action des Secours
          </p>
        </div>

        <div className="w-full max-w-[120px] mb-6 animate-fade-in-down" style={{ animationDelay: '0.1s' }}>
          <CommandIcon type={type as 'group' | 'column' | 'site' | 'communication'} />
        </div>

        <div className="w-full flex-1 flex flex-col relative animate-fade-in-down" style={{ animationDelay: '0.3s' }}>
          <div className="w-full flex-1 flex flex-col bg-white/5 border border-white/10 rounded-2xl overflow-visible shadow-lg shadow-black/30 backdrop-blur-sm">
            <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-white/10 bg-white/5">
              <div className="flex flex-wrap gap-2">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-3 py-2 rounded-xl text-sm font-semibold transition border ${isActive ? 'bg-white/15 border-white/40 text-white shadow-inner shadow-white/10' : 'bg-transparent border-transparent text-gray-400 hover:text-white hover:bg-white/5'}`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setResetDialogOpen(true)}
                className="ml-auto px-3 py-2 rounded-xl text-sm font-semibold bg-white/10 hover:bg-white/20 border border-white/15 text-gray-200 transition"
              >
                Réinitialiser
              </button>
            </div>
            <div className="flex-1 p-3 md:p-5 overflow-visible">
              {renderTabContent()}
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="group w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:from-gray-700 disabled:to-gray-800 transition-all duration-300 text-white py-4 rounded-2xl text-lg font-bold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:-translate-y-0.5 mt-6 mb-[calc(env(safe-area-inset-bottom,0)+12px)] flex items-center justify-center gap-3"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Sauvegarde en cours...
              </>
            ) : (
              <>
                Générer
                <Sparkles className="w-5 h-5 text-blue-200 group-hover:text-white animate-pulse" />
              </>
            )}
          </button>

          {showShareHint && activeTab === 'soiec' && (
            <div className="text-xs text-red-400 mt-2 text-right">Ajoutez au moins un élément avant de partager.</div>
          )}
        </div>
      </div>

      {resetDialogOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0f121a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Réinitialiser</h3>
              <button onClick={() => setResetDialogOpen(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-gray-300">
                Choisissez de réinitialiser uniquement l&apos;onglet courant ou toute l&apos;intervention. Une confirmation est demandée à chaque action.
              </p>
              <button
                onClick={handleResetTab}
                className="w-full px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-sm text-gray-100 transition"
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
            <div className="px-4 py-3 border-t border-white/10 flex justify-end">
              <button
                onClick={() => setResetDialogOpen(false)}
                className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-gray-200 transition"
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
