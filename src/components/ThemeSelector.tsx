import React from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { ThemePreference, useTheme } from '../contexts/ThemeContext';

type ThemeSelectorVariant = 'compact' | 'detailed';

const OPTIONS: Array<{
  value: ThemePreference;
  label: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    value: 'light',
    label: 'Clair',
    description: 'Interface lumineuse',
    Icon: Sun,
  },
  {
    value: 'dark',
    label: 'Sombre',
    description: 'Confort visuel reduit',
    Icon: Moon,
  },
  {
    value: 'system',
    label: 'Auto',
    description: 'Suit l\'appareil',
    Icon: Monitor,
  },
];

interface ThemeSelectorProps {
  variant?: ThemeSelectorVariant;
  className?: string;
}

const ThemeSelector: React.FC<ThemeSelectorProps> = ({ variant = 'detailed', className = '' }) => {
  const { theme, setTheme } = useTheme();
  const isCompact = variant === 'compact';

  return (
    <div
      role="radiogroup"
      aria-label="Theme de l'application"
      className={`${isCompact ? 'flex gap-2' : 'grid grid-cols-1 sm:grid-cols-3 gap-3'} ${className}`}
    >
      {OPTIONS.map(({ value, label, description, Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(value)}
            className={`${isCompact ? 'flex-1 px-3 py-2 rounded-xl text-xs' : 'px-4 py-3 rounded-2xl text-left'}
              border transition-all duration-200 flex items-center gap-3
              ${active
              ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-500/20 dark:border-blue-500/40 dark:text-blue-200'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-white/5 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/10'}
            `}
          >
            <Icon className={`${isCompact ? 'w-4 h-4' : 'w-5 h-5'} shrink-0`} />
            <div className="flex-1">
              <div className={`${isCompact ? 'font-semibold' : 'font-semibold text-sm'}`}>{label}</div>
              {!isCompact && (
                <div className="text-xs text-slate-500 dark:text-gray-400">{description}</div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default ThemeSelector;
