import type { SymbolAsset, SITACFeatureProperties } from '../types/sitac';
import { SYMBOL_ASSETS } from './sitacLayers';

const KNOWN_TYPES = new Set<SITACFeatureProperties['type']>([
  'symbol',
  'line',
  'arrow',
  'polygon',
  'text',
  'freehand',
  'circle',
  'rect'
]);

const SYMBOL_ASSET_BY_ID = new Map<string, SymbolAsset>();
const SYMBOL_ASSET_BY_FILE = new Map<string, SymbolAsset>();

SYMBOL_ASSETS.forEach((asset) => {
  SYMBOL_ASSET_BY_ID.set(asset.id, asset);
  const file = asset.url.split('/').pop();
  if (file) SYMBOL_ASSET_BY_FILE.set(file, asset);
});

const getFileKey = (url?: string) => {
  if (!url) return null;
  const file = url.split('/').pop();
  if (!file) return null;
  const stripped = file.split('?')[0].split('#')[0];
  return stripped || null;
};

const resolveSymbolAsset = (iconName?: string, url?: string) => {
  if (iconName && SYMBOL_ASSET_BY_ID.has(iconName)) {
    return SYMBOL_ASSET_BY_ID.get(iconName) ?? null;
  }
  const fileKey = getFileKey(url);
  if (fileKey && SYMBOL_ASSET_BY_FILE.has(fileKey)) {
    return SYMBOL_ASSET_BY_FILE.get(fileKey) ?? null;
  }
  return null;
};

const normalizeSymbolType = (rawType?: string) => {
  const typeValue = rawType || 'symbol';
  if (KNOWN_TYPES.has(typeValue as SITACFeatureProperties['type'])) {
    return { type: typeValue as SITACFeatureProperties['type'], iconName: undefined };
  }
  const cleaned = typeValue.replace(/^(ICON_|SYMBOL_)/i, '');
  return { type: 'symbol' as const, iconName: cleaned || typeValue };
};

const cleanProps = (value: Record<string, unknown>) => {
  const cleaned: Record<string, unknown> = {};
  Object.entries(value).forEach(([key, entry]) => {
    if (entry !== undefined) cleaned[key] = entry;
  });
  return cleaned;
};

export const normalizeSymbolProps = (
  rawType: string | undefined,
  rawProps: Record<string, unknown>
) => {
  const { type, iconName: iconFromType } = normalizeSymbolType(rawType);
  const { type: _type, id: _id, ...rest } = rawProps;
  const props = cleanProps(rest);

  if (type !== 'symbol') {
    return { type, props };
  }

  const iconNameFromProps = typeof props.iconName === 'string' ? props.iconName : undefined;
  const urlFromProps = typeof props.url === 'string' ? props.url : undefined;
  const iconName = iconNameFromProps ?? iconFromType;
  const asset = resolveSymbolAsset(iconName, urlFromProps);

  if (asset) {
    props.iconName = iconName ?? asset.id;
    props.url = asset.url;
    if (typeof props.colorizable !== 'boolean' && typeof asset.colorizable === 'boolean') {
      props.colorizable = asset.colorizable;
    }
  } else if (iconName) {
    props.iconName = iconName;
  }

  return { type, props };
};
