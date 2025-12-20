import React from 'react';
import { getDominantesOrder, DEFAULT_DOMINANTES } from '../utils/dominantes';

export type DominanteType = typeof DEFAULT_DOMINANTES[number];

interface DominantSelectorProps {
  selectedRisks: DominanteType[];
  onChange: (risks: DominanteType[]) => void;
  className?: string;
  disabled?: boolean;
}

const useDominantes = () => {
  const [order, setOrder] = React.useState(getDominantesOrder());
  React.useEffect(() => {
    const handler = () => setOrder(getDominantesOrder());
    window.addEventListener('storage', handler);
    window.addEventListener('atlas:dominantes-order-changed', handler as EventListener);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('atlas:dominantes-order-changed', handler as EventListener);
    };
  }, []);
  return order;
};

const DominantSelector: React.FC<DominantSelectorProps> = ({ selectedRisks, onChange, className, disabled = false }) => {
  const order = useDominantes();

  const handleSelect = (opt: DominanteType) => {
    if (disabled) return;
    if (selectedRisks.includes(opt)) {
      // Si déjà sélectionné, on le retire
      onChange(selectedRisks.filter(r => r !== opt));
    } else {
      // Sinon on l'ajoute à la fin
      onChange([...selectedRisks, opt]);
    }
  };

  const containerClass = className
    ? `w-full flex ${className}`
    : 'w-full flex justify-center';

  return (
    <div className={containerClass}>
      <div className="inline-flex flex-wrap justify-center items-stretch gap-2 border border-red-400/60 dark:border-red-500/50 rounded-3xl px-3 py-2 bg-white/70 dark:bg-black/20 shadow-sm dark:shadow-none backdrop-blur-sm max-w-full">
        {order.map((opt) => {
          const index = selectedRisks.indexOf(opt);
          const isSelected = index !== -1;

          return (
            <button
              key={opt}
              type="button"
              disabled={disabled}
              onClick={() => handleSelect(opt)}
              className={
                `relative px-4 py-1.5 rounded-3xl text-sm font-semibold transition-all duration-200 border disabled:opacity-60 disabled:cursor-not-allowed ` +
                (isSelected
                  ? 'bg-orange-500 text-white border-orange-300 shadow-md scale-[1.02] dark:bg-orange-500 dark:text-white dark:border-orange-400/70'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-gray-800/70 dark:text-gray-200 dark:border-white/10 dark:hover:bg-gray-700/70')
              }
              aria-pressed={isSelected}
              aria-disabled={disabled}
            >
              {opt}
              {isSelected && (
                <span className="absolute -top-2 -right-2 w-5 h-5 bg-white text-orange-600 rounded-full flex items-center justify-center text-xs font-bold shadow-sm border border-orange-200 dark:bg-slate-900 dark:text-orange-300 dark:border-orange-500/60">
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
