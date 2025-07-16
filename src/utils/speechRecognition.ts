// Définition du type pour la reconnaissance vocale
interface SpeechRecognitionConfig {
  onResult: (text: string) => void;
  onStart: () => void;
  onEnd: () => void;
  onError: (error: any) => void;
}

export class SpeechRecognitionService {
  private recognition: any;
  private isSupported: boolean;

  constructor() {
    // Vérifier le support de la reconnaissance vocale
    const SpeechRecognition = (window as any).SpeechRecognition || 
                             (window as any).webkitSpeechRecognition ||
                             (window as any).mozSpeechRecognition ||
                             (window as any).msSpeechRecognition;

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

      this.recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0])
          .map(result => result.transcript)
          .join('');
        
        config.onResult(transcript);
      };

      this.recognition.onerror = (event: any) => {
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
      config.onError(error);
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