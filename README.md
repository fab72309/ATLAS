# A.T.L.A.S

Aide Tactique et Logique pour l'Action des Secours

**Version courante : Alpha-0.2.5**

## 📱 Fonctionnalités

- Génération de messages opérationnels (Chef de groupe, Chef de colonne, Communication OPS)
- Zonage opérationnel avec cartographie interactive
- Assistance IA (OpenAI) pour structurer l’analyse/ordre initial
- Sauvegarde et historique des opérations
- Export PDF et partage

## 🧭 SOIEC / SAOIECL (notes)

- Objectifs numérotés et IDM numérotées par objectif (ex: 1.1, 1.2, 2.1).
- IDM liées horizontalement à l’objectif via un identifiant (objectif peut avoir plusieurs IDM).
- Les IDM non liées apparaissent dans un groupe "Non lié".
- Dans Exécution, sélection rapide des moyens (secteurs OCT si présents, sinon engins).

## 🚀 Prérequis

- Node.js 18+
- Compte Supabase (Auth + DB)
- Clé API OpenAI (côté serveur)
- Compte GitHub

## 🛠 Installation

1. Cloner le dépôt :
   ```bash
   git clone https://github.com/votre-utilisateur/atlas.git
   cd atlas
   ```

2. Installer les dépendances :
   ```bash
   npm install
   ```

3. Configurer les variables d'environnement (client) :
   - Créer `.env` et définir au minimum :
     - `VITE_SUPABASE_URL=...`
     - `VITE_SUPABASE_ANON_KEY=...`
     - `VITE_WEATHER_API_KEY=...`
     - `VITE_OPENAI_PROXY_URL=https://<votre-proxy>/analyze` (recommandé en prod)

4. Lancer en mode développement :
   ```bash
   npm run dev
   ```

## 🔒 Sécurité

- OpenAI est appelé via un proxy serveur avec vérification d'un token utilisateur côté serveur.
- Supabase Auth protège les routes de l'application.
- Les accès aux données opérationnelles sont contrôlés par RLS côté Supabase.
- Les tuiles cartographiques utilisent des sources CORS-friendly (plus de tuiles Google non conformes).

## 📦 Build pour production

```bash
npm run build
```

## 📱 Build pour mobile (Android/iOS)

```bash
# Construire l'application
npm run build

# Ajouter les plateformes (exécuter une seule fois)
npx cap add android
npx cap add ios

# Synchroniser et ouvrir
npx cap sync
npx cap open android  # ou 'npx cap open ios'
```

## 🔁 Proxy OpenAI (serveur)

### Flux IA actuel (recommandé)
- Le client appelle uniquement le proxy `analyze` via `VITE_OPENAI_PROXY_URL`.
- Le proxy utilise **Chat Completions** et un **prompt côté serveur**.
- Le schéma JSON attendu est défini côté serveur et impose le format SOIEC.
- Le client envoie `doctrine_context` (calculé depuis la dominante) pour guider les formulations doctrinales.

### Configuration
- Définissez la clé OpenAI côté serveur (`OPENAI_API_KEY`).
- Exposez l’URL HTTPS du proxy et renseignez `VITE_OPENAI_PROXY_URL` côté client.

## 🧩 Modifications notables (branche: optimisation-diverse-par-cursor)

- Sécurité & données
  - OpenAI via proxy serveur avec parsing JSON prioritaire
- Performance & UX
  - Lazy-load des routes (React.lazy) et lazy imports pour `html2canvas`/`jspdf`
  - Safe-area bottom pour les boutons fixes; meta `viewport-fit=cover`
  - Haptics sur actions de génération (Capacitor Haptics)
- Cartographie
  - Remplacement tuiles Google → OSM/CARTO CORS-friendly
  - Export carte plus robuste (CORS + lazy import)
- Fiabilité IA
  - Parsing JSON en priorité dans la page résultats; fallback Markdown conservé
  - Timeout et filtrage du dernier message assistant pour Threads/Runs (fallback dev)
- Correctifs divers
  - `lang="fr"` dans `index.html`, logo corrigé, `onKeyDown` au lieu de `onKeyPress`
  - Historique: initialisation corrigée
  - Analytics: initialisation protégée (désactivée si non supportée)

## 🤝 Contribution

1. Créer une branche : `git checkout -b feature/nouvelle-fonctionnalite`
2. Committer vos changements : `git commit -m "feat: ..."`
3. Pousser la branche : `git push origin feature/nouvelle-fonctionnalite`
4. Ouvrir une Pull Request

## 📄 Licence

Ce projet est sous licence MIT - voir le fichier [LICENSE](LICENSE) pour plus de détails.
