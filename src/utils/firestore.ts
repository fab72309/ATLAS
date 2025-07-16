import { collection, addDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface AIAnalysisData {
  input: string;
  output_situation: string;
  output_objectifs: string;
  output_idees_manoeuvre: string;
  output_execution: string;
  output_commandement: string;
  groupe_horaire: Date;
}

export interface DictationData {
  type: 'group' | 'column';
  situation: string;
  objectifs: string;
  idees: string;
  execution: string;
  commandement: string;
  anticipation?: string;
  groupe_horaire: Date;
}

export interface CommunicationData {
  groupe_horaire: Date;
  Engagement_secours: string;
  Situation_appel: string;
  Situation_arrivee: string;
  Nombre_victimes: string;
  Moyens: string;
  Actions_secours: string;
  Conseils_population: string;
}

export interface CommunicationIAData {
  input: string;
  groupe_horaire: Date;
  Engagement_secours: string;
  Situation_appel: string;
  Situation_arrivee: string;
  Nombre_victimes: string;
  Moyens: string;
  Actions_secours: string;
  Conseils_population: string;
}

export const saveDictationData = async (data: DictationData) => {
  try {
    const collectionRef = collection(db, data.type === 'group' ? 'Chef_de_groupe' : 'Chef_de_colonne');
    const docRef = await addDoc(collectionRef, data);
    console.log('Document written with ID: ', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Erreur lors de la sauvegarde dans Firestore:', error);
    throw error;
  }
};

export const saveAIAnalysis = async (data: AIAnalysisData) => {
  try {
    const collectionRef = collection(db, 'Chef_de_groupe_IA');
    const docRef = await addDoc(collectionRef, data);
    console.log('AI Analysis saved with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error saving AI analysis to Firestore:', error);
    throw error;
  }
};

export const saveCommunicationData = async (data: CommunicationData) => {
  try {
    const docRef = await addDoc(collection(db, 'Communication_OPS'), data);
    console.log('Document written with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Erreur lors de la sauvegarde dans Firestore:', error);
    throw error;
  }
};

export const saveCommunicationIAData = async (data: CommunicationIAData) => {
  try {
    const docRef = await addDoc(collection(db, 'Communication_OPS_IA'), data);
    console.log('Communication IA analysis saved with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error saving Communication IA analysis to Firestore:', error);
    throw error;
  }
};