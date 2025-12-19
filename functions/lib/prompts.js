// Prompts et schémas JSON pour l’IA ATLAS (serveur uniquement)
// Les clés OpenAI restent côté serveur. Le front appelle une Function HTTPS.
// Schémas de sortie attendus par type (minimaux, compatibles avec le front)
// Le front sait afficher un objet { sections: Array<{title, content}> }.
export const OutputSchemas = {
    group: {
        name: 'atlas_order_group',
        schema: {
            type: 'object',
            additionalProperties: false,
            required: ['sections'],
            properties: {
                sections: {
                    type: 'array',
                    minItems: 5,
                    items: {
                        type: 'object',
                        required: ['title', 'content'],
                        additionalProperties: false,
                        properties: {
                            title: { type: 'string', enum: ['Situation', 'Objectifs', 'Idées de manœuvre', 'Exécution', 'Commandement'] },
                            content: { type: 'string' }
                        }
                    }
                }
            }
        }
    },
    column: {
        name: 'atlas_order_column',
        schema: {
            type: 'object',
            additionalProperties: false,
            required: ['sections'],
            properties: {
                sections: {
                    type: 'array',
                    minItems: 6,
                    items: {
                        type: 'object',
                        required: ['title', 'content'],
                        additionalProperties: false,
                        properties: {
                            title: { type: 'string', enum: ['Situation', 'Anticipation', 'Objectifs', 'Idées de manœuvre', 'Exécution', 'Commandement'] },
                            content: { type: 'string' }
                        }
                    }
                }
            }
        }
    },
    site: {
        name: 'atlas_order_site',
        schema: {
            type: 'object',
            additionalProperties: false,
            required: ['sections'],
            properties: {
                sections: {
                    type: 'array',
                    minItems: 5,
                    items: {
                        type: 'object',
                        required: ['title', 'content'],
                        additionalProperties: false,
                        properties: {
                            title: { type: 'string', enum: ['Situation', 'Objectifs', 'Idées de manœuvre', 'Exécution', 'Commandement'] },
                            content: { type: 'string' }
                        }
                    }
                }
            }
        }
    },
    communication: {
        name: 'atlas_communication_ops',
        schema: {
            type: 'object',
            additionalProperties: false,
            required: ['sections'],
            properties: {
                sections: {
                    type: 'array',
                    minItems: 7,
                    items: {
                        type: 'object',
                        required: ['title', 'content'],
                        additionalProperties: false,
                        properties: {
                            title: { type: 'string', enum: [
                                    'Engagement des secours',
                                    "Situation à l'appel",
                                    "Situation à l'arrivée des secours",
                                    'Nombres de victimes',
                                    'Moyens mis en œuvre',
                                    'Actions des secours',
                                    'Conseils à la population'
                                ] },
                            content: { type: 'string' }
                        }
                    }
                }
            }
        }
    }
};
// Developer/system prompts par niveau
export const DeveloperPrompts = {
    group: `Tu es un assistant opérationnel sapeurs-pompiers pour un Chef de groupe.
Ta mission: transformer une description libre en un Ordre Initial clair et actionnable.
Règles:
- Réponds UNIQUEMENT en JSON valide selon le schéma fourni.
- Langue: français, style professionnel et concis.
- Privilégie des points clairs (phrases courtes, bullets).
- N’invente pas d’informations. Si un point est absent, indique « À compléter » et propose des hypothèses prudemment.
- Priorité à la sécurité, au marquage des zones et à la coordination des moyens.
- Structure obligatoire: Situation, Objectifs, Idées de manœuvre, Exécution, Commandement.
`,
    column: `Tu es un assistant opérationnel sapeurs-pompiers pour un Chef de colonne.
Ta mission: produire un Ordre Initial au niveau colonne, intégrant l’anticipation.
Règles:
- Réponds UNIQUEMENT en JSON valide selon le schéma fourni.
- Langue: français, style professionnel et concis ; pense niveau tactique/stratégique.
- N’invente pas; indique « À compléter » si nécessaire; propose des variantes selon scénarios d’évolution.
- Structure obligatoire: Situation, Anticipation, Objectifs, Idées de manœuvre, Exécution, Commandement.
`,
    site: `Tu es un assistant opérationnel pour un Chef de site.
Ta mission: produire un Ordre Initial orienté interservices et coordination site.
Règles:
- Réponds UNIQUEMENT en JSON valide selon le schéma fourni.
- Langue: français; clarté, sobriété; inclure coordination, interfaces (forces de l’ordre, réseaux, mairie, etc.).
- N’invente pas; signale les inconnues (« À compléter »).
- Structure obligatoire: Situation, Objectifs, Idées de manœuvre, Exécution, Commandement.
`,
    communication: `Tu es un assistant Communication Opérationnelle.
Ta mission: transformer des informations d’intervention en un point de situation clair.
Règles:
- Réponds UNIQUEMENT en JSON valide selon le schéma fourni.
- Langue: français; phrases simples; évite le jargon.
- Aucune donnée personnelle ou sensible inutile; pas de spéculation.
- Structure: Engagement des secours, Situation à l'appel, Situation à l'arrivée des secours, Nombres de victimes, Moyens mis en œuvre, Actions des secours, Conseils à la population.
`
};
export const buildUserPrompt = (type, mode, input) => {
    const headerLines = [`Niveau: ${type}`, `Mode: ${mode}`];
    if (input.dominante)
        headerLines.push(`Dominante: ${input.dominante}`);
    if (input.secondaryRisks?.length)
        headerLines.push(`Risques secondaires: ${input.secondaryRisks.join(', ')}`);
    const extraContextBlock = (input.extraContext ?? '').trim();
    const header = headerLines.join('\n');
    if (mode === 'elements_dictes' && input.sections) {
        const serial = Object.entries(input.sections)
            .filter(([, v]) => (v ?? '').trim().length > 0)
            .map(([k, v]) => `- ${k}:\n${(v ?? '').trim()}`)
            .join('\n\n');
        const context = extraContextBlock ? `\n\nContexte complémentaire:\n${extraContextBlock}` : '';
        return `${header}\n\nDonnées:\n${serial}${context}\n\nConsigne: Produis la structure demandée.`;
    }
    const texte = (input.texte ?? '').trim();
    const context = extraContextBlock ? `\n\nContexte complémentaire:\n${extraContextBlock}` : '';
    return `${header}\n\nTexte dicté:\n${texte}${context}\n\nConsigne: Analyse et structure selon le schéma cible.`;
};
