import { useState, useRef, useEffect } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  MapPin, 
  Building2, 
  MessageSquare, 
  Calendar,
  ArrowUpRight,
  ArrowDownLeft,
  Loader2,
  Users
} from 'lucide-react';
import { fetchCRMProfiles } from '../lib/api';
import type { CRMProfile } from '../lib/api';

export function CRMView() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['crm-profiles', debouncedSearch],
    queryFn: () => fetchCRMProfiles({ search: debouncedSearch, limit: 50 }),
    placeholderData: keepPreviousData,
  });

  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-bg-primary">
      <div className="h-16 px-6 border-b border-border-subtle flex items-center justify-between shrink-0 bg-bg-primary/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-accent-primary/10 text-accent-primary">
            <Users className="w-5 h-5" />
          </div>
          <h1 className="text-lg font-semibold text-text-primary">Network CRM</h1>
          <span className="text-sm text-text-muted bg-bg-tertiary px-2 py-0.5 rounded-full border border-border-subtle">
            {data?.total ?? 0}
          </span>
        </div>

        <div className="relative w-64 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-accent-primary transition-colors" />
          <input
            type="text"
            placeholder="Search network..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-bg-secondary border border-border-subtle 
                     text-sm text-text-primary placeholder:text-text-muted
                     focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-transparent
                     transition-all"
          />
        </div>
      </div>

      <div ref={containerRef} className="flex-1 overflow-y-auto p-6 scrollbar-hidden">
        {isLoading && !data ? (
          <div className="flex items-center justify-center h-full text-text-muted gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading network...</span>
          </div>
        ) : isError ? (
          <div className="flex items-center justify-center h-full text-red-400 gap-2">
            <span>Failed to load profiles. Please try again.</span>
          </div>
        ) : data?.profiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted gap-2">
            <Users className="w-12 h-12 text-bg-tertiary mb-2" />
            <span className="font-medium">No profiles found</span>
            <span className="text-sm">Try adjusting your search terms</span>
          </div>
        ) : (
          <div className="grid gap-3 max-w-5xl mx-auto">
            <AnimatePresence mode='popLayout'>
              {data?.profiles.map((profile: CRMProfile, index: number) => (
                <ProfileCard key={profile.id} profile={profile} index={index} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileCard({ profile, index }: { profile: CRMProfile; index: number }) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="group bg-bg-secondary border border-border-subtle rounded-xl p-4 
                 hover:bg-bg-tertiary hover:border-accent-primary/30 hover:shadow-lg hover:shadow-accent-primary/5 
                 transition-all cursor-default relative overflow-hidden"
    >
      <div className="flex gap-4">
        <div className="shrink-0 relative">
          {profile.profilePictureUrl ? (
            <img 
              src={profile.profilePictureUrl} 
              alt={profile.fullName} 
              className="w-14 h-14 rounded-full object-cover border-2 border-bg-tertiary group-hover:border-accent-primary/50 transition-colors"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-bg-tertiary to-bg-elevated 
                          flex items-center justify-center text-text-secondary font-semibold text-lg
                          border-2 border-bg-tertiary group-hover:border-accent-primary/50 transition-colors">
              {profile.fullName.charAt(0)}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="font-semibold text-text-primary truncate hover:text-accent-primary transition-colors cursor-pointer"
                onClick={() => window.open(`https://linkedin.com/in/${profile.publicIdentifier}`, '_blank')}>
              {profile.fullName}
            </h3>
            {profile.location && (
              <span className="flex items-center gap-1 text-xs text-text-muted shrink-0">
                <MapPin className="w-3 h-3" />
                {profile.location}
              </span>
            )}
          </div>
          
          <p className="text-sm text-text-secondary truncate mb-1">
            {profile.headline}
          </p>
          
          <div className="flex items-center gap-1.5 text-xs text-text-muted">
            <Building2 className="w-3 h-3" />
            <span className="truncate">{profile.currentTitle} at {profile.currentCompany}</span>
          </div>
        </div>

        <div className="w-64 shrink-0 flex flex-col gap-2 border-l border-border-subtle pl-4 ml-2">
          {profile.lastMessage ? (
            <div className="text-xs">
              <div className="flex items-center gap-1.5 text-text-secondary mb-1">
                <MessageSquare className="w-3 h-3 text-accent-primary" />
                <span className="font-medium">Last Message</span>
                <span className="text-text-muted ml-auto">{formatDate(profile.lastMessage.at)}</span>
              </div>
              <div className="bg-bg-primary/50 rounded px-2 py-1.5 truncate text-text-muted flex items-center gap-2">
                {profile.lastMessage.direction === 'sent' ? (
                  <ArrowUpRight className="w-3 h-3 text-text-muted shrink-0" />
                ) : (
                  <ArrowDownLeft className="w-3 h-3 text-accent-primary shrink-0" />
                )}
                <span className="truncate">{profile.lastMessage.content}</span>
              </div>
            </div>
          ) : (
            <div className="text-xs opacity-50 flex items-center gap-1.5 pt-1">
              <MessageSquare className="w-3 h-3" />
              <span>No messages yet</span>
            </div>
          )}

          {profile.lastPost && (
            <div className="text-xs">
              <div className="flex items-center gap-1.5 text-text-secondary mb-1">
                <Calendar className="w-3 h-3 text-blue-400" />
                <span className="font-medium">Last Post</span>
                <span className="text-text-muted ml-auto">{formatDate(profile.lastPost.at)}</span>
              </div>
              <p className="truncate text-text-muted pl-0.5">{profile.lastPost.content}</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
