import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  RefreshCw, 
  ChevronDown, 
  ChevronRight,
  Clock,
  Loader2,
  CheckCircle,
  XCircle,
  Trash2,
  AlertCircle
} from 'lucide-react';
import { fetchEnrichmentStatus, fetchEnrichmentQueue, clearEnrichmentQueue, type EnrichmentQueueItem } from '../lib/api';

export function EnrichmentPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const queryClient = useQueryClient();

  const { data: status } = useQuery({
    queryKey: ['enrichment-status'],
    queryFn: fetchEnrichmentStatus,
    refetchInterval: 5000,
  });

  const { data: queue } = useQuery({
    queryKey: ['enrichment-queue'],
    queryFn: () => fetchEnrichmentQueue(undefined, 20),
    refetchInterval: 5000,
    enabled: isExpanded,
  });

  const handleClearHistory = async () => {
    await clearEnrichmentQueue();
    queryClient.invalidateQueries({ queryKey: ['enrichment-status'] });
    queryClient.invalidateQueries({ queryKey: ['enrichment-queue'] });
  };

  const hasActivity = status && (status.pending > 0 || status.processing > 0);
  const hasHistory = status && (status.completed > 0 || status.failed > 0);

  if (!status || status.total === 0) {
    return null;
  }

  return (
    <div className="space-y-1">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-1 text-xs font-semibold text-text-muted uppercase tracking-wider hover:text-text-primary transition-colors"
      >
        <span className="flex items-center gap-2">
          <RefreshCw className={`w-3 h-3 ${status.processing > 0 ? 'animate-spin text-accent-primary' : ''}`} />
          Sync Queue
          {hasActivity && (
            <span className="flex items-center gap-1 normal-case font-normal">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-primary animate-pulse" />
              <span className="text-accent-primary">{status.pending + status.processing}</span>
            </span>
          )}
        </span>
        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 py-2 space-y-3">
              <div className="grid grid-cols-4 gap-1 text-center">
                <StatusBadge icon={Clock} count={status.pending} label="Pending" color="text-text-muted" />
                <StatusBadge icon={Loader2} count={status.processing} label="Active" color="text-accent-primary" spinning />
                <StatusBadge icon={CheckCircle} count={status.completed} label="Done" color="text-green-500" />
                <StatusBadge icon={XCircle} count={status.failed} label="Failed" color="text-red-400" />
              </div>

              {queue?.items && queue.items.length > 0 && (
                <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-hidden">
                  {queue.items.slice(0, 10).map((item) => (
                    <QueueItem key={item.id} item={item} />
                  ))}
                  {queue.items.length > 10 && (
                    <div className="text-[10px] text-text-muted text-center py-1">
                      +{queue.items.length - 10} more
                    </div>
                  )}
                </div>
              )}

              {hasHistory && (
                <button
                  onClick={handleClearHistory}
                  className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-medium
                             text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear History
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatusBadge({ 
  icon: Icon, 
  count, 
  label, 
  color,
  spinning 
}: { 
  icon: React.ComponentType<{ className?: string }>; 
  count: number; 
  label: string; 
  color: string;
  spinning?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className={`text-sm font-bold ${count > 0 ? color : 'text-text-muted/30'}`}>
        {count}
      </div>
      <div className="flex items-center gap-0.5">
        <Icon className={`w-2.5 h-2.5 ${count > 0 ? color : 'text-text-muted/30'} ${spinning && count > 0 ? 'animate-spin' : ''}`} />
        <span className="text-[9px] text-text-muted">{label}</span>
      </div>
    </div>
  );
}

function QueueItem({ item }: { item: EnrichmentQueueItem }) {
  const statusConfig = {
    pending: { icon: Clock, color: 'text-text-muted', bg: 'bg-bg-tertiary' },
    processing: { icon: Loader2, color: 'text-accent-primary', bg: 'bg-accent-primary/10' },
    completed: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10' },
    failed: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
  };

  const config = statusConfig[item.status];
  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${config.bg} border border-transparent hover:border-border-subtle transition-colors`}>
      <Icon className={`w-3 h-3 shrink-0 ${config.color} ${item.status === 'processing' ? 'animate-spin' : ''}`} />
      
      <div className="flex-1 min-w-0">
        <div className="text-xs text-text-primary truncate">
          {item.profile?.fullName || item.publicIdentifier}
        </div>
        {item.error && (
          <div className="text-[10px] text-red-400 truncate" title={item.error}>
            {item.error}
          </div>
        )}
      </div>

      {item.attempts > 1 && (
        <span className="text-[9px] text-text-muted shrink-0">
          #{item.attempts}
        </span>
      )}
    </div>
  );
}
