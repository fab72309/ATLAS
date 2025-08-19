import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import CommandIcon from '../components/CommandIcon';

const COMMAND_TITLES = {
  group: 'Chef de groupe',
  column: 'Chef de colonne',
  site: 'Chef de site',
  communication: 'Communication OPS'
} as const;

const CommandTypeChoice = () => {
  const navigate = useNavigate();
  const { type } = useParams();
  const validTypes = ['group','column','site','communication'] as const;
  const currentType = validTypes.includes(type as any) ? (type as typeof validTypes[number]) : null;

  return (
    <div className="min-h-screen flex flex-col">
      <div className="p-4">
        <button 
          onClick={() => navigate('/')}
          className="bg-[#FF1801] hover:bg-[#D91601] transition-colors text-white px-4 py-2 rounded-3xl"
        >
          Accueil
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center px-4 py-4">
        <div className="flex flex-col items-center">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-1">
            A.T.L.A.S
          </h1>
          <p className="text-white text-center mb-4">
          Aide Tactique et Logique pour l'Action des Secours
          </p>
        </div>

        {currentType ? (
          <div className="w-full max-w-[200px] mb-4">
            <CommandIcon type={currentType} />
          </div>
        ) : (
          <div className="text-white bg-red-500/20 border border-red-500/40 rounded p-3 mb-4 text-sm">
            Type non supporté. Revenez à l'accueil.
          </div>
        )}

        <div className="w-full max-w-xl space-y-4">
          <button
            onClick={() => navigate(`/situation/${type}/dictate`)}
            className="w-full bg-[#1A1A1A] hover:bg-[#2A2A2A] transition-colors text-white p-4 rounded-2xl border-2 border-white"
          >
            <h2 className="text-2xl mb-2">
              {type === 'communication' ? 'Dicter un Point de Situation' : 'Dicter un Ordre Initial'}
            </h2>
            <p className="text-gray-400">
              {type === 'communication' 
                ? 'Utilisez la reconnaissance vocale pour dicter votre point de situation'
                : 'Utilisez la reconnaissance vocale pour dicter votre ordre initial'}
            </p>
          </button>

          <button
            onClick={() => navigate(`/situation/${type}/ai`)}
            className="w-full bg-[#1A1A1A] hover:bg-[#2A2A2A] transition-colors text-white p-6 rounded-3xl border-2 border-white"
          >
            <h2 className="text-2xl mb-2 flex items-center justify-center gap-2"> 
              {type === 'communication' ? 'Point de Situation' : 'Ordre Initial'} par Assistant IA
              <Sparkles className="w-6 h-6 text-white" />
            </h2>
            <p className="text-gray-400">
              {type === 'communication'
                ? 'Laissez l\'IA vous aider à structurer votre point de situation'
                : 'Laissez l\'IA vous aider à structurer votre ordre initial'}
            </p>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CommandTypeChoice;