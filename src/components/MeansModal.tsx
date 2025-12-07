import React from 'react';
import { X } from 'lucide-react';
import { DOCTRINE_CONTEXT } from '../constants/doctrine';

type Status = 'sur_place' | 'demande';

export interface MeanItem {
  name: string;
  status: Status;
  category?: string;
}

interface MeansModalProps {
  isOpen: boolean;
  onClose: () => void;
  selected: MeanItem[];
  onChange: (items: MeanItem[]) => void;
}

const CATEGORIES: Record<string, { label: string; key: keyof typeof DOCTRINE_CONTEXT; color: string; statusClass: string; dashedClass: string }> = {
  incendie: { label: 'Incendie', key: 'incendie_structure', color: 'border-red-500/60 bg-red-500/10 text-red-200', statusClass: 'outline-red-400', dashedClass: 'border-red-400/80' },
  suap: { label: 'SUAP', key: 'secours_personne_complexe', color: 'border-green-500/60 bg-green-500/10 text-green-200', statusClass: 'outline-green-400', dashedClass: 'border-green-400/80' },
  speciaux: { label: 'Engins spéciaux', key: 'fuite_gaz', color: 'border-orange-400/60 bg-orange-500/10 text-orange-200', statusClass: 'outline-orange-400', dashedClass: 'border-orange-400/80' },
  commandement: { label: 'Commandement', key: 'secours_personne_complexe', color: 'border-purple-500/60 bg-purple-500/10 text-purple-200', statusClass: 'outline-purple-400', dashedClass: 'border-purple-400/80' },
};

const MeansModal: React.FC<MeansModalProps> = ({ isOpen, onClose, selected, onChange }) => {
  const meansList = React.useMemo(() => {
    const data: { name: string; category: string }[] = [];
    Object.entries(CATEGORIES).forEach(([catKey, meta]) => {
      const ctx = (DOCTRINE_CONTEXT as any)[meta.key];
      const moyens = ctx?.moyens_standards_td || [];
      moyens.forEach((m: string) => {
        const title = m.split(':')[0].trim();
        data.push({ name: title, category: catKey });
      });
    });
    return data;
  }, []);

  const addOrToggle = (item: { name: string; category?: string }) => {
    const exists = selected.find((s) => s.name === item.name);
    if (exists) return;
    onChange([...selected, { name: item.name, status: 'sur_place', category: item.category }]);
  };

  const remove = (name: string) => {
    onChange(selected.filter((s) => s.name !== name));
  };

  const toggleStatus = (name: string) => {
    onChange(
      selected.map((s) =>
        s.name === name
          ? { ...s, status: s.status === 'sur_place' ? 'demande' : 'sur_place' }
          : s
      )
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#0f121a] border border-white/10 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white">Ajouter des moyens</h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex flex-1 overflow-hidden">
          <div className="w-1/2 border-r border-white/10 p-4 space-y-3 overflow-y-auto">
            <h4 className="text-sm text-gray-400">Sélection</h4>
            {selected.length === 0 && <div className="text-gray-500 text-sm">Aucun moyen sélectionné.</div>}
            <div className="space-y-2">
              {selected.map((s) => {
                const colorMeta = CATEGORIES[s.category || ''] || { statusClass: 'outline-white/30', color: 'border-white/20 bg-white/5 text-white', dashedClass: 'border-yellow-400/80' };
                const isRequested = s.status === 'demande';
                return (
                  <div
                    key={s.name}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg border-2 ${isRequested ? `border-dashed ${colorMeta.dashedClass || 'border-yellow-400/80'}` : colorMeta.color || 'border-white/20'} ${colorMeta.color?.replace('border', 'bg') || 'bg-white/5'}`}
                  >
                    <div className="text-sm text-gray-100">{s.name}</div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleStatus(s.name)}
                        className={`px-2 py-1 text-xs rounded ${isRequested ? 'bg-white/10 text-yellow-300' : 'bg-white/10 text-green-300'} ${colorMeta.statusClass}`}
                      >
                        {isRequested ? 'Demandé' : 'Sur place'}
                      </button>
                      <button onClick={() => remove(s.name)} className="text-xs text-red-400 hover:text-red-300">Retirer</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="w-1/2 p-4 space-y-4 overflow-y-auto">
            {Object.entries(CATEGORIES).map(([catKey, meta]) => {
              const ctx = (DOCTRINE_CONTEXT as any)[meta.key];
              const moyens = ctx?.moyens_standards_td || [];
              if (!moyens.length) return null;
              return (
                <div key={catKey}>
                  <div className={`text-xs font-semibold mb-2 inline-block px-2 py-1 rounded ${meta.color}`}>
                    {meta.label}
                  </div>
                  <div className="flex flex-col gap-2">
                    {moyens.map((m: string) => {
                      const title = m.split(':')[0].trim();
                      const already = selected.find((s) => s.name === title);
                      const isRequested = already?.status === 'demande';
                      return (
                        <button
                          key={title}
                          onClick={() => addOrToggle({ name: title, category: catKey })}
                          className={`w-full text-left px-3 py-2 rounded-lg border-2 ${already ? `border-dashed ${meta.dashedClass}` : 'border-white/20'} ${meta.color} hover:bg-white/10 transition`}
                        >
                          <div className="text-sm">{title}</div>
                          {already && <div className="text-[11px] text-gray-300">{isRequested ? 'Demandé' : 'Sur place'}</div>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeansModal;
