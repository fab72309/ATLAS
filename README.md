# A.T.L.A.S

Aide Tactique et Logique pour l'Action des Secours

## 📱 Fonctionnalités

- Génération de messages opérationnels (Chef de groupe, Chef de colonne, Communication OPS)
- Zonage opérationnel avec cartographie interactive
- Intégration avec OpenAI pour l'assistance
- Sauvegarde et historique des opérations
- Export PDF et partage

## 🚀 Prérequis

- Node.js 16+ et npm/yarn
- Compte Firebase
- Clé API OpenAI
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
   # ou
   yarn
   ```

3. Configurer les variables d'environnement :
   - Copier `.env.example` vers `.env`
   - Remplir les variables avec vos identifiants

4. Lancer en mode développement :
   ```bash
   npm run dev
   # ou
   yarn dev
   ```

## 🔒 Sécurité

⚠️ **Ne jamais commiter** de clés API ou de fichiers sensibles. Le fichier `.env` est déjà dans `.gitignore`.

## 📦 Build pour production

```bash
npm run build
# ou
yarn build
```

## 📱 Build pour mobile (Android/iOS)

```bash
# Construire l'application
npm run build

# Ajouter les plateformes (exécuter une seule fois)
npx cap add android
npx cap add ios

# Copier les fichiers et ouvrir Android Studio / Xcode
npx cap sync
npx cap open android  # ou 'npx cap open ios'
```

## 🤝 Contribution

1. Créer une branche : `git checkout -b feature/nouvelle-fonctionnalite`
2. Committer vos changements : `git commit -m 'Ajout d\'une nouvelle fonctionnalité'`
3. Pousser la branche : `git push origin feature/nouvelle-fonctionnalite`
4. Ouvrir une Pull Request

## 📄 Licence

Ce projet est sous licence MIT - voir le fichier [LICENSE](LICENSE) pour plus de détails.
