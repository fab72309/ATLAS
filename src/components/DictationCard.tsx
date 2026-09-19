import React, { useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { SpeechRecognitionService } from '../utils/speechRecognition';

interface DictationCardProps {
  title: string;
  value: string;
  onChange: (text: string) => void;
  placeholder: string;
  isActive: boolean;
}

const DictationCard: React.FC<DictationCardProps> = ({
  title,
  value,
  onChange,
  placeholder,
  isActive,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [recognitionService] = useState(() => new SpeechRecognitionService());
  const [error, setError] = useState<string | null>(null);

  const startSpeechRecognition = () => {
    if (!recognitionService.isRecognitionSupported()) {
      setError('La reconnaissance vocale n\'est pas supportée par votre navigateur.');
      return;
    }

    setError(null);
    recognitionService.start({
      onStart: () => setIsListening(true),
      onResult: (text) => onChange(text),
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

  return (
    <div className="bg-white min-h-[50vh] md:h-[calc(100vh-22rem)] rounded-3xl p-4 flex flex-col mx-auto w-full max-w-4xl relative">
      <h2 className="text-lg font-bold text-gray-800 mb-2">{title}</h2>
      {error && (
        <div className="absolute top-4 right-4 left-4 bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded-lg">
          {error}
        </div>
      )}
      <div className="relative flex-1">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full min-h-[40vh] md:h-full resize-none rounded-2xl p-2 pr-14 text-gray-800 text-sm focus:outline-none border-2 ${
            isActive ? 'border-gray-300' : 'border-gray-200'
          } overflow-y-auto`}
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={isListening ? stopSpeechRecognition : startSpeechRecognition}
          aria-pressed={isListening}
          aria-label={isListening ? 'Arrêter la dictée' : 'Démarrer la dictée'}
          className={`absolute bottom-2 right-2 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all focus:outline-none focus:ring-2 focus:ring-blue-400/60 ${
            isListening
              ? 'animate-pulse border-red-100 bg-red-600 text-white shadow-[0_0_0_4px_rgba(239,68,68,0.2),0_8px_18px_rgba(127,29,29,0.35)]'
              : 'border-white/40 bg-[#101522] text-white shadow-[0_8px_16px_rgba(15,23,42,0.22)] hover:border-white/60 hover:bg-[#1b2435]'
          }`}
          title={isListening ? 'Arrêter la dictée' : 'Démarrer la dictée'}
        >
          {isListening ? <MicOff className="h-5 w-5" strokeWidth={3} /> : <Mic className="h-5 w-5" strokeWidth={3} />}
        </button>
      </div>
    </div>
  );
};

export default DictationCard;
