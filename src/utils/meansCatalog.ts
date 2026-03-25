import {
  MEANS_DOCTRINE_CATEGORY_ORDER,
  MEANS_DOCTRINE_LABELS,
  MEANS_DOCTRINE_STANDARD
} from '../constants/meansDoctrine';
import type { MeansCategoryKey } from './sessionSettings';

export type MeansCatalogEntry = {
  name: string;
  category: MeansCategoryKey;
  fullName?: string;
  capabilities?: string;
  isGroup?: boolean;
};

export type MeansDoctrineCategory = {
  key: string;
  label: string;
};

const GROUP_HEADER_PATTERN = /groupes?\s+constitués?/i;

const normalizeText = (value: string) => value.trim().replace(/\s+/g, ' ');

export const isDoctrineGroupHeader = (value: string) => GROUP_HEADER_PATTERN.test(normalizeText(value));

export const inferIsGroup = (label: string) => {
  const normalized = normalizeText(label);
  return /^G\./i.test(normalized) || /\b(groupement|giff)\b/i.test(normalized);
};

export const parseDoctrineMean = (
  raw: string,
  category: MeansCategoryKey,
  forcedGroup = false
): MeansCatalogEntry | null => {
  const normalized = normalizeText(raw);
  if (!normalized || isDoctrineGroupHeader(normalized)) return null;

  const colonIndex = normalized.indexOf(':');
  const left = colonIndex >= 0 ? normalized.slice(0, colonIndex).trim() : normalized;
  const right = colonIndex >= 0 ? normalized.slice(colonIndex + 1).trim() : '';

  const match = left.match(/^([^()]+?)\s*\(([^)]+)\)\s*$/);
  const shortName = (match?.[1] ?? left).trim();
  const fullName = (match?.[2] ?? '').trim();

  if (!shortName) return null;

  return {
    name: shortName,
    category,
    fullName: fullName || undefined,
    capabilities: right || undefined,
    isGroup: forcedGroup || inferIsGroup(shortName)
  };
};

export const getDoctrineCategories = (): MeansDoctrineCategory[] => {
  return MEANS_DOCTRINE_CATEGORY_ORDER.map((key) => ({
    key,
    label: MEANS_DOCTRINE_LABELS[key as keyof typeof MEANS_DOCTRINE_LABELS] || key
  }));
};

export const buildDoctrineMeans = (categories?: Array<{ key: MeansCategoryKey }>) => {
  const entries: MeansCatalogEntry[] = [];
  const seen = new Set<string>();
  const doctrineStandard = MEANS_DOCTRINE_STANDARD as Record<string, readonly string[]>;
  const resolvedCategories = categories && categories.length > 0
    ? categories
    : getDoctrineCategories().map((category) => ({ key: category.key }));

  resolvedCategories.forEach((category) => {
    const moyens = doctrineStandard[category.key] || [];
    let inGroupSection = false;
    moyens.forEach((raw: string) => {
      if (isDoctrineGroupHeader(raw)) {
        inGroupSection = true;
        return;
      }
      const parsed = parseDoctrineMean(raw, category.key, inGroupSection);
      if (!parsed) return;
      const dedupeKey = `${parsed.category}:${parsed.name.toLowerCase()}`;
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      entries.push(parsed);
    });
  });

  return entries;
};
