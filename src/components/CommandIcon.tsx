import React from 'react';
import { Radio } from 'lucide-react';

interface CommandIconProps {
  type: 'group' | 'column' | 'communication';
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
          <>
            <div className="w-20 h-3.5 bg-white mb-2"></div>
            <div className="w-20 h-3.5 bg-white mb-2"></div>
            <div className="w-20 h-3.5 bg-white"></div>
          </>
        )}
      </div>
      <h2 className="text-lg text-white text-center mt-2">
        {type === 'group' ? 'Chef de groupe' : 
         type === 'column' ? 'Chef de colonne' : 
         'Communication OPS'}
      </h2>
    </div>
  );
};

export default CommandIcon;