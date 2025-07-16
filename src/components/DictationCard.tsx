import React, { useState } from 'react';
import { Mic } from 'lucide-react';
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
    <div className="bg-white h-[calc(100vh-22rem)] rounded-3xl p-4 flex flex-col mx-auto w-full max-w-4xl relative">
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
          className={`w-full h-full resize-none rounded-2xl p-2 pr-14 text-gray-800 text-sm focus:outline-none border-2 ${
            isActive ? 'border-gray-300' : 'border-gray-200'
          } overflow-y-auto`}
          placeholder={placeholder}
        />
        <button
          onClick={isListening ? stopSpeechRecognition : startSpeechRecognition}
          className={`absolute bottom-3 right-3 ${
            isListening ? 'bg-[#FF1801]' : 'bg-[#1A1A1A]'
          } hover:bg-[#2A2A2A] transition-colors rounded-full p-3 z-10`}
          title={isListening ? 'Arrêter la dictée' : 'Démarrer la dictée'}
        >
          <Mic className="w-5 h-5 text-white" />
        </button>
      </div>
    </div>
  );
};

export default DictationCard;