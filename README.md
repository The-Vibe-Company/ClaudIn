# ClaudIn

**Sync your LinkedIn network locally and access it via MCP**

ClaudIn captures your LinkedIn activity (profiles, posts, messages) as you browse and stores everything locally. Access your network data through Claude Desktop, Claude Code, or any MCP-compatible client.

## Why ClaudIn?

- **Your data, locally** - Everything stored on your machine in SQLite
- **MCP-first** - Query your LinkedIn network from Claude Desktop/Code
- **Passive sync** - The Chrome extension captures data as you browse LinkedIn
- **Rich data** - Profiles, posts (with links, videos, documents), messages, and more

## Features

- **Chrome Extension** - Automatically syncs profiles, messages, and feed posts
- **Desktop App** - CRM-like interface to browse your contacts and their activity  
- **MCP Server** - Expose your LinkedIn data to Claude Desktop/Code
- **AI Chat** - Built-in chat with context about your network

## Installation

### Option 1: Download Release (Recommended)

1. Go to [Releases](../../releases) and download:
   - **Desktop App**: `.dmg` (macOS), `.msi` (Windows), or `.AppImage` (Linux)
   - **Extension**: `claudin-extension.zip`

2. Install the desktop app

3. Install the Chrome extension:
   - Unzip `claudin-extension.zip`
   - Open Chrome → `chrome://extensions`
   - Enable **Developer mode** (top right)
   - Click **Load unpacked**
   - Select the `dist` folder from the unzipped extension

4. Start the desktop app and browse LinkedIn!

### Option 2: Build from Source

#### Prerequisites

- Node.js v22+
- pnpm 9.15+
- Rust (for Tauri desktop app)

#### Steps

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/ClaudIn.git
cd ClaudIn

# Install dependencies
pnpm install

# Development mode (all services)
pnpm dev

# Or build for production
pnpm build
pnpm tauri:build
```

#### Load the Extension

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select `apps/extension/dist`

## Usage

### Basic Usage

1. **Start the desktop app** - This starts the backend server
2. **Browse LinkedIn** - The extension automatically captures:
   - Profile pages you visit
   - Search results
   - Feed posts (with links, videos, documents, polls)
   - Messages
3. **View your data** in the desktop app's CRM interface
4. **Use the AI chat** to ask questions about your network

### MCP Integration (Claude Desktop/Code)

Add ClaudIn to your Claude Desktop config:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "claudin": {
      "command": "node",
      "args": ["/path/to/ClaudIn/packages/mcp-server/dist/index.js"]
    }
  }
}
```

Then restart Claude Desktop. You can now ask Claude about your LinkedIn network:

- *"Who do I know at Google?"*
- *"Show me recent posts from my network about AI"*
- *"Find people I've messaged in the last week"*

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `search_network` | Search contacts by name, company, title |
| `get_profile_details` | Get full profile information |
| `get_profile_posts` | Get posts from a specific contact |
| `find_people_at_company` | Find all contacts at a company |
| `get_network_stats` | Statistics about your network |

## Data Captured

### Profiles
- Name, headline, location, about
- Current company and title
- Experience and education history
- Skills

### Posts
- Text content and media (images, videos, documents)
- Shared links with metadata
- Engagement metrics (likes, comments, reposts)
- Hashtags and mentions
- Post type detection (article, video, poll, job, celebration, etc.)

### Messages
- Conversation threads
- Message content and timestamps

## Project Structure

```
ClaudIn/
├── apps/
│   ├── desktop/      # Tauri app (React + Rust)
│   ├── server/       # Backend API (Hono + SQLite)
│   └── extension/    # Chrome extension
├── packages/
│   ├── shared/       # Shared TypeScript types
│   └── mcp-server/   # MCP server for Claude
```

## Development

```bash
# Start all services in dev mode
pnpm dev

# Run individual services
pnpm dev:server      # Backend only
pnpm dev:desktop     # Desktop app only
pnpm dev:extension   # Extension (watch mode)

# Type checking
pnpm typecheck

# Build everything
pnpm build
```

## Data Storage

All data is stored locally in `~/.claudin/claudin.db` (SQLite).

## Tech Stack

| Component | Technologies |
|-----------|--------------|
| Desktop | React 19, Tauri 2, Tailwind CSS |
| Backend | Hono, SQLite, better-sqlite3 |
| Extension | Chrome Manifest V3, Vite |
| MCP Server | @modelcontextprotocol/sdk |
| Shared | TypeScript, Zod |

## Privacy

ClaudIn is designed with privacy in mind:
- All data stays on your machine
- No external servers or cloud storage
- You control what gets synced
- Delete your data anytime by removing `~/.claudin/`

## License

MIT
