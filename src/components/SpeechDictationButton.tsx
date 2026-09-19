import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { SpeechRecognitionService } from '../utils/speechRecognition';

type SpeechDictationButtonProps = {
  value: string;
  onChange: (value: string) => void;
  label: string;
  disabled?: boolean;
};

const appendTranscript = (baseValue: string, transcript: string) => {
  const base = baseValue.trimEnd();
  const text = transcript.trim();
  if (!text) return base;
  return base ? `${base} ${text}` : text;
};

const SpeechDictationButton: React.FC<SpeechDictationButtonProps> = ({
  value,
  onChange,
  label,
  disabled = false
}) => {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const serviceRef = useRef<SpeechRecognitionService | null>(null);
  const baseValueRef = useRef('');

  const getService = () => {
    if (!serviceRef.current) {
      serviceRef.current = new SpeechRecognitionService();
    }
    return serviceRef.current;
  };

  useEffect(() => () => {
    serviceRef.current?.stop();
  }, []);

  const stopDictation = () => {
    getService().stop();
    setIsListening(false);
  };

  const startDictation = () => {
    const service = getService();
    setError(null);

    if (!service.isRecognitionSupported()) {
      setError('La reconnaissance vocale n\'est pas supportée par votre navigateur.');
      return;
    }

    baseValueRef.current = value;
    service.start({
      onStart: () => setIsListening(true),
      onEnd: () => setIsListening(false),
      onError: (recognitionError) => {
        setIsListening(false);
        setError(recognitionError.message || 'Erreur de dictée');
      },
      onResult: (text) => onChange(appendTranscript(baseValueRef.current, text))
    });
  };

  const handleToggle = () => {
    if (disabled) return;
    if (isListening) {
      stopDictation();
      return;
    }
    startDictation();
  };

  return (
    <>
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        aria-pressed={isListening}
        aria-label={isListening ? `Arrêter la dictée de ${label}` : `Dicter ${label}`}
        title={isListening ? 'Arrêter la dictée' : `Dicter ${label}`}
        className={`absolute bottom-2 right-2 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all focus:outline-none focus:ring-2 focus:ring-blue-400/60 disabled:cursor-not-allowed disabled:opacity-50 ${
          isListening
            ? 'animate-pulse border-red-100 bg-red-600 text-white shadow-[0_0_0_4px_rgba(239,68,68,0.2),0_8px_18px_rgba(127,29,29,0.35)]'
            : 'border-white/40 bg-[#101522] text-white shadow-[0_8px_16px_rgba(15,23,42,0.22)] hover:border-white/60 hover:bg-[#1b2435]'
        }`}
      >
        {isListening ? <MicOff className="h-5 w-5" strokeWidth={3} /> : <Mic className="h-5 w-5" strokeWidth={3} />}
      </button>
      {error && (
        <div className="mt-1 text-xs text-red-600 dark:text-red-300" role="alert">
          {error}
        </div>
      )}
    </>
  );
};

export default SpeechDictationButton;
