import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../contexts/ProfileContext';
import { normalizeEmploymentLevel, type EmploymentLevel } from '../constants/profile';

const COMMAND_TYPE_BY_EMPLOYMENT_LEVEL: Record<EmploymentLevel, 'group' | 'column' | 'site'> = {
  chef_de_groupe: 'group',
  chef_de_colonne: 'column',
  chef_de_site: 'site'
};

const OperationalFunctions: React.FC = () => {
  const navigate = useNavigate();
  const { profile, loading, error } = useProfile();
  const employmentLevel = normalizeEmploymentLevel(profile?.employment_level);
  const commandType = employmentLevel ? COMMAND_TYPE_BY_EMPLOYMENT_LEVEL[employmentLevel] : null;

  React.useEffect(() => {
    if (loading || !profile) return;
    navigate(commandType ? `/command-type/${commandType}` : '/onboarding', { replace: true });
  }, [commandType, loading, navigate, profile]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 text-slate-900 dark:text-white">
      <div className="text-center space-y-3">
        <div className="animate-pulse text-xl font-semibold">Ouverture des fonctions opérationnelles...</div>
        <div className="text-sm text-slate-600 dark:text-gray-400">
          {error || 'Chargement du niveau d’emploi enregistré'}
        </div>
      </div>
    </div>
  );
};

export default OperationalFunctions;
