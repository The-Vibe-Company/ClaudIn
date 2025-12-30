# ClaudIn

**Chattez avec votre réseau LinkedIn grâce à l'IA**

ClaudIn est une application desktop local-first qui vous permet d'analyser et d'interagir avec votre réseau LinkedIn via une interface de chat IA. Vos données restent sur votre machine - aucune donnée n'est envoyée vers des serveurs externes.

## Fonctionnalités

- **Chat IA** - Posez des questions sur votre réseau à Claude (via OpenRouter)
- **CRM** - Visualisez et recherchez tous vos contacts LinkedIn
- **Posts** - Parcourez les publications de votre réseau
- **Sync automatique** - Extension Chrome qui synchronise automatiquement vos données LinkedIn
- **Serveur MCP** - Intégration avec Claude Desktop et autres clients compatibles

## Prérequis

- Node.js v22+
- pnpm 9.15+
- Rust (pour Tauri)
- Une clé API [OpenRouter](https://openrouter.ai) pour le chat IA

## Installation

```bash
# Cloner le projet
git clone <repo-url>
cd ClaudIn

# Installer les dépendances
pnpm install
```

## Lancement

### Développement

```bash
# Lancer tous les services (recommandé)
pnpm dev
```

Cela démarre :
- **Serveur backend** sur `http://localhost:3847`
- **Application desktop** sur `http://localhost:1420`
- **Extension Chrome** en mode watch

### Lancer individuellement

```bash
# Serveur uniquement
pnpm dev:server

# Application desktop uniquement
pnpm dev:desktop

# Extension Chrome uniquement
pnpm dev:extension
```

### Build production

```bash
# Build complet
pnpm build

# Build application desktop native
pnpm tauri:build

# Build extension Chrome
pnpm build:extension
```

## Configuration

### 1. Clé API OpenRouter

1. Obtenez une clé API sur [openrouter.ai](https://openrouter.ai)
2. Ouvrez l'application desktop
3. Allez dans **Settings** (icône engrenage)
4. Entrez votre clé API OpenRouter

### 2. Extension Chrome

1. Ouvrez Chrome et allez sur `chrome://extensions`
2. Activez le **Mode développeur**
3. Cliquez sur **Charger l'extension non empaquetée**
4. Sélectionnez le dossier `apps/extension/dist`

L'extension synchronise automatiquement les données lorsque vous naviguez sur LinkedIn.

## Structure du projet

```
ClaudIn/
├── apps/
│   ├── desktop/      # Application Tauri (React + Rust)
│   ├── server/       # API backend (Hono + SQLite)
│   └── extension/    # Extension Chrome
├── packages/
│   ├── shared/       # Types TypeScript partagés
│   └── mcp-server/   # Serveur MCP
```

## Technologies

| Composant | Stack |
|-----------|-------|
| Desktop | React 19, Tauri 2, Tailwind CSS, Zustand |
| Backend | Hono, SQLite, Zod |
| Extension | Chrome Manifest V3, Vite |
| IA | Claude Sonnet via OpenRouter |

## Données

Toutes les données sont stockées localement dans `~/.claudin/claudin.db` (SQLite).

Les données synchronisées incluent :
- Profils LinkedIn (nom, titre, entreprise, compétences...)
- Messages
- Publications du feed
- Historique des conversations IA

## Commandes utiles

```bash
pnpm dev          # Développement
pnpm build        # Build production
pnpm lint         # Vérification du code
pnpm typecheck    # Vérification TypeScript
pnpm clean        # Nettoyer les builds
```

## Licence

MIT
