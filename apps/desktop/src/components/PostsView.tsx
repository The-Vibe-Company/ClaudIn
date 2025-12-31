import { useState, useRef, useEffect } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Newspaper,
  ThumbsUp,
  MessageCircle,
  Repeat2,
  Video,
  FileText,
  ExternalLink,
  Calendar,
  Maximize2,
  AlertCircle
} from 'lucide-react';
import { open } from '@tauri-apps/plugin-shell';
import { fetchPosts } from '../lib/api';
import type { Post } from '../lib/api';
import { PostCardSkeletonList } from './Skeleton';

export function PostsView() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['posts', debouncedSearch],
    queryFn: () => fetchPosts({ search: debouncedSearch, limit: 50 }),
    placeholderData: keepPreviousData,
  });

  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-bg-primary">
      <div className="h-16 px-6 border-b border-border-subtle flex items-center justify-between shrink-0 bg-bg-primary/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-accent-primary/10 text-accent-primary">
            <Newspaper className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-bold text-text-primary leading-none">Posts Feed</h1>
            <span className="text-xs text-text-muted mt-1">
              {data?.total ?? 0} updates found
            </span>
          </div>
        </div>

        <div className="relative w-72 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-accent-primary transition-colors" />
          <input
            type="text"
            placeholder="Search keywords, authors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-bg-secondary border border-border-subtle 
                     text-sm text-text-primary placeholder:text-text-muted
                     focus:outline-none focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary
                     transition-all shadow-sm"
          />
        </div>
      </div>

      <div ref={containerRef} className="flex-1 overflow-y-auto p-6 scrollbar-hidden">
        {isLoading && !data ? (
          <PostCardSkeletonList count={4} />
        ) : isError ? (
          <div className="flex items-center justify-center h-full text-red-400 gap-2">
            <AlertCircle className="w-5 h-5" />
            <span>Failed to load posts. Please try again.</span>
          </div>
        ) : data?.posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted gap-2">
            <Newspaper className="w-12 h-12 text-bg-tertiary mb-2" />
            <span className="font-medium">No posts found</span>
            <span className="text-sm">Try adjusting your search terms</span>
          </div>
        ) : (
          <div className="grid gap-6 max-w-2xl mx-auto pb-10">
            <AnimatePresence mode='popLayout'>
              {data?.posts.map((post: Post, index: number) => (
                <PostCard key={post.id} post={post} index={index} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

function PostCard({ post, index }: { post: Post; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const [imageLoaded, setImageLoaded] = useState<Record<number, boolean>>({});
  
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric',
      year: new Date(dateStr).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
  };

  const isLongContent = post.content.length > 280;
  const displayContent = expanded ? post.content : post.content.slice(0, 280) + (isLongContent ? '...' : '');

  const hasMedia = post.imageUrls && post.imageUrls.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="bg-bg-secondary border border-border-subtle rounded-2xl p-0 
                 hover:shadow-lg hover:shadow-black/5 hover:border-accent-primary/20 transition-all overflow-hidden group"
    >
      <div className="p-5 pb-3">
        <div className="flex gap-3 mb-3">
          <div className="shrink-0">
            {post.authorProfilePictureUrl ? (
              <img 
                src={post.authorProfilePictureUrl} 
                alt={post.authorName} 
                className="w-11 h-11 rounded-full object-cover border-2 border-bg-tertiary"
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-bg-tertiary to-bg-elevated 
                            flex items-center justify-center text-text-secondary font-bold text-lg
                            border-2 border-bg-tertiary">
                {post.authorName.charAt(0)}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <div className="flex items-center justify-between">
              <h3 
                className="font-bold text-text-primary hover:text-accent-primary transition-colors cursor-pointer truncate text-[15px]"
                onClick={() => open(`https://linkedin.com/in/${post.authorPublicIdentifier}`)}
              >
                {post.authorName}
              </h3>
              <span className="text-xs text-text-muted flex items-center gap-1 bg-bg-tertiary px-2 py-0.5 rounded-full">
                <Calendar className="w-3 h-3" />
                {formatDate(post.postedAt)}
              </span>
            </div>
            <p className="text-xs text-text-secondary truncate mt-0.5">{post.authorHeadline}</p>
          </div>
        </div>

        <div className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">
          {displayContent}
          {isLongContent && (
            <button 
              onClick={() => setExpanded(!expanded)}
              className="text-accent-primary hover:underline ml-1 font-medium text-xs"
            >
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      </div>

      {hasMedia && (
        <div className={`
          mt-2 border-y border-border-subtle bg-black/5 overflow-hidden
          ${post.imageUrls.length === 1 ? 'aspect-video' : 'grid grid-cols-2 aspect-[4/3] gap-0.5'}
        `}>
          {post.imageUrls.slice(0, 4).map((url, i) => (
            <div 
              key={i} 
              className={`
                relative overflow-hidden cursor-zoom-in group/image bg-bg-tertiary
                ${post.imageUrls.length === 3 && i === 0 ? 'row-span-2' : ''}
              `}
              onClick={() => open(url)}
            >
              <img
                src={url}
                alt={`Post attachment ${i + 1}`}
                loading="lazy"
                onLoad={() => setImageLoaded(prev => ({ ...prev, [i]: true }))}
                className={`
                  w-full h-full object-cover transition-all duration-500
                  ${imageLoaded[i] ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}
                  group-hover/image:scale-105
                `}
              />
              <div className="absolute inset-0 bg-black/0 group-hover/image:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover/image:opacity-100">
                <Maximize2 className="w-8 h-8 text-white drop-shadow-lg" />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="p-3 bg-bg-tertiary/30 border-t border-border-subtle flex items-center justify-between">
        <div className="flex gap-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-text-muted group/stat cursor-default" title="Likes">
            <ThumbsUp className="w-3.5 h-3.5 group-hover/stat:text-blue-400 transition-colors" />
            <span>{post.likesCount}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-text-muted group/stat cursor-default" title="Comments">
            <MessageCircle className="w-3.5 h-3.5 group-hover/stat:text-green-400 transition-colors" />
            <span>{post.commentsCount}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-text-muted group/stat cursor-default" title="Reposts">
            <Repeat2 className="w-3.5 h-3.5 group-hover/stat:text-purple-400 transition-colors" />
            <span>{post.repostsCount}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {(post.hasVideo || post.hasDocument) && (
            <div className="flex gap-2">
              {post.hasVideo && (
                <div className="px-1.5 py-0.5 rounded-md bg-bg-elevated border border-border-subtle text-[10px] text-text-secondary flex items-center gap-1">
                  <Video className="w-3 h-3" />
                  <span>Video</span>
                </div>
              )}
              {post.hasDocument && (
                <div className="px-1.5 py-0.5 rounded-md bg-bg-elevated border border-border-subtle text-[10px] text-text-secondary flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  <span>PDF</span>
                </div>
              )}
            </div>
          )}

          <button 
            onClick={() => post.postUrl && open(post.postUrl)}
            className="text-xs text-text-muted hover:text-accent-primary flex items-center gap-1 transition-colors font-medium"
          >
            LinkedIn
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
