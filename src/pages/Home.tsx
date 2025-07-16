import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, Radio, Map } from 'lucide-react';
import HistoryDialog from '../components/HistoryDialog';

const Home = () => {
  const navigate = useNavigate();
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  return (
    <div className="flex flex-col items-center text-white min-h-screen">
      <div className="w-full p-4 flex justify-end">
        <button
          onClick={() => setIsHistoryOpen(true)}
          className="p-2 hover:bg-[#1A1A1A] rounded-full transition-colors"
        >
          <History className="w-6 h-6" />
        </button>
      </div>

      <div className="flex flex-col items-center mt-2 md:mt-4">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">
          A.T.L.A.S
        </h1>
        <p className="text-white text-center px-4 mb-3 text-sm">
          Aide Tactique et Logique pour l'Action des Secours
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-6xl px-4">
        <div 
          onClick={() => navigate('/command-type/group')}
          className="bg-[#1A1A1A] p-6 md:p-8 rounded-lg cursor-pointer hover:bg-[#2A2A2A] transition-colors border-2 border-white"
        >
          <div className="flex justify-center mb-4">
            <div className="w-20 md:w-24 h-20 md:h-24 bg-black rounded-lg flex flex-col justify-center items-center">
              <div className="w-12 md:w-16 h-3 bg-white mb-2"></div>
              <div className="w-12 md:w-16 h-3 bg-white"></div>
            </div>
          </div>
          <h2 className="text-xl md:text-2xl text-center">Chef de groupe</h2>
        </div>
        
        <div 
          onClick={() => navigate('/command-type/column')}
          className="bg-[#1A1A1A] p-6 md:p-8 rounded-lg cursor-pointer hover:bg-[#2A2A2A] transition-colors border-2 border-white"
        >
          <div className="flex justify-center mb-4">
            <div className="w-20 md:w-24 h-20 md:h-24 bg-black rounded-lg flex flex-col justify-center items-center">
              <div className="w-12 md:w-16 h-3 bg-white mb-2"></div>
              <div className="w-12 md:w-16 h-3 bg-white mb-2"></div>
              <div className="w-12 md:w-16 h-3 bg-white"></div>
            </div>
          </div>
          <h2 className="text-xl md:text-2xl text-center">Chef de colonne</h2>
        </div>

        <div 
          onClick={() => navigate('/command-type/communication')}
          className="bg-[#1A1A1A] p-6 md:p-8 rounded-lg cursor-pointer hover:bg-[#2A2A2A] transition-colors border-2 border-white"
        >
          <div className="flex justify-center mb-4">
            <div className="w-20 md:w-24 h-20 md:h-24 bg-black rounded-lg flex flex-col justify-center items-center">
              <Radio className="w-12 md:w-16 h-12 md:h-16 text-white" />
            </div>
          </div>
          <h2 className="text-xl md:text-2xl text-center">Communication OPS</h2>
        </div>

        <div 
          onClick={() => navigate('/operational-zoning')}
          className="bg-[#1A1A1A] p-6 md:p-8 rounded-lg cursor-pointer hover:bg-[#2A2A2A] transition-colors border-2 border-white"
        >
          <div className="flex justify-center mb-4">
            <div className="w-20 md:w-24 h-20 md:h-24 bg-black rounded-lg flex flex-col justify-center items-center">
              <Map className="w-12 md:w-16 h-12 md:h-16 text-white" />
            </div>
          </div>
          <h2 className="text-xl md:text-2xl text-center">Zonage opérationnel</h2>
        </div>
      </div>

      <HistoryDialog isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />
    </div>
  );
}

export default Home;