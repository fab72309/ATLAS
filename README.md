# A.T.L.A.S

Aide Tactique et Logique pour l'Action des Secours

**Version courante : Alpha 0.2.0**

## 📱 Fonctionnalités

- Génération de messages opérationnels (Chef de groupe, Chef de colonne, Communication OPS)
- Zonage opérationnel avec cartographie interactive
- Assistance IA (OpenAI) pour structurer l’analyse/ordre initial
- Sauvegarde et historique des opérations
- Export PDF et partage

## 🚀 Prérequis

- Node.js 18+
- Compte Firebase (Firestore, Authentication, Functions)
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
     - `VITE_FIREBASE_API_KEY=...`
     - `VITE_FIREBASE_AUTH_DOMAIN=...`
     - `VITE_FIREBASE_PROJECT_ID=...`
     - `VITE_FIREBASE_STORAGE_BUCKET=...`
     - `VITE_FIREBASE_MESSAGING_SENDER_ID=...`
     - `VITE_FIREBASE_APP_ID=...`
     - `VITE_FIREBASE_MEASUREMENT_ID=...` (optionnel)
     - `VITE_WEATHER_API_KEY=...`
     - `VITE_OPENAI_PROXY_URL=https://<REGION>-<PROJECT>.cloudfunctions.net/analyze` (recommandé en prod)

4. Lancer en mode développement :
   ```bash
   npm run dev
   ```

## 🔒 Sécurité

- OpenAI est appelé via un proxy serveur (Firebase Functions) avec vérification du token Firebase côté serveur.
- Les règles Firestore exigent un utilisateur authentifié (email/mot de passe) et l’accès est limité par `uid`.
- Les écritures ajoutent automatiquement `uid` et `createdAt`.
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

## 🔁 Proxy OpenAI (Firebase Functions)

- Créez une Function HTTPS `analyze` qui valide l’input et appelle l’API OpenAI (Responses API avec `response_format` JSON schema).
- Définissez la clé dans les variables d’env Functions (`OPENAI_API_KEY`).
- Exposez l’URL et renseignez `VITE_OPENAI_PROXY_URL` côté client.

## 🧩 Modifications notables (branche: optimisation-diverse-par-cursor)

- Sécurité & données
  - OpenAI via proxy serveur (token Firebase côté client → serveur) avec parsing JSON prioritaire
  - Firestore: règles durcies (auth requise, `uid`/`createdAt` requis, lecture limitée par `uid`)
  - Écritures Firestore enrichies avec `uid` et `serverTimestamp()`
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
