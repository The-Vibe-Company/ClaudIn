import { useState, useRef, useEffect } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  MapPin,
  MessageSquare,
  Calendar,
  ArrowUpRight,
  ArrowDownLeft,
  Loader2,
  Users,
  ExternalLink,
  AlertCircle,
  Briefcase,
  RefreshCw,
  CheckCircle,
  Download
} from 'lucide-react';
import { open } from '@tauri-apps/plugin-shell';
import { fetchCRMProfiles, queueProfileEnrichment } from '../lib/api';
import { useAppStore } from '../store/app';
import type { CRMProfile } from '../lib/api';
import { ProfileCardSkeletonList } from './Skeleton';
import { exportProfiles, type ExportFormat } from '../lib/export';

export function CRMView() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

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

  const handleExport = async (format: ExportFormat) => {
    if (!data?.profiles || isExporting) return;
    setIsExporting(true);
    setShowExportMenu(false);

    try {
      const result = await exportProfiles(data.profiles, { format });
      if (result.success) {
        console.log('Exported to:', result.path);
      }
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-bg-primary">
      <div className="h-16 px-6 border-b border-border-subtle flex items-center justify-between shrink-0 bg-bg-primary/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-accent-primary/10 text-accent-primary">
            <Users className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-bold text-text-primary leading-none">Network CRM</h1>
            <AnimatePresence mode="wait">
              <motion.span 
                key={data?.total ?? 0}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="text-xs text-text-muted mt-1"
              >
                {data?.total ?? 0} connections found
              </motion.span>
            </AnimatePresence>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Export button */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={!data?.profiles?.length || isExporting}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-bg-secondary border border-border-subtle
                       text-sm text-text-secondary hover:text-text-primary hover:border-accent-primary/30
                       disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Export
            </button>

            <AnimatePresence>
              {showExportMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -5, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -5, scale: 0.95 }}
                    className="absolute right-0 top-full mt-2 w-36 bg-bg-elevated border border-border-subtle rounded-xl shadow-xl z-50 overflow-hidden"
                  >
                    <button
                      onClick={() => handleExport('csv')}
                      className="w-full px-4 py-2.5 text-sm text-left text-text-primary hover:bg-bg-tertiary transition-colors"
                    >
                      Export as CSV
                    </button>
                    <button
                      onClick={() => handleExport('json')}
                      className="w-full px-4 py-2.5 text-sm text-left text-text-primary hover:bg-bg-tertiary transition-colors"
                    >
                      Export as JSON
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Search input */}
          <div className="relative w-72 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-accent-primary transition-colors" />
            <input
              type="text"
              placeholder="Search network..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-bg-secondary border border-border-subtle
                       text-sm text-text-primary placeholder:text-text-muted
                       focus:outline-none focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary
                       transition-all shadow-sm"
            />
          </div>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 overflow-y-auto p-6 scrollbar-hidden">
        {isLoading && !data ? (
          <ProfileCardSkeletonList count={6} />
        ) : isError ? (
          <div className="flex items-center justify-center h-full text-red-400 gap-2">
            <AlertCircle className="w-5 h-5" />
            <span>Failed to load profiles. Please try again.</span>
          </div>
        ) : data?.profiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted gap-2">
            <div className="w-16 h-16 rounded-full bg-bg-secondary flex items-center justify-center mb-2">
              <Users className="w-8 h-8 text-text-muted" />
            </div>
            <span className="font-medium text-lg text-text-primary">No profiles found</span>
            <span className="text-sm">Try adjusting your search terms</span>
          </div>
        ) : (
          <div className="grid gap-3 max-w-5xl mx-auto pb-10">
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
  const { openProfile } = useAppStore();
  const isPartial = profile.isPartial;
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncQueued, setSyncQueued] = useState(false);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const openLinkedIn = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await open(`https://linkedin.com/in/${profile.publicIdentifier}`);
  };

  const handleSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSyncing(true);
    try {
      await queueProfileEnrichment(profile.publicIdentifier);
      setSyncQueued(true);
    } catch (err) {
      console.error('Failed to queue sync:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCardClick = () => {
    openProfile(profile.publicIdentifier);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.5), duration: 0.3, ease: "easeOut" }}
      onClick={handleCardClick}
      className={`group relative bg-bg-secondary border rounded-2xl p-4 cursor-pointer
                 hover:shadow-lg hover:shadow-black/20 transition-all duration-300
                 ${isPartial ? 'border-border-subtle hover:border-amber-500/30' : 'border-border-subtle hover:border-accent-primary/30'}
                 overflow-hidden`}
    >
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none
        bg-gradient-to-r ${isPartial ? 'from-amber-500/5 via-transparent to-transparent' : 'from-accent-primary/5 via-transparent to-transparent'}`} 
      />

      <div className="flex gap-4 relative z-10">
        <div className="shrink-0">
          <div className="relative">
            {profile.profilePictureUrl ? (
              <img 
                src={profile.profilePictureUrl} 
                alt={profile.fullName} 
                className={`w-14 h-14 rounded-full object-cover border-2 transition-colors duration-300
                  ${isPartial 
                    ? 'border-border-subtle group-hover:border-amber-500/50' 
                    : 'border-bg-tertiary group-hover:border-accent-primary/50'}`}
              />
            ) : (
              <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold border-2 transition-colors duration-300
                ${isPartial
                  ? 'bg-bg-tertiary text-text-muted border-border-subtle group-hover:border-amber-500/50'
                  : 'bg-gradient-to-br from-bg-tertiary to-bg-elevated text-text-primary border-bg-tertiary group-hover:border-accent-primary/50'}`}
              >
                {profile.fullName.charAt(0)}
              </div>
            )}
            
            {isPartial && (
              <div className="absolute -bottom-1 -right-1 bg-bg-primary rounded-full p-0.5 border border-border-subtle" title="Partial Profile">
                <div className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center">
                  <AlertCircle className="w-2.5 h-2.5" />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-center py-0.5">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="font-semibold text-text-primary truncate text-base group-hover:text-accent-primary transition-colors">
                {profile.fullName}
              </h3>
              
              {isPartial ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20 shrink-0">
                  Sync Required
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              {/* Sync button - always visible for partial profiles */}
              {isPartial && !syncQueued && (
                <button
                  onClick={handleSync}
                  disabled={isSyncing}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium
                             bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 disabled:opacity-50
                             border border-amber-500/20 hover:border-amber-500/40 transition-all"
                >
                  {isSyncing ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3 h-3" />
                  )}
                  <span>Sync Profile</span>
                </button>
              )}
              {syncQueued && (
                <span className="flex items-center gap-1.5 text-xs text-green-500 px-2 py-1 bg-green-500/10 rounded-full border border-green-500/20">
                  <CheckCircle className="w-3 h-3" />
                  Queued
                </span>
              )}
              {/* LinkedIn button - only visible on hover */}
              <button
                onClick={openLinkedIn}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium
                           bg-accent-primary/10 text-accent-primary hover:bg-accent-primary/20
                           opacity-0 group-hover:opacity-100 transition-all duration-200"
              >
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>
          
          <div className="space-y-1">
            {profile.headline ? (
              <p className="text-sm text-text-secondary truncate pr-4" title={profile.headline}>
                {profile.headline}
              </p>
            ) : (
              <p className="text-sm text-text-muted/50 italic truncate">
                No headline available
              </p>
            )}
            
            <div className="flex items-center gap-4 text-xs text-text-muted">
              {(profile.currentTitle || profile.currentCompany) ? (
                <div className="flex items-center gap-1.5 min-w-0 max-w-[50%]">
                  <Briefcase className="w-3 h-3 shrink-0" />
                  <span className="truncate">
                    {profile.currentTitle}
                    {profile.currentTitle && profile.currentCompany && " at "}
                    {profile.currentCompany}
                  </span>
                </div>
              ) : isPartial ? (
                <span className="text-amber-500/70 text-[10px]">Visit profile to sync details</span>
              ) : null}

              {profile.location && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <MapPin className="w-3 h-3" />
                  <span className="truncate">{profile.location}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="w-60 shrink-0 flex flex-col justify-center gap-2 border-l border-border-subtle pl-4 ml-2 my-1">
          {profile.lastMessage ? (
            <div className="text-xs group/msg">
              <div className="flex items-center gap-1.5 text-text-secondary mb-1">
                <MessageSquare className="w-3 h-3 text-accent-primary" />
                <span className="font-medium">Last Message</span>
                <span className="text-text-muted ml-auto">{formatDate(profile.lastMessage.at)}</span>
              </div>
              <div className="bg-bg-primary/50 rounded px-2 py-1.5 truncate text-text-muted flex items-center gap-2 border border-transparent group-hover/msg:border-border-subtle transition-colors">
                {profile.lastMessage.direction === 'sent' ? (
                  <ArrowUpRight className="w-3 h-3 text-text-muted shrink-0" />
                ) : (
                  <ArrowDownLeft className="w-3 h-3 text-accent-primary shrink-0" />
                )}
                <span className="truncate">{profile.lastMessage.content}</span>
              </div>
            </div>
          ) : (
            <div className="text-xs opacity-40 flex items-center gap-1.5 py-1">
              <MessageSquare className="w-3 h-3" />
              <span>No messages yet</span>
            </div>
          )}

          {profile.lastPost && (
            <div className="text-xs mt-1">
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
