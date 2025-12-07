export const DOCTRINE_CONTEXT = {
    "incendie_structure": {
        "principes_cles": [
            "Marche en avant",
            "Contrôle des ouvrants et maîtrise de l'air (anti-ventilation tant que l'attaque n'est pas prête)",
            "Sécurité des binômes (Règle des 20 minutes, liaison personnelle, binôme de sécurité)",
            "Ventilation opérationnelle précoce dès que le feu maitrisé",
            "Sauvetage prioritaire sur l'extinction sauf si l'extinction est le seul moyen de réaliser le sauvetage"
        ],
        "objectifs": [
            "Sauver les occupants menacés immédiatement",
            "Mettre en sécurité les personnes exposées aux fumées",
            "Confiner les personnes des étages supérieurs",
            "Evacuer les habitants des étages supérieurs",
            "Enrayer la propagation",
            "Stopper la propagation verticale (façades, cages d'escalier, gaines)",
            "Stopper la propagation horizontale (cloisonnement, combles)",
            "Eviter la propagation verticale(façades, cages d'escalier, gaines)",
            "Eviter la propagation horizontale (cloisonnement, combles)",
            "Attaquer le foyer principal",
            "Protéger les biens environnants",
            "Protéger les biens menacés par les eaux d'extinction ou les fumées",
            "Eviter le risque de reprise de feu"
        ],
        "idees_manoeuvre": [
            "Reconnaissance sous ARI avec une LDV et caméra thermique",
            "Sauvetage par l'extérieur au moyen des échelles aériennes (EPA) ou à mains",
            "Sauvetage par les communications existantes (cagoule d'évacuation)",
            "Mise en sécurité par confinement (si évacuation impossible ou dangereuse)",
            "Attaque massive et rapide depuis l'extérieur (technique d'atténuation)",
            "Attaque directe du foyer (lance à débit variable, jet droit/diffusé)",
            "Établissement d'une lance sur colonne sèche",
            "Création d'un exutoire en partie haute (désenfumage)",
            "Ventilation par surpression (VPP) pour protéger la cage d'escalier",
            "Mise en place d'un périmètre de sécurité"
        ],
        "moyens_standards_td": [
            "FPT (Fourgon Pompe Tonne) : Armement 6 pax, capacité hydraulique 2000L/min, échelles à mains, ARI, capacité à établir 3 LDV 500 ou LDV 1000, reconnaissance et sauvetage de victimes",
            "EPC (Echelle Pivotante à mouvements Combinés) : Sauvetage aérien, reconnaissance hauteur, établissement de lance 950L/min portée 40m",
            "VSAV (Véhicule de Secours et d'Assistance aux Victimes) : Prise en charge victimes, soutien sanitaire",
            "VLCg (Véhicule de Liaison Chef de Groupe) : Commandement",
            "CDHR (Camion Dévidoir Hors Route) : Si alimentation en eau éloignée (renfort)",
            "CCEM (Camion Citerne Eau Mousse): 9500L d'eau 2500L d'émulseur, 240L d'additif, 1 lance canon sur toit 4000L/min (portée 55m), 1 lance canon mobile 4000L/min (portée 55m), 1 bâche de 12 000L",
            "CCEMs (Camion Citerne Eau Mousse Super): 11 000L d'eau 2500L d'émulseur, 500L d'additif, 1 lance canon sur toit 4000l/min (portée 55m), 1 lance canon mobile 4000l/min (portée 55m), 1 bâche de 11 000l",
            "BEAA (Bras Elevateur Aérien Automobile) : Travail en hauteur à 46m, 1 lance canon eau et mousse 4500L/min",
            "--- GROUPES CONSTITUÉS (RENFORTS) ---",
            "G.INC (Groupe Incendie) : Constitué de 1 CDG + 1 EPC + 2 FPT. Capacité : Reconnaissances sous ARI, Sauvetages, Etablissement de 4 LDV 500 (à 200m) ou 1 LDV 1000 (à 400m).",
            "G.ALIM (Groupe Alimentation) : Constitué de 1 CDG + 1 CCEM + 2 CDHR + 1 FPT. Capacité : Alimenter 4000 L/min à 1000m, Stock tampon 8000L.",
            "G.FIND (Groupe Feu Industriel) : Constitué de 1 CDG + 1 BEAA (ou EPC) + 1 CCEM + 1 CDHR + 1 FPT. Capacité : 1 Canon 4000 L/min à 500m ou 2 Canons 2000 L/min.",
            "G.LINF (Groupe Liquides Inflammables) : Constitué de 1 CDG + 1 VPCE/CEM + 1 CCEM + 1 CDHR + 1 FPT. Capacité : 4000 L/min solution moussante à 500m. Couverture 800m² hydrocarbure.",
            "G.RS (Groupe Renfort Secours) : Constitué de 1 CDG + 1 FPT + 1 G.ELD + 1 VSAV + 1 VLI + 1 GDMED. Capacité : Renforcer un dispositif désorganisé, soutien sanitaire lourd."
        ]
    },
    "secours_routier": {
        "principes_cles": [
            "Protection - Balisage - Calage - Abord",
            "Golden Hour",
            "Technique de désincarcération adaptée à l'état de la victime"
        ],
        "objectifs": [
            "Protéger les victimes et les intervenants (Suraccident)",
            "Extraire la/les victimes incarcérées",
            "Assurer la prise en charge médicale",
            "Préserver l'environnement (pollutions)"
        ],
        "idees_manoeuvre": [
            "Établir un périmètre de sécurité et un balisage d'urgence",
            "Stabiliser et caler le(s) véhicule(s)",
            "Réaliser l'abord médical (écureuil)",
            "Procéder à la désincarcération (pavillon, portière, charnière)",
            "Assurer la protection incendie (lance en attente)",
            "Obturer les fuites d'hydrocarbures"
        ],
        "moyens_standards_td": [
            "VSR (Véhicule Secours Routier) ou FPTSR",
            "VSAV",
            "VLCg",
            "Moyens de balisage (VPI ou FPT en protection)"
        ]
    },
    "fuite_gaz": {
        "principes_cles": [
            "Procédure Gaz Renforcée (PGR) vs Classique (PGC)",
            "Ne pas manœuvrer d'interrupteurs électriques",
            "Approche dos au vent"
        ],
        "objectifs": [
            "Soustraire les personnes au risque d'explosion",
            "Supprimer la source de gaz",
            "Abaisser la limite inférieure d'explosivité (LIE)"
        ],
        "idees_manoeuvre": [
            "Établir un périmètre de sécurité élargi (Zone d'exclusion)",
            "Évacuer les populations en zone de danger",
            "Confiner les populations hors zone directe",
            "Barrer la conduite de gaz (organes de coupure)",
            "Réaliser des mesures d'explosimétrie en continu",
            "Ventiler les locaux (naturellement ou mécaniquement si moteur antidéflagrant)",
            "Protéger les intervenants (lance en rideau d'eau si fuite enflammée)"
        ],
        "moyens_standards_td": [
            "FPT",
            "VLCg",
            "Technicien GRDF (demandé)"
        ]
    },
    "incendie_vegetation": {
        "principes_cles": [
            "Attaque flanc / tête",
            "LACES (Lookout, Anchor, Communication, Escape, Safety)",
            "Autoprotection prioritaire si cerné"
        ],
        "objectifs": [
            "Protéger les points sensibles (habitations)",
            "Limiter la propagation du front de feu",
            "Noyer les lisières"
        ],
        "idees_manoeuvre": [
            "Attaque directe sur le front de feu",
            "Attaque de flanc pour réduire l'intensité",
            "Défense de points sensibles (DPS)",
            "Établissement de lignes d'appui",
            "Reconnaissance aérienne (drone/hélico)"
        ],
        "moyens_standards_td": [
            "CCF (Camion Citerne Feux de forêts) - souvent par groupe de 4 (GIFF)",
            "VLHR (Véhicule Liaison Hors Route)",
            "Porteur d'eau (Gde Capacité)"
        ]
    },
    "secours_personne_complexe": {
        "contexte": "Nombreuses victimes ou risques particuliers (intox CO, etc.)",
        "objectifs": [
            "Trier et catégoriser les victimes",
            "Regrouper les victimes en zone sécurisée",
            "Evacuer vers les centres hospitaliers"
        ],
        "idees_manoeuvre": [
            "Mettre en place un PRV (Point de Rassemblement des Victimes)",
            "Réaliser un tri visuel rapide",
            "Mettre en œuvre une chaîne de décontamination (si NRBC)",
            "Sécuriser la zone d'intervention (SUAP)"
        ],
        "moyens_standards_td": [
            "Multiples VSAV",
            "VLCg",
            "SMUR",
            "FPT (pour brancardage ou sécurité)"
        ]
    }
};
