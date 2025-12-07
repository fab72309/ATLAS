import React from 'react';
import { Radio } from 'lucide-react';

interface CommandIconProps {
  type: 'group' | 'column' | 'communication' | 'site' | 'security' | 'supply';
}

const CommandIcon: React.FC<CommandIconProps> = ({ type }) => {
  return (
    <div className="bg-[#1A1A1A] rounded-2xl p-4 w-full max-w-[200px] mx-auto border-2 border-white">
      <div className="bg-black rounded-xl aspect-[4/3] flex flex-col justify-center items-center p-4">
        {type === 'communication' ? (
          <Radio className="w-16 h-16 text-white" />
        ) : type === 'group' ? (
          <>
            <div className="w-20 h-3.5 bg-white mb-2"></div>
            <div className="w-20 h-3.5 bg-white"></div>
          </>
        ) : (
          type === 'column' ? (
            <>
              <div className="w-20 h-3.5 bg-white mb-2"></div>
              <div className="w-20 h-3.5 bg-white mb-2"></div>
              <div className="w-20 h-3.5 bg-white"></div>
            </>
          ) : type === 'site' ? (
            <div className="w-20 h-16 border-4 border-black bg-white relative flex flex-col justify-center">
              <div className="h-2 bg-[#222]" />
              <div className="h-4 bg-[#FFE082]" />
              <div className="h-4 bg-[#222]" />
              <div className="h-2 bg-white" />
              <div className="h-2 bg-[#222]" />
              <div className="h-4 bg-[#FFE082]" />
              <div className="h-2 bg-[#222]" />
            </div>
          ) : type === 'security' ? (
            <div className="grid grid-cols-4 grid-rows-4 gap-0.5">
              {Array.from({ length: 16 }).map((_, i) => (
                <div key={i} className={((i + Math.floor(i/4)) % 2 === 0) ? 'w-4 h-4 bg-[#FF3D00]' : 'w-4 h-4 bg-[#B2FF59]'} />
              ))}
            </div>
          ) : (
            <div className="w-16 h-16 rounded-full border-2 border-white flex items-center justify-center">
              <span className="text-white text-sm">Alim</span>
            </div>
          )
        )}
      </div>
      <h2 className="text-lg text-white text-center mt-2">
        {type === 'group' ? 'Chef de groupe' : 
         type === 'column' ? 'Chef de colonne' : 
         type === 'site' ? 'Chef de site' :
         type === 'security' ? 'Officier sécurité' :
         type === 'supply' ? 'Officier alimentation' :
         'Communication OPS'}
      </h2>
    </div>
  );
};

export default CommandIcon;