# ClaudIn

**Synchronisez LinkedIn et exposez vos données via MCP**

ClaudIn synchronise votre réseau LinkedIn localement et l'expose via un serveur [MCP (Model Context Protocol)](https://modelcontextprotocol.io). Utilisez vos données LinkedIn directement depuis Claude Desktop, Claude Code, ou tout client MCP compatible.

## Pourquoi ClaudIn ?

- **Vos données, localement** - Tout est stocké sur votre machine dans une base SQLite
- **MCP-first** - Accédez à votre réseau LinkedIn depuis n'importe quel client MCP
- **Sync automatique** - L'extension Chrome synchronise vos contacts, messages et posts en arrière-plan

## Fonctionnalités

- **Serveur MCP** - Expose votre réseau LinkedIn à Claude Desktop/Code et autres clients
- **Extension Chrome** - Synchronise automatiquement profils, messages et publications
- **Interface desktop** - CRM pour visualiser vos contacts et leurs activités

## Prérequis

- Node.js v22+
- pnpm 9.15+
- Rust (pour Tauri)

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

### 1. Extension Chrome

1. Ouvrez Chrome et allez sur `chrome://extensions`
2. Activez le **Mode développeur**
3. Cliquez sur **Charger l'extension non empaquetée**
4. Sélectionnez le dossier `apps/extension/dist`

L'extension synchronise automatiquement les données lorsque vous naviguez sur LinkedIn.

### 2. Serveur MCP avec Claude Desktop

Ajoutez cette configuration dans votre fichier Claude Desktop (`claude_desktop_config.json`) :

```json
{
  "mcpServers": {
    "claudin": {
      "command": "node",
      "args": ["/chemin/vers/ClaudIn/packages/mcp-server/dist/index.js"]
    }
  }
}
```

Une fois configuré, Claude Desktop peut accéder à votre réseau LinkedIn via les outils MCP :
- `search_network` - Rechercher des contacts
- `get_profile_details` - Voir le détail d'un profil
- `get_profile_posts` - Voir les publications d'un contact
- `find_people_at_company` - Trouver des contacts dans une entreprise
- `get_network_stats` - Statistiques de votre réseau

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
| MCP Server | @modelcontextprotocol/sdk, SQLite |
| Backend | Hono, SQLite, Zod |
| Extension | Chrome Manifest V3, Vite |
| Desktop | React 19, Tauri 2, Tailwind CSS |

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
