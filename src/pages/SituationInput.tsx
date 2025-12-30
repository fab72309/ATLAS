import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Mic, Sparkles } from 'lucide-react';
import { SpeechRecognitionService } from '../utils/speechRecognition';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { saveCommunicationIAData } from '../utils/dataStore';
import CommandIcon from '../components/CommandIcon';
import { analyzeEmergency } from '../utils/openai';
import DominantSelector, { DominanteType } from '../components/DominantSelector';
import { addToHistory } from '../utils/history';

const SituationInput = () => {
  const [situation, setSituation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recognitionService] = useState(() => new SpeechRecognitionService());
  const navigate = useNavigate();
  const { type } = useParams();

  // Variables d'état pour les données tactiques
  const [selectedRisks, setSelectedRisks] = useState<DominanteType[]>([]);
  const [extraContext, setExtraContext] = useState('');

  const startSpeechRecognition = () => {
    if (!recognitionService.isRecognitionSupported()) {
      setError('La reconnaissance vocale n\'est pas supportée par votre navigateur.');
      return;
    }

    setError(null);
    recognitionService.start({
      onStart: () => setIsListening(true),
      onResult: (text) => setSituation(text),
      onError: (error) => {
        setError(error.message);
        setIsListening(false);
      },
      onEnd: () => {
        setIsListening(false);
      }
    });
  };

  const stopSpeechRecognition = () => {
    if (isListening) {
      recognitionService.stop();
      setIsListening(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!situation.trim()) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch (err) {
      void err;
    }
    setIsLoading(true);

    try {
      // La première sélection est la dominante, les suivantes sont les risques secondaires
      const dominante = selectedRisks.length > 0 ? selectedRisks[0] : 'Incendie'; // Fallback par défaut si vide
      const secondaryRisks = selectedRisks.slice(1);

      const analysis = await analyzeEmergency(situation, type as 'group' | 'column' | 'site' | 'communication', {
        dominante,
        secondaryRisks,
        extraContext
      });

      if (type === 'communication') {
        // Extraire les sections du texte d'analyse
        const sections = {
          Engagement_secours: '',
          Situation_appel: '',
          Situation_arrivee: '',
          Nombre_victimes: '',
          Moyens: '',
          Actions_secours: '',
          Conseils_population: ''
        };

        // Sauvegarder dans Communication_OPS_IA
        await saveCommunicationIAData({
          input: situation,
          groupe_horaire: new Date(),
          dominante,
          ...sections
        });
      }

      // Historiser uniquement les types supportés
      if (type === 'group' || type === 'column' || type === 'site' || type === 'communication') {
        addToHistory({
          type,
          situation,
          analysis: typeof analysis === 'string' ? analysis : JSON.stringify(analysis)
        });
      }

      navigate('/results', {
        state: {
          analysis,
          type,
          fromAI: true
        }
      });
    } catch (error) {
      console.error('Error:', error);
      const message = error instanceof Error ? error.message : 'Une erreur est survenue lors de l\'analyse. Veuillez réessayer.';
      alert(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#0A0A0A] dark:text-white">
      {/* Background Ambient Glow */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-200/70 dark:bg-blue-900/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-200/60 dark:bg-purple-900/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-4xl mx-auto px-4 py-6 flex flex-col items-center h-full">
        <div className="flex flex-col items-center mb-6 animate-fade-in-down">
          <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-500 dark:from-white dark:to-gray-400 mb-1">
            A.T.L.A.S
          </h1>
          <p className="text-slate-600 dark:text-gray-400 text-center text-xs md:text-sm font-light tracking-wide">
            Aide Tactique et Logique pour l'Action des Secours
          </p>
        </div>

        <div className="w-full max-w-[120px] mb-6 animate-fade-in-down" style={{ animationDelay: '0.1s' }}>
          <CommandIcon type={type as 'group' | 'column' | 'site' | 'communication'} />
        </div>

        <form onSubmit={handleSubmit} className="w-full max-w-4xl flex flex-col flex-1 animate-fade-in-down space-y-6" style={{ animationDelay: '0.2s' }}>

          {/* Sélection des Risques (Unifié) */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-600 dark:text-gray-400 ml-2">
              Sélection des Risques (1er = Dominante, suivants = Secondaires)
            </label>
            <DominantSelector selectedRisks={selectedRisks} onChange={setSelectedRisks} />
          </div>

          {/* Situation */}
          <div className="flex-1 relative">
            <label className="text-sm font-medium text-slate-600 dark:text-gray-400 ml-2 mb-2 block">Description de la situation</label>
            {error && (
              <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm backdrop-blur-md">
                {error}
              </div>
            )}
            <div className="relative bg-white/90 dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-3xl p-2 shadow-xl focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/50 transition-all duration-300">
              <textarea
                value={situation}
                onChange={(e) => setSituation(e.target.value)}
                className="w-full min-h-[200px] resize-none rounded-2xl p-4 pr-14 text-slate-800 dark:text-gray-200 text-base focus:outline-none bg-transparent placeholder-slate-400 dark:placeholder-gray-600"
                placeholder={type === 'communication' ?
                  "Décrivez la situation actuelle, l'engagement des secours, les moyens mis en œuvre..." :
                  "Décrivez la situation..."}
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={isListening ? stopSpeechRecognition : startSpeechRecognition}
                disabled={isLoading}
                className={`absolute bottom-4 right-4 p-3 rounded-xl transition-all duration-300 ${isListening
                  ? 'bg-red-500 text-white shadow-[0_0_8px_rgba(59,130,246,0.55),0_0_18px_rgba(239,68,68,0.55)] animate-pulse'
                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300 hover:text-slate-900 dark:bg-white/10 dark:text-gray-400 dark:hover:bg-white/20 dark:hover:text-white'
                  }`}
                title={isListening ? 'Arrêter la dictée' : 'Démarrer la dictée'}
              >
                <Mic className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Contexte Complémentaire */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-600 dark:text-gray-400 ml-2">Contexte Complémentaire (Optionnel)</label>
            <div className="bg-white/90 dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-3xl p-2 shadow-xl focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/50 transition-all duration-300">
              <textarea
                value={extraContext}
                onChange={(e) => setExtraContext(e.target.value)}
                className="w-full min-h-[100px] resize-none rounded-2xl p-4 text-slate-800 dark:text-gray-200 text-base focus:outline-none bg-transparent placeholder-slate-400 dark:placeholder-gray-600"
                placeholder="Météo, moyens déjà engagés, contraintes particulières..."
                disabled={isLoading}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="group w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:from-gray-700 disabled:to-gray-800 transition-all duration-300 text-white py-4 rounded-2xl text-lg font-bold shadow-lg shadow-red-500/25 hover:shadow-red-500/40 hover:-translate-y-0.5 flex items-center justify-center gap-3 mb-[calc(env(safe-area-inset-bottom,0)+12px)]"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Analyse en cours...
              </>
            ) : (
              <>
                Générer avec l'IA
                <Sparkles className="w-5 h-5 text-blue-200 group-hover:text-white animate-pulse" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default SituationInput;
