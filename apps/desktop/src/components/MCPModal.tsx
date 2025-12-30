import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, Terminal, ExternalLink, AlertCircle } from 'lucide-react';
import { useAppStore } from '../store/app';

const getMCPConfig = (path: string) => `{
  "mcpServers": {
    "claudin": {
      "command": "node",
      "args": ["${path}/packages/mcp-server/dist/index.js"]
    }
  }
}`;

export function MCPModal() {
  const { isMCPModalOpen, setMCPModalOpen } = useAppStore();
  const [copied, setCopied] = useState(false);
  const [projectPath, setProjectPath] = useState('/path/to/ClaudIn');

  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const configPath = isMac 
    ? '~/Library/Application Support/Claude/claude_desktop_config.json'
    : '%APPDATA%\\Claude\\claude_desktop_config.json';

  const mcpConfig = getMCPConfig(projectPath);

  const handleCopyConfig = async () => {
    try {
      await navigator.clipboard.writeText(mcpConfig);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleClose = () => setMCPModalOpen(false);

  return (
    <AnimatePresence>
      {isMCPModalOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={handleClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
            className="fixed top-[10vh] left-1/2 -translate-x-1/2 w-full max-w-lg z-50"
          >
            <div className="bg-bg-secondary border border-border-subtle rounded-xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
              
              <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-bg-tertiary/30 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-accent-primary" />
                  <h2 className="text-lg font-semibold text-text-primary">Install MCP for Claude</h2>
                </div>
                <button
                  onClick={handleClose}
                  className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-5 overflow-y-auto flex-1">
                <p className="text-sm text-text-secondary">
                  Add ClaudIn to Claude Desktop to let Claude access your LinkedIn network data.
                </p>

                <div className="space-y-2">
                  <label className="block text-xs font-medium text-text-secondary">
                    ClaudIn project path:
                  </label>
                  <input
                    type="text"
                    value={projectPath}
                    onChange={(e) => setProjectPath(e.target.value)}
                    placeholder="/Users/you/Dev/ClaudIn"
                    className="block w-full px-3 py-2 bg-bg-primary border border-border-default rounded-lg 
                             text-text-primary placeholder:text-text-muted/50 focus:ring-2 focus:ring-accent-primary/50 
                             focus:border-accent-primary transition-all text-sm font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-medium text-text-secondary">
                    1. Open your Claude config file:
                  </label>
                  <code className="block px-3 py-2 bg-bg-primary border border-border-default rounded-lg text-xs text-text-secondary font-mono break-all">
                    {configPath}
                  </code>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-medium text-text-secondary">
                    2. Add this configuration:
                  </label>
                  <div className="relative group">
                    <pre className="px-3 py-3 bg-bg-primary border border-border-default rounded-lg text-xs text-text-secondary font-mono overflow-x-auto whitespace-pre-wrap break-all">
                      {mcpConfig}
                    </pre>
                    <button
                      type="button"
                      onClick={handleCopyConfig}
                      className="absolute top-2 right-2 p-1.5 rounded-md bg-bg-tertiary/80 hover:bg-bg-tertiary 
                               text-text-muted hover:text-text-primary transition-all opacity-0 group-hover:opacity-100"
                      title="Copy to clipboard"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-3 rounded-lg bg-accent-primary/10 border border-accent-primary/20">
                  <AlertCircle className="w-4 h-4 text-accent-primary mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-text-secondary">
                    <span className="font-medium text-text-primary">3. Restart Claude Desktop</span> to load the MCP server.
                  </p>
                </div>

                <a
                  href="https://modelcontextprotocol.io/quickstart/user"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-accent-primary hover:text-accent-secondary transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Learn more about MCP
                </a>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
