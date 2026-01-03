import { useNavigate, useParams } from 'react-router-dom';
import CommandIcon from '../components/CommandIcon';

const TacticalInterface = () => {
  const navigate = useNavigate();
  const { type } = useParams();

  return (
    <div className="min-h-screen flex flex-col">
      <div className="p-3">
        <button 
          onClick={() => navigate('/')}
          className="bg-[#FF1801] hover:bg-[#D91601] transition-colors text-white px-3 py-1.5 rounded-xl text-sm"
        >
          Accueil
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center px-4">
        <h1 className="text-xl md:text-2xl font-bold text-white mb-1 text-center">
          A.T.L.A.S
        </h1>
        <p className="text-white text-center mb-4 text-sm">
          Aide Tactique et Logique pour l'Action des Secours
        </p>

        <div className="w-full max-w-[200px] mb-6">
          <CommandIcon type={type as 'group' | 'column'} />
        </div>

        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#1A1A1A] p-6 rounded-lg border-2 border-[#FFD700]">
            <h2 className="text-xl text-white font-bold mb-4">TACT 3/4</h2>
            <div className="space-y-4">
              <div className="bg-[#1A1A1A] p-4 rounded border border-[#FFD700]">
                <p className="text-white">Tactique 3/4 n°1</p>
              </div>
              <div className="bg-[#1A1A1A] p-4 rounded border border-[#FFD700]">
                <p className="text-white">Tactique 3/4 n°2</p>
              </div>
              <div className="bg-[#1A1A1A] p-4 rounded border border-[#FFD700]">
                <p className="text-white">Tactique 3/4 n°3</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#1A1A1A] p-4 rounded border-2 border-[#4A90E2]">
              <p className="text-white text-center">SPE</p>
            </div>
            <div className="bg-[#1A1A1A] p-4 rounded border-2 border-[#9B51E0]">
              <p className="text-white text-center">CODIS 78</p>
            </div>
            <div className="bg-[#1A1A1A] p-4 rounded border-2 border-[#2F80ED]">
              <p className="text-white text-center">SAMU 78</p>
            </div>
            <div className="bg-[#1A1A1A] p-4 rounded border-2 border-[#EB5757]">
              <p className="text-white text-center">Air Sol</p>
            </div>
          </div>
        </div>

        <div className="w-full max-w-4xl grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-[#1A1A1A] p-4 rounded border-2 border-[#FFD700]">
            <p className="text-white text-center">Groupe 1</p>
          </div>
          <div className="bg-[#1A1A1A] p-4 rounded border-2 border-[#FFD700]">
            <p className="text-white text-center">Groupe 2</p>
          </div>
          <div className="bg-[#1A1A1A] p-4 rounded border-2 border-[#FFD700]">
            <p className="text-white text-center">Groupe 3</p>
          </div>
          <div className="bg-[#1A1A1A] p-4 rounded border-2 border-[#FFD700]">
            <p className="text-white text-center">Groupe 4</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TacticalInterface;
