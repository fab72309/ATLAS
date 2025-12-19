import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { auth, authReady, db } from './firebase';

export type DateLike = Date | string | number | Timestamp;

export interface AIAnalysisData {
  input: string;
  output_situation: string;
  output_objectifs: string;
  output_idees_manoeuvre: string;
  output_execution: string;
  output_commandement: string;
  groupe_horaire: DateLike;
}

export interface DictationData {
  type: 'group' | 'column' | 'site';
  situation: string;
  objectifs: string;
  idees: string;
  execution: string;
  commandement: string;
  anticipation?: string;
  groupe_horaire: DateLike;
  dominante?: string;
  adresse?: string;
  heure_ordre?: string;
}

export interface CommunicationData {
  groupe_horaire: DateLike;
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
  groupe_horaire: DateLike;
  Engagement_secours: string;
  Situation_appel: string;
  Situation_arrivee: string;
  Nombre_victimes: string;
  Moyens: string;
  Actions_secours: string;
  Conseils_population: string;
  dominante?: string;
}

const assertString = (label: string, value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} est requis et doit être une chaîne de caractères.`);
  }
  return value.trim();
};

const toTimestamp = (value: DateLike, label = 'Date fournie') => {
  if (value instanceof Timestamp) return value;
  const dateValue = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dateValue.getTime())) {
    throw new Error(`${label} est invalide.`);
  }
  return Timestamp.fromDate(dateValue);
};

const requireUser = async () => {
  await authReady;
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Utilisateur non authentifié.');
  }
  return currentUser;
};

const withAuditFields = (data: Record<string, unknown>, uid: string) => ({
  ...data,
  uid,
  createdAt: serverTimestamp()
});

const normalizeDictationData = (data: DictationData) => {
  if (!['group', 'column', 'site'].includes(data.type)) {
    throw new Error('Type de commandement invalide');
  }

  return {
    type: data.type,
    situation: assertString('Situation', data.situation),
    objectifs: assertString('Objectifs', data.objectifs),
    idees: assertString('Idées', data.idees),
    execution: assertString('Exécution', data.execution),
    commandement: assertString('Commandement', data.commandement),
    anticipation: data.anticipation?.trim() || undefined,
    groupe_horaire: toTimestamp(data.groupe_horaire, 'Groupe horaire'),
    dominante: data.dominante?.trim() || undefined,
    adresse: data.adresse?.trim() || undefined,
    heure_ordre: data.heure_ordre?.trim() || undefined
  } satisfies DictationData;
};

const normalizeAIAnalysis = (data: AIAnalysisData) => ({
  input: assertString('Texte d\'entrée', data.input),
  output_situation: assertString('Sortie situation', data.output_situation),
  output_objectifs: assertString('Sortie objectifs', data.output_objectifs),
  output_idees_manoeuvre: assertString('Sortie idées manoeuvre', data.output_idees_manoeuvre),
  output_execution: assertString('Sortie exécution', data.output_execution),
  output_commandement: assertString('Sortie commandement', data.output_commandement),
  groupe_horaire: toTimestamp(data.groupe_horaire, 'Groupe horaire')
});

const normalizeCommunication = (data: CommunicationData | CommunicationIAData) => ({
  groupe_horaire: toTimestamp(data.groupe_horaire, 'Groupe horaire'),
  Engagement_secours: assertString('Engagement des secours', data.Engagement_secours),
  Situation_appel: assertString('Situation à l\'appel', data.Situation_appel),
  Situation_arrivee: assertString('Situation à l\'arrivée', data.Situation_arrivee),
  Nombre_victimes: assertString('Nombre de victimes', data.Nombre_victimes),
  Moyens: assertString('Moyens', data.Moyens),
  Actions_secours: assertString('Actions de secours', data.Actions_secours),
  Conseils_population: assertString('Conseils à la population', data.Conseils_population),
  dominante: data.dominante?.trim() || undefined
});

export const saveDictationData = async (data: DictationData) => {
  try {
    const user = await requireUser();
    let collectionName = 'Chef_de_groupe';
    if (data.type === 'column') collectionName = 'Chef_de_colonne';
    if (data.type === 'site') collectionName = 'Chef_de_site';

    const collectionRef = collection(db, collectionName);
    const docRef = await addDoc(collectionRef, withAuditFields(normalizeDictationData(data), user.uid));
    console.log('Document written with ID: ', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Erreur lors de la sauvegarde dans Firestore:', error);
    throw error;
  }
};

export const saveAIAnalysis = async (data: AIAnalysisData) => {
  try {
    const user = await requireUser();
    const collectionRef = collection(db, 'Chef_de_groupe_IA');
    const docRef = await addDoc(collectionRef, withAuditFields(normalizeAIAnalysis(data), user.uid));
    console.log('AI Analysis saved with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error saving AI analysis to Firestore:', error);
    throw error;
  }
};

export const saveCommunicationData = async (data: CommunicationData) => {
  try {
    const user = await requireUser();
    const docRef = await addDoc(collection(db, 'Communication_OPS'), withAuditFields(normalizeCommunication(data), user.uid));
    console.log('Document written with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Erreur lors de la sauvegarde dans Firestore:', error);
    throw error;
  }
};

export const saveCommunicationIAData = async (data: CommunicationIAData) => {
  try {
    const user = await requireUser();
    const docRef = await addDoc(collection(db, 'Communication_OPS_IA'), withAuditFields({
      input: assertString('Texte d\'entrée', data.input),
      ...normalizeCommunication(data)
    }, user.uid));
    console.log('Communication IA analysis saved with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error saving Communication IA analysis to Firestore:', error);
    throw error;
  }
};
