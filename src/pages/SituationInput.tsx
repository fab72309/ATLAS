import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Mic, Sparkles } from 'lucide-react';
import { SpeechRecognitionService } from '../utils/speechRecognition';
import { saveCommunicationIAData } from '../utils/firestore';
import CommandIcon from '../components/CommandIcon';
import { analyzeEmergency } from '../utils/openai';

const SituationInput = () => {
  const [situation, setSituation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recognitionService] = useState(() => new SpeechRecognitionService());
  const navigate = useNavigate();
  const { type } = useParams();

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
    setIsLoading(true);
    
    try {
      const analysis = await analyzeEmergency(situation, type as 'group' | 'column' | 'communication');
      
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
          ...sections
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
      alert(error.message || 'Une erreur est survenue lors de l\'analyse. Veuillez réessayer.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="p-3">
        <button 
          onClick={() => navigate('/')}
          className="bg-[#FF1801] hover:bg-[#D91601] transition-colors text-white px-4 py-2 rounded"
        >
          Accueil
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center px-4 pt-2">
        <div className="flex flex-col items-center">
          <h1 className="text-xl md:text-2xl font-bold text-white mb-0.5">
            A.T.L.A.S
          </h1>
          <p className="text-white text-center text-sm mb-4">
          Aide Tactique et Logique pour l'Action des Secours
          </p>
        </div>

        <div className="w-full max-w-[200px] mb-4">
          <CommandIcon type={type as 'group' | 'column'} />
        </div>

        <form onSubmit={handleSubmit} className="w-full max-w-4xl flex flex-col flex-1">
          <div className="relative flex-1 mb-4">
            <div className="absolute inset-0 bg-white rounded-3xl h-[calc(100vh-18rem)]"></div>
            {error && (
              <div className="absolute top-4 right-4 left-4 bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded-lg z-10 text-sm">
                {error}
              </div>
            )}
            <textarea
              value={situation}
              onChange={(e) => setSituation(e.target.value)}
              className="relative w-full h-[calc(100vh-18rem)] resize-none rounded-3xl p-3 text-gray-800 text-sm focus:outline-none bg-white"
              placeholder={type === 'communication' ? 
                "Décrivez la situation actuelle, l'engagement des secours, les moyens mis en œuvre..." :
                "Décrivez la situation..."}
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={isListening ? stopSpeechRecognition : startSpeechRecognition}
              disabled={isLoading}
              className={`absolute bottom-4 right-4 ${
                isListening ? 'bg-[#FF1801]' : 'bg-[#1A1A1A]'
              } hover:bg-[#D91601] transition-colors rounded-full p-3`}
              title={isListening ? 'Arrêter la dictée' : 'Démarrer la dictée'}
            >
              <Mic className="w-5 h-5 text-white" />
            </button>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="bg-[#FF1801] hover:bg-[#D91601] transition-colors text-white py-2 rounded-3xl text-sm font-semibold w-full disabled:bg-gray-500 mb-3 flex items-center justify-center gap-2"
          >
            {isLoading ? 'Analyse en cours...' : (
              <>
                Générer avec l'IA<Sparkles className="w-5 h-5 text-white" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default SituationInput;