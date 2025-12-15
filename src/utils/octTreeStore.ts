import { useSyncExternalStore } from 'react';

export type OctNodeType = 'codis' | 'cos' | 'sector' | 'subsector' | 'engine';
export type OctColor = 'red' | 'green' | 'orange' | 'blue' | 'violet';

export interface OctTreeNode {
  id: string;
  type: OctNodeType;
  label: string;
  frequencies?: string[];
  notes?: string;
  color?: OctColor;
  chief?: string;
  meanSource?: string;
  meanRef?: string;
  meanStatus?: 'sur_place' | 'demande';
  meanCategory?: string;
  children: OctTreeNode[];
}

export const OCT_STORAGE_KEY = 'atlas-oct-tree';

const BASE_TREE: OctTreeNode = {
  id: 'root',
  type: 'codis',
  label: 'CODIS',
  frequencies: ['218', '270'],
  children: [
    {
      id: 'node-air',
      type: 'sector',
      label: 'AIR / SOL',
      frequencies: [],
      color: 'blue',
      chief: '',
      children: []
    },
    {
      id: 'node-crm',
      type: 'sector',
      label: 'CRM',
      frequencies: [],
      color: 'violet',
      chief: '',
      children: []
    },
    {
      id: 'node-2',
      type: 'cos',
      label: 'COS',
      frequencies: ['230'],
      notes: undefined,
      children: [
        {
          id: 'node-3',
          type: 'sector',
          label: 'SECTEUR 1',
          frequencies: ['250'],
          color: 'red',
          chief: '',
          children: []
        },
        {
          id: 'node-4',
          type: 'sector',
          label: 'SECTEUR 2',
          frequencies: ['260'],
          color: 'green',
          chief: '',
          children: []
        }
      ]
    }
  ]
};

const cloneTree = (tree: OctTreeNode): OctTreeNode => JSON.parse(JSON.stringify(tree));

export const createInitialOctTree = (): OctTreeNode => cloneTree(BASE_TREE);

let currentTree: OctTreeNode = createInitialOctTree();

const listeners = new Set<() => void>();

const persistTree = (tree: OctTreeNode) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(OCT_STORAGE_KEY, JSON.stringify(tree));
  } catch (err) {
    console.error('OCT storage write error', err);
  }
};

const notify = () => listeners.forEach((l) => l());

const loadFromStorage = (): OctTreeNode => {
  if (typeof window === 'undefined') return createInitialOctTree();
  try {
    const raw = localStorage.getItem(OCT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.id) return parsed;
    }
  } catch (err) {
    console.error('OCT storage read error', err);
  }
  return createInitialOctTree();
};

currentTree = loadFromStorage();

export const getOctTree = (): OctTreeNode => currentTree;

export const subscribeOctTree = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const setOctTree = (updater: OctTreeNode | ((prev: OctTreeNode) => OctTreeNode)) => {
  const next = typeof updater === 'function' ? (updater as (prev: OctTreeNode) => OctTreeNode)(currentTree) : updater;
  currentTree = next;
  persistTree(currentTree);
  notify();
};

export const resetOctTree = () => setOctTree(createInitialOctTree());

export const useOctTree = () => {
  const tree = useSyncExternalStore(subscribeOctTree, getOctTree, getOctTree);
  return { tree, setTree: setOctTree };
};

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== OCT_STORAGE_KEY) return;
    try {
      const parsed = event.newValue ? JSON.parse(event.newValue) : createInitialOctTree();
      currentTree = parsed?.id ? parsed : createInitialOctTree();
      notify();
    } catch (err) {
      console.error('OCT storage sync error', err);
    }
  });
}
