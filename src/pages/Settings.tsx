import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FavoriteKey, getFavorites, setFavorites, NAV_ITEMS } from '../utils/favorites';

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [favorites, setFav] = React.useState<FavoriteKey[]>(getFavorites());

  const toggle = (key: FavoriteKey) => {
    const exists = favorites.includes(key);
    const next = exists ? favorites.filter((k) => k !== key) : [...favorites, key];
    setFav(next);
    setFavorites(next);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="p-3">
        <button onClick={() => navigate('/')} className="bg-[#FF1801] hover:bg-[#D91601] transition-colors text-white px-3 py-1.5 rounded-xl text-sm">Accueil</button>
      </div>

      <div className="flex-1 max-w-3xl w-full mx-auto p-4 text-white">
        <h1 className="text-xl md:text-2xl font-bold mb-4">Paramètres</h1>

        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Favoris</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {NAV_ITEMS.map((item) => (
              <label key={item.key} className="flex items-center gap-2 bg-white/10 rounded px-2 py-1.5">
                <input type="checkbox" checked={favorites.includes(item.key)} onChange={() => toggle(item.key)} />
                <span>{item.label}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Affichage</h2>
          <p className="text-white/70 text-sm">Les cartes s'adaptent automatiquement à la taille et à l'orientation de l'écran.</p>
        </section>
      </div>
    </div>
  );
};

export default SettingsPage;


