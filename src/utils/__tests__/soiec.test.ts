import { describe, it, expect } from 'vitest'
import {
  buildOrdreTitle,
  normalizeSimpleSectionItems,
  getSimpleSectionContentList,
  getSimpleSectionText,
  parseOrdreInitial,
  formatSoiecList,
  formatIdeeManoeuvreList,
  formatExecutionValue,
  buildMessageDemandesSummary,
  buildMessageSurLesLieuxSummary,
} from '../soiec'
import type { MessageSummaryOption } from '../soiec'

// ─── buildOrdreTitle ─────────────────────────────────────────────────────────

describe('buildOrdreTitle', () => {
  it('includes the provided role in the title', () => {
    expect(buildOrdreTitle('Chef de colonne')).toBe('ORDRE INITIAL – Chef de colonne')
  })

  it('defaults to "Chef de groupe" when no role is provided', () => {
    expect(buildOrdreTitle()).toBe('ORDRE INITIAL – Chef de groupe')
  })

  it('defaults to "Chef de groupe" when role is an empty string', () => {
    expect(buildOrdreTitle('')).toBe('ORDRE INITIAL – Chef de groupe')
  })
})

// ─── normalizeSimpleSectionItems ─────────────────────────────────────────────

describe('normalizeSimpleSectionItems', () => {
  it('returns empty array for null/undefined input', () => {
    expect(normalizeSimpleSectionItems(null)).toEqual([])
    expect(normalizeSimpleSectionItems(undefined)).toEqual([])
  })

  it('splits a newline-separated string into multiple items', () => {
    const result = normalizeSimpleSectionItems('Premier\nDeuxième\nTroisième')
    expect(result).toHaveLength(3)
    expect(result[0]).toBe('Premier')
    expect(result[1]).toBe('Deuxième')
  })

  it('passes through an array of strings unchanged', () => {
    const result = normalizeSimpleSectionItems(['alpha', 'beta'])
    expect(result).toEqual(['alpha', 'beta'])
  })

  it('normalizes an array containing objects with a content field', () => {
    const input = [{ type: 'text', id: 'id-1', content: 'My content' }]
    const result = normalizeSimpleSectionItems(input)
    expect(result).toHaveLength(1)
    const item = result[0] as { type: string; content: string }
    expect(item.content).toBe('My content')
  })

  it('converts a number to its string representation', () => {
    const result = normalizeSimpleSectionItems([42])
    expect(result[0]).toBe('42')
  })

  it('returns a separator item when type is separator', () => {
    const result = normalizeSimpleSectionItems([{ type: 'separator' }])
    expect(result[0]).toEqual({ type: 'separator' })
  })
})

// ─── getSimpleSectionContentList ─────────────────────────────────────────────

describe('getSimpleSectionContentList', () => {
  it('extracts string content from an array of strings', () => {
    const result = getSimpleSectionContentList(['Objectif A', 'Objectif B'])
    expect(result).toEqual(['Objectif A', 'Objectif B'])
  })

  it('ignores items without text content (separators, empty objects)', () => {
    const input = ['Real item', { type: 'separator' }, { type: 'empty' }]
    const result = getSimpleSectionContentList(input as never)
    expect(result).toEqual(['Real item'])
  })

  it('returns empty array for undefined input', () => {
    expect(getSimpleSectionContentList(undefined)).toEqual([])
  })

  it('extracts content from object items with a content property', () => {
    const input = [{ type: 'objective', id: 'obj-1', content: 'Stopper la propagation' }]
    const result = getSimpleSectionContentList(input as never)
    expect(result).toEqual(['Stopper la propagation'])
  })
})

// ─── getSimpleSectionText ─────────────────────────────────────────────────────

describe('getSimpleSectionText', () => {
  it('joins multiple items with newlines', () => {
    const result = getSimpleSectionText(['Ligne 1', 'Ligne 2', 'Ligne 3'])
    expect(result).toBe('Ligne 1\nLigne 2\nLigne 3')
  })

  it('returns a single string as-is', () => {
    const result = getSimpleSectionText('Situation normale.')
    expect(result).toBe('Situation normale.')
  })

  it('returns empty string for empty/undefined input', () => {
    expect(getSimpleSectionText(undefined)).toBe('')
    expect(getSimpleSectionText([])).toBe('')
  })
})

// ─── parseOrdreInitial ────────────────────────────────────────────────────────

describe('parseOrdreInitial', () => {
  it('parses a well-formed SOIEC JSON string', () => {
    const input = JSON.stringify({
      S: 'Feu de résidence',
      O: ['Sauvetage', 'Extinction'],
      I: [{ mission: 'Attaque', moyen: 'FPT' }],
      E: 'Attaque directe',
      C: 'CG sur place',
      A: [],
      L: [],
    })
    const result = parseOrdreInitial(input)
    expect(result.S).toBe('Feu de résidence')
    expect(Array.isArray(result.O)).toBe(true)
    expect(Array.isArray(result.I)).toBe(true)
    expect((result.I[0] as { mission: string }).mission).toBe('Attaque')
  })

  it('returns a fallback object when the JSON is invalid', () => {
    const result = parseOrdreInitial('not valid json {{')
    expect(result.S).toBe('Erreur de lecture de la réponse IA')
    expect(result.E).toBe('not valid json {{')
  })

  it('strips markdown code fences before parsing', () => {
    const input = '```json\n{"S":"Situation","O":[],"I":[],"E":"","C":"","A":[],"L":[]}\n```'
    const result = parseOrdreInitial(input)
    expect(result.S).toBe('Situation')
  })

  it('uses alternative field names (Situation, Objectifs, etc.)', () => {
    const input = JSON.stringify({
      Situation: 'Accident de voie publique',
      Objectifs: ['Bilan victime'],
      IM: [],
      Execution: 'Prise en charge VSAV',
      Commandement: 'CG',
      Anticipation: [],
      Logistique: [],
    })
    const result = parseOrdreInitial(input)
    expect(result.S).toBe('Accident de voie publique')
  })

  it('falls back to default S when S field is missing', () => {
    const input = JSON.stringify({ O: [], I: [], E: '', C: '', A: [], L: [] })
    const result = parseOrdreInitial(input)
    expect(result.S).toBe('Situation non renseignée')
  })
})

// ─── formatSoiecList ──────────────────────────────────────────────────────────

describe('formatSoiecList', () => {
  it('formats items as a numbered list', () => {
    const result = formatSoiecList(['Objectif A', 'Objectif B'])
    expect(result).toBe('1. Objectif A\n2. Objectif B')
  })

  it('returns "-" for an empty list', () => {
    expect(formatSoiecList([])).toBe('-')
  })

  it('returns "-" for undefined input', () => {
    expect(formatSoiecList(undefined)).toBe('-')
  })
})

// ─── formatIdeeManoeuvreList ──────────────────────────────────────────────────

describe('formatIdeeManoeuvreList', () => {
  it('formats ideas as numbered entries with mission and moyen', () => {
    const ideas = [{ mission: 'Attaque', moyen: 'FPT' }]
    const result = formatIdeeManoeuvreList(ideas)
    expect(result).toBe('1. Attaque (FPT)')
  })

  it('returns "-" for an empty array', () => {
    expect(formatIdeeManoeuvreList([])).toBe('-')
  })

  it('omits separator and empty type items from output', () => {
    const ideas = [
      { mission: 'Attaque', moyen: 'FPT' },
      { mission: '', moyen: '', type: 'separator' as const },
    ]
    const result = formatIdeeManoeuvreList(ideas)
    expect(result).not.toContain('separator')
    expect(result).toContain('Attaque')
  })

  it('includes moyen_supp and details when present', () => {
    const ideas = [{ mission: 'Mission', moyen: 'FPT', moyen_supp: 'VSAV', details: 'Côté est' }]
    const result = formatIdeeManoeuvreList(ideas)
    expect(result).toContain('+ VSAV')
    expect(result).toContain('— Côté est')
  })
})

// ─── formatExecutionValue ─────────────────────────────────────────────────────

describe('formatExecutionValue', () => {
  it('returns a plain string as-is', () => {
    expect(formatExecutionValue('Attaque directe')).toBe('Attaque directe')
  })

  it('returns "-" for falsy input', () => {
    expect(formatExecutionValue('')).toBe('-')
  })

  it('formats an array of execution objects as numbered entries', () => {
    const value = [{ mission: 'Etablissement', moyen: 'FPT-1' }]
    const result = formatExecutionValue(value)
    expect(result).toContain('Etablissement')
    expect(result).toContain('FPT-1')
  })

  it('returns "-" for an array containing only separator/empty items', () => {
    const value = [{ type: 'separator' }, { type: 'empty' }]
    const result = formatExecutionValue(value as never)
    expect(result).toBe('-')
  })
})

// ─── buildMessageDemandesSummary ──────────────────────────────────────────────

describe('buildMessageDemandesSummary', () => {
  const options: MessageSummaryOption[] = [
    { id: 'secours', label: 'Secours à victime' },
    { id: 'incendie', label: 'Incendie' },
  ]

  it('returns selected option labels based on a selections map', () => {
    const result = buildMessageDemandesSummary(
      { selections: { secours: true, incendie: false } },
      options
    )
    expect(result).toContain('Secours à victime')
    expect(result).not.toContain('Incendie')
  })

  it('returns empty array when no selections match', () => {
    const result = buildMessageDemandesSummary({ selections: {} }, options)
    expect(result).toEqual([])
  })

  it('returns empty array for non-object input', () => {
    expect(buildMessageDemandesSummary(null, options)).toEqual([])
    expect(buildMessageDemandesSummary('string', options)).toEqual([])
  })

  it('includes moyensSp fields in the summary', () => {
    const result = buildMessageDemandesSummary(
      { selections: {}, moyensSpFpt: '2', moyensSpVsav: '1' },
      options
    )
    expect(result.some((s) => s.includes('FPT 2'))).toBe(true)
    expect(result.some((s) => s.includes('VSAV 1'))).toBe(true)
  })
})

// ─── buildMessageSurLesLieuxSummary ──────────────────────────────────────────

describe('buildMessageSurLesLieuxSummary', () => {
  const options: MessageSummaryOption[] = [
    { id: 'feuEteint', label: 'Feu éteint' },
    { id: 'victime', label: 'Victime prise en charge' },
  ]

  it('includes labels for selected non-feuEteint options', () => {
    const result = buildMessageSurLesLieuxSummary(
      { selections: { victime: true, feuEteint: false } },
      options
    )
    expect(result).toContain('Victime prise en charge')
    expect(result).not.toContain('Feu éteint')
  })

  it('appends feuEteint with time when feuEteint is selected and heure provided', () => {
    const result = buildMessageSurLesLieuxSummary(
      { selections: { feuEteint: true }, feuEteintHeure: '14:32' },
      options
    )
    expect(result.some((s) => s.includes('Feu éteint') && s.includes('14:32'))).toBe(true)
  })

  it('includes feuEteint label without time when heure is missing', () => {
    const result = buildMessageSurLesLieuxSummary(
      { selections: { feuEteint: true } },
      options
    )
    expect(result).toContain('Feu éteint')
  })
})
