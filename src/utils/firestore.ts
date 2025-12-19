import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, authReady, db } from './firebase';

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
  type: 'group' | 'column' | 'site';
  situation: string;
  objectifs: string;
  idees: string;
  execution: string;
  commandement: string;
  anticipation?: string;
  groupe_horaire: Date;
  dominante?: string;
  adresse?: string;
  heure_ordre?: string;
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
  dominante?: string;
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
  dominante?: string;
}

export const saveDictationData = async (data: DictationData) => {
  try {
    await authReady;
    const user = auth.currentUser;
    if (!user) throw new Error('Utilisateur non authentifié. Merci de vous connecter.');
    let collectionName = 'Chef_de_groupe';
    if (data.type === 'column') collectionName = 'Chef_de_colonne';
    if (data.type === 'site') collectionName = 'Chef_de_site';

    const collectionRef = collection(db, collectionName);
    const docRef = await addDoc(collectionRef, {
      ...data,
      uid: user.uid,
      createdAt: serverTimestamp()
    });
    console.log('Document written with ID: ', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Erreur lors de la sauvegarde dans Firestore:', error);
    throw error;
  }
};

export const saveAIAnalysis = async (data: AIAnalysisData) => {
  try {
    await authReady;
    const user = auth.currentUser;
    if (!user) throw new Error('Utilisateur non authentifié. Merci de vous connecter.');
    const collectionRef = collection(db, 'Chef_de_groupe_IA');
    const docRef = await addDoc(collectionRef, {
      ...data,
      uid: user.uid,
      createdAt: serverTimestamp()
    });
    console.log('AI Analysis saved with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error saving AI analysis to Firestore:', error);
    throw error;
  }
};

export const saveCommunicationData = async (data: CommunicationData) => {
  try {
    await authReady;
    const user = auth.currentUser;
    if (!user) throw new Error('Utilisateur non authentifié. Merci de vous connecter.');
    const docRef = await addDoc(collection(db, 'Communication_OPS'), {
      ...data,
      uid: user.uid,
      createdAt: serverTimestamp()
    });
    console.log('Document written with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Erreur lors de la sauvegarde dans Firestore:', error);
    throw error;
  }
};

export const saveCommunicationIAData = async (data: CommunicationIAData) => {
  try {
    await authReady;
    const user = auth.currentUser;
    if (!user) throw new Error('Utilisateur non authentifié. Merci de vous connecter.');
    const docRef = await addDoc(collection(db, 'Communication_OPS_IA'), {
      ...data,
      uid: user.uid,
      createdAt: serverTimestamp()
    });
    console.log('Communication IA analysis saved with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error saving Communication IA analysis to Firestore:', error);
    throw error;
  }
};
