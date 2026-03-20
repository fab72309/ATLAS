import type { DominanteType } from '../utils/dominantes';

type OfflineDoctrineEntry = {
  objectifs: readonly string[];
  idees_manoeuvre: readonly string[];
};

export const OFFLINE_DOCTRINE_SUGGESTIONS = {
  Incendie: {
    objectifs: [
      'Sauver les occupants menacés immédiatement',
      'Mettre en sécurité les personnes exposées aux fumées',
      'Confiner les personnes des étages supérieurs',
      'Evacuer les habitants des étages supérieurs',
      'Enrayer la propagation',
      'Stopper la propagation verticale',
      'Stopper la propagation horizontale',
      'Attaquer le foyer principal',
      'Protéger les biens environnants',
      'Eviter le risque de reprise de feu'
    ],
    idees_manoeuvre: [
      'Reconnaissance sous ARI avec une LDV et caméra thermique',
      "Sauvetage par l'extérieur au moyen des échelles aériennes",
      "Sauvetage par les communications existantes",
      'Mise en sécurité par confinement',
      "Attaque massive et rapide depuis l'extérieur",
      'Attaque directe du foyer',
      "Établissement d'une lance sur colonne sèche",
      'Création d’un exutoire en partie haute',
      'Ventilation par surpression',
      "Mise en place d'un périmètre de sécurité"
    ]
  },
  'Risque Gaz': {
    objectifs: [
      "Soustraire les personnes au risque d'explosion",
      'Supprimer la source de gaz',
      "Abaisser la limite inférieure d'explosivité"
    ],
    idees_manoeuvre: [
      'Établir un périmètre de sécurité élargi',
      'Évacuer les populations en zone de danger',
      'Confiner les populations hors zone directe',
      'Barrer la conduite de gaz',
      "Réaliser des mesures d'explosimétrie en continu",
      'Ventiler les locaux',
      "Protéger les intervenants par rideau d'eau si fuite enflammée"
    ]
  },
  'Accident de circulation': {
    objectifs: [
      'Protéger les victimes et les intervenants',
      'Extraire les victimes incarcérées',
      'Assurer la prise en charge médicale',
      "Préserver l'environnement"
    ],
    idees_manoeuvre: [
      "Établir un périmètre de sécurité et un balisage d'urgence",
      'Stabiliser et caler le ou les véhicules',
      "Réaliser l'abord médical",
      'Procéder à la désincarcération',
      'Assurer la protection incendie',
      "Obturer les fuites d'hydrocarbures"
    ]
  },
  SMV: {
    objectifs: [
      'Trier et catégoriser les victimes',
      'Regrouper les victimes en zone sécurisée',
      'Evacuer vers les centres hospitaliers'
    ],
    idees_manoeuvre: [
      'Mettre en place un PRV',
      'Réaliser un tri visuel rapide',
      'Sécuriser la zone d’intervention'
    ]
  },
  SUAP: {
    objectifs: [
      'Trier et catégoriser les victimes',
      'Regrouper les victimes en zone sécurisée',
      'Evacuer vers les centres hospitaliers'
    ],
    idees_manoeuvre: [
      'Mettre en place un PRV',
      'Réaliser un tri visuel rapide',
      'Sécuriser la zone d’intervention'
    ]
  },
  NRBC: {
    objectifs: [
      'Trier et catégoriser les victimes',
      'Regrouper les victimes en zone sécurisée',
      'Evacuer vers les centres hospitaliers'
    ],
    idees_manoeuvre: [
      'Mettre en place un PRV',
      'Réaliser un tri visuel rapide',
      'Mettre en œuvre une chaîne de décontamination',
      'Sécuriser la zone d’intervention'
    ]
  },
  'Risque Chimique': {
    objectifs: [
      "Soustraire les personnes au risque d'explosion",
      'Supprimer la source de danger',
      "Abaisser le niveau d'exposition"
    ],
    idees_manoeuvre: [
      'Établir un périmètre de sécurité élargi',
      'Évacuer les populations en zone de danger',
      'Confiner les populations hors zone directe',
      'Réaliser des mesures en continu',
      'Ventiler les locaux si pertinent'
    ]
  },
  'Risque Radiologique': {
    objectifs: [
      'Trier et catégoriser les victimes',
      'Regrouper les victimes en zone sécurisée',
      'Evacuer vers les centres hospitaliers'
    ],
    idees_manoeuvre: [
      'Mettre en place un PRV',
      'Réaliser un tri visuel rapide',
      'Mettre en œuvre une chaîne de décontamination',
      'Sécuriser la zone d’intervention'
    ]
  },
  'Feux de végétation': {
    objectifs: [
      'Protéger les points sensibles',
      'Limiter la propagation du front de feu',
      'Noyer les lisières'
    ],
    idees_manoeuvre: [
      'Attaque directe sur le front de feu',
      'Attaque de flanc pour réduire l’intensité',
      'Défense de points sensibles',
      'Établissement de lignes d’appui',
      'Reconnaissance aérienne'
    ]
  },
  'Incendie de végétation': {
    objectifs: [
      'Protéger les points sensibles',
      'Limiter la propagation du front de feu',
      'Noyer les lisières'
    ],
    idees_manoeuvre: [
      'Attaque directe sur le front de feu',
      'Attaque de flanc pour réduire l’intensité',
      'Défense de points sensibles',
      'Établissement de lignes d’appui',
      'Reconnaissance aérienne'
    ]
  }
} as const;

export type OfflineDoctrineSuggestions = Partial<Record<DominanteType, OfflineDoctrineEntry>> & Record<string, OfflineDoctrineEntry>;
