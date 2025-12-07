import React from 'react';
import { getDominantesOrder, DEFAULT_DOMINANTES } from '../utils/dominantes';

export type DominanteType = typeof DEFAULT_DOMINANTES[number];

interface DominantSelectorProps {
  selectedRisks: DominanteType[];
  onChange: (risks: DominanteType[]) => void;
  className?: string;
}

const useDominantes = () => {
  const [order, setOrder] = React.useState(getDominantesOrder());
  React.useEffect(() => {
    const handler = () => setOrder(getDominantesOrder());
    window.addEventListener('storage', handler);
    window.addEventListener('atlas:dominantes-order-changed', handler as any);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('atlas:dominantes-order-changed', handler as any);
    };
  }, []);
  return order;
};

const DominantSelector: React.FC<DominantSelectorProps> = ({ selectedRisks, onChange, className }) => {
  const order = useDominantes();

  const handleSelect = (opt: DominanteType) => {
    if (selectedRisks.includes(opt)) {
      // Si déjà sélectionné, on le retire
      onChange(selectedRisks.filter(r => r !== opt));
    } else {
      // Sinon on l'ajoute à la fin
      onChange([...selectedRisks, opt]);
    }
  };

  return (
    <div className={`w-full flex justify-center ${className ?? ''}`}>
      <div className="inline-flex flex-wrap justify-center items-stretch gap-2 border-2 border-red-500 rounded-3xl px-3 py-2 bg-black/20 max-w-full">
        {order.map((opt) => {
          const index = selectedRisks.indexOf(opt);
          const isSelected = index !== -1;

          return (
            <button
              key={opt}
              type="button"
              onClick={() => handleSelect(opt)}
              className={
                `relative px-4 py-1.5 rounded-3xl text-sm font-semibold transition-all duration-200 ` +
                (isSelected
                  ? 'bg-orange-500 text-white shadow-lg scale-105'
                  : 'bg-gray-300 text-gray-800 hover:bg-gray-200')
              }
              aria-pressed={isSelected}
            >
              {opt}
              {isSelected && (
                <span className="absolute -top-2 -right-2 w-5 h-5 bg-white text-orange-600 rounded-full flex items-center justify-center text-xs font-bold shadow-sm border border-orange-200">
                  {index + 1}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default DominantSelector;
