import { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Plus,
  Search,
  Settings,
  User,
  Sparkles,
  Network,
} from 'lucide-react';
import { useAppStore } from '../store/app';
import { searchProfiles } from '../lib/api';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; name: string; title: string }>>([]);
  const [isSearching, setIsSearching] = useState(false);

  const { conversations, setActiveConversation } = useAppStore();

  // Search profiles when input changes
  useEffect(() => {
    if (!search || search.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const { profiles } = await searchProfiles(search);
        setSearchResults(profiles.slice(0, 5));
      } catch {
        setSearchResults([]);
      }
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setSearch('');
      setSearchResults([]);
    }
  }, [open]);

  const handleNewChat = () => {
    setActiveConversation(null);
    onOpenChange(false);
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversation(id);
    onOpenChange(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => onOpenChange(false)}
          />

          {/* Command dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg z-50"
          >
            <Command
              className="rounded-xl bg-bg-secondary border border-border-subtle shadow-2xl overflow-hidden"
              shouldFilter={false}
            >
              <div className="flex items-center border-b border-border-subtle px-3">
                <Search className="w-4 h-4 text-text-muted mr-2" />
                <Command.Input
                  value={search}
                  onValueChange={setSearch}
                  placeholder="Search conversations, profiles, or commands..."
                  className="flex-1 py-3 bg-transparent text-sm placeholder:text-text-muted 
                             focus:outline-none"
                />
                <kbd className="kbd">ESC</kbd>
              </div>

              <Command.List className="max-h-[300px] overflow-y-auto p-2">
                <Command.Empty className="py-6 text-center text-sm text-text-muted">
                  {isSearching ? 'Searching...' : 'No results found.'}
                </Command.Empty>

                {/* Quick Actions */}
                <Command.Group heading="Actions" className="mb-2">
                  <CommandItem onSelect={handleNewChat}>
                    <Plus className="w-4 h-4" />
                    New Chat
                    <span className="ml-auto text-text-muted text-xs">⌘N</span>
                  </CommandItem>
                  <CommandItem onSelect={() => {}}>
                    <Network className="w-4 h-4" />
                    View Network Stats
                  </CommandItem>
                  <CommandItem onSelect={() => {}}>
                    <Settings className="w-4 h-4" />
                    Settings
                    <span className="ml-auto text-text-muted text-xs">⌘,</span>
                  </CommandItem>
                </Command.Group>

                {/* Profile Search Results */}
                {searchResults.length > 0 && (
                  <Command.Group heading="People" className="mb-2">
                    {searchResults.map((profile) => (
                      <CommandItem
                        key={profile.id}
                        onSelect={() => {
                          // Open chat about this person
                          onOpenChange(false);
                        }}
                      >
                        <User className="w-4 h-4" />
                        <div className="flex flex-col">
                          <span>{profile.name}</span>
                          <span className="text-xs text-text-muted">{profile.title}</span>
                        </div>
                      </CommandItem>
                    ))}
                  </Command.Group>
                )}

                {/* Recent Conversations */}
                {conversations.length > 0 && !search && (
                  <Command.Group heading="Recent Chats" className="mb-2">
                    {conversations.slice(0, 5).map((conv) => (
                      <CommandItem
                        key={conv.id}
                        onSelect={() => handleSelectConversation(conv.id)}
                      >
                        <MessageSquare className="w-4 h-4" />
                        {conv.title || 'New Chat'}
                        <span className="ml-auto text-text-muted text-xs">
                          {conv.messageCount} msgs
                        </span>
                      </CommandItem>
                    ))}
                  </Command.Group>
                )}

                {/* AI Suggestions */}
                {!search && (
                  <Command.Group heading="Ask AI" className="mb-2">
                    <CommandItem onSelect={() => {}}>
                      <Sparkles className="w-4 h-4" />
                      Who should I reconnect with?
                    </CommandItem>
                    <CommandItem onSelect={() => {}}>
                      <Sparkles className="w-4 h-4" />
                      Who do I know at [company]?
                    </CommandItem>
                  </Command.Group>
                )}
              </Command.List>
            </Command>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function CommandItem({
  children,
  onSelect,
}: {
  children: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm cursor-pointer
                 text-text-secondary data-[selected=true]:bg-bg-tertiary data-[selected=true]:text-text-primary"
    >
      {children}
    </Command.Item>
  );
}
