// Fichier de donnees editable.
// Modifier uniquement les labels et les listes ci-dessous.
// Ne pas ajouter de logique ici.

export const MEANS_DOCTRINE_LABELS = {
  incendie: "Moyens de lutte contre l'incendie",
  alimentation: "Moyens d'alimentation",
  suap: "Moyens de secours a personne",
  soutien: "Moyens d'appui et de soutien",
  specialistes: "Moyens spécialisés",
  commandement: "Moyens de commandement",
  exterieurs: "Partenaires extérieurs"
} as const;

export const MEANS_DOCTRINE_STANDARD = {
  incendie: [
    "FPT (Fourgon Pompe Tonne) : Armement 6 pax, capacité hydraulique 2000L/min, échelles à mains, ARI, capacité à établir 3 LDV 500 ou LDV 1000, reconnaissance et sauvetage de victimes",
    "EPC (Echelle Pivotante à mouvements Combinés) : Sauvetage aérien, reconnaissance hauteur, établissement de lance 950L/min portée 40m",
    "CDHR (Camion Dévidoir Hors Route) : Si alimentation en eau éloignée (renfort)",
    "CCEM (Camion Citerne Eau Mousse) : 9500L d'eau 2500L d'émulseur, 240L d'additif, 1 lance canon sur toit 4000L/min (portée 55m), 1 lance canon mobile 4000L/min (portée 55m), 1 bâche de 12 000L",
    "CCEMs (Camion Citerne Eau Mousse Super) : 11 000L d'eau 2500L d'émulseur, 500L d'additif, 1 lance canon sur toit 4000L/min (portée 55m), 1 lance canon mobile 4000L/min (portée 55m), 1 bâche de 11 000L",
    "BEAA (Bras Elevateur Aérien Automobile) : Travail en hauteur à 46m, 1 lance canon eau et mousse 4500L/min",
    "VFS (Véhicule Feux Spéciaux): ",
    "CCFM (Camion-Citerne Feux de Forêts Moyen): ",
    "CEM: (Cellule Emulseur): ",
    "GROUPES CONSTITUÉS (RENFORTS)",
    "G.INC (Groupe Incendie) : Constitué de 1 CDG + 1 EPC + 2 FPT. Capacité : Reconnaissances sous ARI, sauvetages, établissement de 4 LDV 500 (à 200m) ou 1 LDV 1000 (à 400m).",
    "G.ALIM (Groupe Alimentation) : Constitué de 1 CDG + 1 CCEM + 2 CDHR + 1 FPT. Capacité : Alimenter 4000 L/min à 1000m, stock tampon 8000L.",
    "G.FIND (Groupe Feu Industriel) : Constitué de 1 CDG + 1 BEAA (ou EPC) + 1 CCEM + 1 CDHR + 1 FPT. Capacité : 1 canon 4000 L/min à 500m ou 2 canons 2000 L/min.",
    "G.LINF (Groupe Liquides Inflammables) : Constitué de 1 CDG + 1 VPCE/CEM + 1 CCEM + 1 CDHR + 1 FPT. Capacité : 4000 L/min solution moussante à 500m. Couverture 800m² hydrocarbure.",
    "G.RS (Groupe Renfort Secours) : Constitué de 1 CDG + 1 FPT + 1 G.ELD + 1 VSAV + 1 VLI + 1 GDMED. Capacité : Renforcer un dispositif désorganisé, soutien sanitaire lourd."
  ],
  alimentation: [
    "CDHR (Camion Dévidoir Hors Route): ",
    "RCGC (Remorque Citerne Grande Capacité): ",
    "CED (Cellule Dévidoir): ",
    "MPR (Moto Pompe Remorquable): ",
    "MPR 180 (Moto Pompe Remorquable 180m3): "
  ],
  suap: [
    "VSAV (Véhicule de Secours et d'Assistance aux Victimes) : Prise en charge victimes, soutien sanitaire",
    "VLI (Véhicule Léger Infirmier) : Prise en charge paramédicale de victimes, soutien sanitaire opérationnel",
    "SMUR : Renfort médicalisé",
    "VPRV (Véhicule Point de Regroupement des Victimes) : Appui SUAP, création PRV/PMA"
  ],
  soutien: [
    "VAS (Véhicule d'Appui et de Soutien) : Protection, ventilation, éclairage",
    "CEAR (Cellule Assistance Respiratoire)",
    "RLUX (Remorque Eclairage)"
  ],
  commandement: [
    "VLCG (Véhicule de Liaison Chef de Groupe) : Poste de commandement léger",
    "VLCC (Véhicule de Liaison Chef de Colonne) : Commandement de niveau colonne",
    "VLCS (Véhicule de Liaison Chef de Site) : Commandement de niveau site",
    "VPC (Véhicule Poste de Commandement) : Poste de commandement de niveau colonne",
    "OFFSECU (Officier Sécurité) : Appui sécurité opérationnelle",
    "DSM (Directeur des Secours Médicaux) : Coordination médicale",
    "GDMED (Garde Départementale Médicale) : Appui médical départemental"
  ],
  exterieurs: [
    "ENEDIS : Expertise réseau électricité et coupures",
    "GRDF : Expertise réseau gaz et coupures",
    "FSI : Forces de sécurité interieure"
  ]
} as const;
