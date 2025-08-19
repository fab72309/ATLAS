import React from 'react';
import { useNavigate } from 'react-router-dom';
 
import RoleBadgeIcon from '../components/RoleBadgeIcon';
import SupplyHydrantIcon from '../components/SupplyHydrantIcon';

const topRoles: Array<{ key: 'group' | 'column' | 'site'; label: string }> = [
  { key: 'group', label: 'Chef de groupe' },
  { key: 'column', label: 'Chef de colonne' },
  { key: 'site', label: 'Chef de site' },
];

const bottomRoles: Array<{ key: 'security' | 'supply'; label: string }> = [
  { key: 'security', label: 'Officier sécurité' },
  { key: 'supply', label: 'Officier alimentation' },
];

const OperationalFunctions: React.FC = () => {
  const navigate = useNavigate();

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
        <div className="flex flex-col items-center">
          <h1 className="text-xl md:text-2xl font-bold text-white mb-0.5">A.T.L.A.S</h1>
          <p className="text-white text-center text-sm mb-4">Aide Tactique et Logique pour l'Action des Secours</p>
        </div>

        <div className="w-full max-w-5xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 mb-4">
            {topRoles.map((r) => (
              <button key={r.key} onClick={() => navigate(`/command-type/${r.key}`)} className="bg-[#1A1A1A] hover:bg-[#2A2A2A] transition-colors text-white p-4 rounded-2xl border-2 border-white flex flex-col items-center justify-center gap-2 min-h-[116px]">
                <div className="w-16 h-12 bg-black rounded-lg flex items-center justify-center">
                  {r.key === 'group' && <RoleBadgeIcon role="group" className="w-12 h-12" />}
                  {r.key === 'column' && <RoleBadgeIcon role="column" className="w-12 h-12" />}
                  {r.key === 'site' && <RoleBadgeIcon role="site" className="w-12 h-12" />}
                </div>
                <div className="text-center text-sm md:text-base font-medium">{r.label}</div>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {bottomRoles.map((r) => (
              <button key={r.key} onClick={() => navigate(`/command-type/${r.key}`)} className="bg-[#1A1A1A] hover:bg-[#2A2A2A] transition-colors text-white p-4 rounded-2xl border-2 border-white flex flex-col items-center justify-center gap-2 min-h-[116px]">
                <div className="w-16 h-12 bg-black rounded-lg flex items-center justify-center">
                    {r.key === 'security' && (
                      <img src="/icons/Officier_securite.png" srcSet="/icons/Officier_securite@2x.png 2x, /icons/Officier_securite@3x.png 3x" alt="Officier sécurité" className="w-10 h-10 object-contain" onError={(e)=>{(e.currentTarget as HTMLImageElement).style.display='none'; const p=(e.currentTarget.parentElement as HTMLElement); if(p){p.innerHTML='<div style=\'display:grid;grid-template-columns:repeat(4,1fr);gap:2px;width:40px;height:40px\'>'+Array.from({length:16}).map((_,i)=>`<div style=\"width:100%;height:100%;background:${(i+Math.floor(i/4))%2===0?'#FF3D00':'#B2FF59'}\"></div>`).join('')+'</div>';}}} />
                    )}
                    {r.key === 'supply' && (
                      <img src="/icons/Officier_alimentation.png" srcSet="/icons/Officier_alimentation@2x.png 2x, /icons/Officier_alimentation@3x.png 3x" alt="Officier alimentation" className="w-10 h-10 object-contain" onError={(e)=>{(e.currentTarget as HTMLImageElement).style.display='none'; const p=(e.currentTarget.parentElement as HTMLElement); if(p){p.innerHTML=''; const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'); svg.setAttribute('viewBox','0 0 24 24'); svg.setAttribute('width','24'); svg.setAttribute('height','24'); svg.innerHTML='<g fill=\"none\" stroke=\"#fff\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M8 4h8\" /><path d=\"M7 7a5 5 0 0 1 10 0v2H7V7Z\" /><rect x=\"7\" y=\"9\" width=\"10\" height=\"8\" rx=\"2\" /><circle cx=\"12\" cy=\"13\" r=\"2.5\" /><path d=\"M4 13h3M17 13h3\" /><path d=\"M6 19h12v2H6z\" /></g>'; p.appendChild(svg);}}} />
                    )}
                  </div>
                <div className="text-center text-sm md:text-base font-medium">{r.label}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OperationalFunctions;


