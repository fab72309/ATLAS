import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { saveDictationData, saveCommunicationData } from '../utils/firestore';
import CommandIcon from '../components/CommandIcon';
import DominantSelector, { DominanteType } from '../components/DominantSelector';
import OrdreInitialView from '../components/OrdreInitialView';
import { OrdreInitial } from '../types/soiec';
import { addToHistory } from '../utils/history';
import { ClipboardCopy, Share2, FileText } from 'lucide-react';
import { exportOrdreToClipboard, exportOrdreToPdf, exportOrdreToWord, shareOrdreAsFile, shareOrdreAsText } from '../utils/export';
import MeansModal from '../components/MeansModal';

const DictationInput = () => {
  const { type } = useParams();
  const [ordreData, setOrdreData] = useState<OrdreInitial | null>(null);
  const [selectedRisks, setSelectedRisks] = useState<DominanteType[]>([]);
  const [address, setAddress] = useState('');
  const [orderTime, setOrderTime] = useState<string>(() => new Date().toISOString().slice(0, 16));
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const DRAFT_KEY = 'atlas-ordre-initial-draft';
  const [showShareHint, setShowShareHint] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showMeans, setShowMeans] = useState(false);
  const [selectedMeans, setSelectedMeans] = useState<{ name: string; status: 'sur_place' | 'demande'; category?: string }[]>([]);

  // Load draft
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.ordreData) setOrdreData(parsed.ordreData);
        if (parsed.selectedRisks) setSelectedRisks(parsed.selectedRisks);
        if (parsed.address) setAddress(parsed.address);
        if (parsed.orderTime) setOrderTime(parsed.orderTime);
        if (parsed.selectedMeans) setSelectedMeans(parsed.selectedMeans);
      }
    } catch { }
  }, []);

  // Persist draft
  React.useEffect(() => {
    const payload = { ordreData, selectedRisks, address, orderTime, selectedMeans };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    } catch { }
  }, [ordreData, selectedRisks, address, orderTime, selectedMeans]);

  const handleSubmit = async () => {
    setIsLoading(true);
    try { await Haptics.impact({ style: ImpactStyle.Light }); } catch { }

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
      await exportOrdreToPdf(ordre, meta);
    } else {
      await exportOrdreToWord(ordre, meta);
    }
  };

  const handleCopyDraft = async () => {
    if (!ordreData) {
      setShowShareHint(true);
      return;
    }
    await exportOrdreToClipboard(ordreData, meta);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-[#0A0A0A] text-white">
      <MeansModal
        isOpen={showMeans}
        onClose={() => setShowMeans(false)}
        selected={selectedMeans}
        onChange={setSelectedMeans}
      />
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

        <div className="w-full mb-6 animate-fade-in-down" style={{ animationDelay: '0.2s' }}>
          <label className="text-sm font-medium text-gray-400 ml-2 mb-2 block">
            Sélection des Risques (1er = Dominante, suivants = Secondaires)
          </label>
          <DominantSelector selectedRisks={selectedRisks} onChange={setSelectedRisks} />
        </div>

        <div className="w-full grid grid-cols-1 md:grid-cols-[1.05fr,0.95fr,auto] gap-3 mb-2 animate-fade-in-down items-end" style={{ animationDelay: '0.22s' }}>
          <div className="space-y-1 max-w-full">
            <label className="text-sm font-medium text-gray-400 ml-2">Adresse de l'intervention</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Ex: 12 rue de la Paix, Paris"
              className="w-full bg-[#151515] border border-white/10 rounded-2xl px-3 py-2.5 text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 text-sm min-w-0"
            />
          </div>
          <div className="space-y-1 max-w-full md:mt-0 flex flex-col items-start">
            <label className="text-sm font-medium text-gray-400 ml-2 text-left w-full">Heure de saisie</label>
            <input
              type="datetime-local"
              value={orderTime}
              onChange={(e) => setOrderTime(e.target.value)}
              className="w-full bg-[#151515] border border-white/10 rounded-2xl px-3 py-2.5 text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 text-sm min-w-0 md:max-w-[280px]"
            />
          </div>
          <div className="flex justify-end md:justify-start items-end pb-0 md:pb-[6px]">
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
                  <div className="text-xs text-gray-400 pt-1">Fichiers</div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => handleShareFile('pdf')} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-gray-200">PDF</button>
                    <button onClick={() => handleShareFile('word')} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-gray-200 flex items-center gap-1"><FileText className="w-4 h-4" />Word</button>
                  </div>
                  {showShareHint && <div className="text-[11px] text-red-400">Ajoutez au moins un élément avant de partager.</div>}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="w-full mb-4 text-xs text-gray-500 animate-fade-in-down" style={{ animationDelay: '0.24s' }}>
          Brouillon sauvegardé automatiquement sur cet appareil (adresse, heure, contenu).
        </div>
        <div className="w-full flex justify-end mb-3 animate-fade-in-down" style={{ animationDelay: '0.25s' }}>
          <button
            onClick={() => setShowMeans(true)}
            className="px-4 py-2 bg-red-600/80 hover:bg-red-600 text-white rounded-xl text-sm font-semibold shadow-lg"
          >
            Ajouter des moyens sur l'intervention
          </button>
        </div>

        <div className="w-full flex-1 flex flex-col relative animate-fade-in-down" style={{ animationDelay: '0.3s' }}>
          <OrdreInitialView
            ordre={ordreData}
            onChange={setOrdreData}
            hideToolbar={true}
            dominante={selectedRisks[0]}
            means={selectedMeans}
          />

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

          {showShareHint && (
            <div className="text-xs text-red-400 mt-2 text-right">Ajoutez au moins un élément avant de partager.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DictationInput;
