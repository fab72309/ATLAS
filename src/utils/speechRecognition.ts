// Définition du type pour la reconnaissance vocale
interface SpeechRecognitionConfig {
  onResult: (text: string) => void;
  onStart: () => void;
  onEnd: () => void;
  onError: (error: Error) => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechRecognitionResultLike = {
  0?: { transcript?: string };
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionErrorEventLike = {
  error?: string;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export class SpeechRecognitionService {
  private recognition: SpeechRecognitionLike | null = null;
  private isSupported: boolean;

  constructor() {
    // Vérifier le support de la reconnaissance vocale
    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
      mozSpeechRecognition?: SpeechRecognitionConstructor;
      msSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const SpeechRecognition = speechWindow.SpeechRecognition ||
                             speechWindow.webkitSpeechRecognition ||
                             speechWindow.mozSpeechRecognition ||
                             speechWindow.msSpeechRecognition;

    this.isSupported = !!SpeechRecognition;
    
    if (this.isSupported) {
      this.recognition = new SpeechRecognition();
      this.recognition.lang = 'fr-FR';
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
    }
  }

  public start(config: SpeechRecognitionConfig) {
    if (!this.isSupported) {
      config.onError(new Error('La reconnaissance vocale n\'est pas supportée par votre navigateur.'));
      return;
    }

    try {
      // Configuration des événements
      this.recognition.onstart = () => {
        config.onStart();
      };

      this.recognition.onresult = (event: SpeechRecognitionEventLike) => {
        const transcript = Array.from(event.results)
          .map((result) => result[0])
          .map((result) => result?.transcript || '')
          .join('');
        
        config.onResult(transcript);
      };

      this.recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
        let errorMessage = 'Une erreur est survenue avec la reconnaissance vocale.';
        
        switch (event.error) {
          case 'network':
            errorMessage = 'Erreur réseau. Vérifiez votre connexion internet.';
            break;
          case 'not-allowed':
          case 'permission-denied':
            errorMessage = 'L\'accès au microphone a été refusé.';
            break;
          case 'no-speech':
            errorMessage = 'Aucune parole n\'a été détectée.';
            break;
          case 'audio-capture':
            errorMessage = 'Aucun microphone n\'a été détecté.';
            break;
        }

        config.onError(new Error(errorMessage));
      };

      this.recognition.onend = () => {
        config.onEnd();
      };

      // Démarrer la reconnaissance
      this.recognition.start();
    } catch (error) {
      const fallbackError = error instanceof Error ? error : new Error('Erreur de reconnaissance vocale.');
      config.onError(fallbackError);
    }
  }

  public stop() {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (error) {
        console.error('Erreur lors de l\'arrêt de la reconnaissance vocale:', error);
      }
    }
  }

  public isRecognitionSupported(): boolean {
    return this.isSupported;
  }
}
