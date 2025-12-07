import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { saveDictationData, saveCommunicationData } from '../utils/firestore';
import CommandIcon from '../components/CommandIcon';
import DominantSelector, { DominanteType } from '../components/DominantSelector';
import OrdreInitialView from '../components/OrdreInitialView';
import { OrdreInitial } from '../types/soiec';

const DictationInput = () => {
  const { type } = useParams();
  const [ordreData, setOrdreData] = useState<OrdreInitial | null>(null);
  const [selectedRisks, setSelectedRisks] = useState<DominanteType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

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
        };
        await saveDictationData(dataToSave);

        navigate('/results', {
          state: {
            ordre: ordreData,
            type,
            fromDictation: true,
            isGroup: type === 'group'
          }
        });
      }
    } catch (error: any) {
      console.error('Error saving to Firestore:', error);
      alert(error.message || 'Une erreur est survenue lors de la sauvegarde. Veuillez réessayer.');
    }
    setIsLoading(false);
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

        <div className="w-full mb-6 animate-fade-in-down" style={{ animationDelay: '0.2s' }}>
          <label className="text-sm font-medium text-gray-400 ml-2 mb-2 block">
            Sélection des Risques (1er = Dominante, suivants = Secondaires)
          </label>
          <DominantSelector selectedRisks={selectedRisks} onChange={setSelectedRisks} />
        </div>

        <div className="w-full flex-1 flex flex-col relative animate-fade-in-down" style={{ animationDelay: '0.3s' }}>
          <OrdreInitialView 
            ordre={ordreData} 
            onChange={setOrdreData}
            hideToolbar={true}
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
        </div>
      </div>
    </div>
  );
};

export default DictationInput;
