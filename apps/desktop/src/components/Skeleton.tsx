/**
 * Skeleton Loading Components
 * Provides visual placeholders while content is loading
 */

import { motion } from 'framer-motion';

const shimmer = {
  animate: {
    backgroundPosition: ['200% 0', '-200% 0'],
  },
  transition: {
    duration: 1.5,
    repeat: Infinity,
    ease: 'linear',
  },
};

function SkeletonBase({ className = '' }: { className?: string }) {
  return (
    <motion.div
      className={`bg-gradient-to-r from-bg-tertiary via-bg-elevated to-bg-tertiary bg-[length:200%_100%] rounded ${className}`}
      animate={shimmer.animate}
      transition={shimmer.transition}
    />
  );
}

export function ProfileCardSkeleton() {
  return (
    <div className="bg-bg-secondary border border-border-subtle rounded-2xl p-4">
      <div className="flex gap-4">
        {/* Avatar */}
        <div className="shrink-0">
          <SkeletonBase className="w-14 h-14 rounded-full" />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 flex flex-col justify-center py-0.5 space-y-2">
          {/* Name and badge */}
          <div className="flex items-center gap-2">
            <SkeletonBase className="h-5 w-36" />
            <SkeletonBase className="h-4 w-20 rounded-full" />
          </div>

          {/* Headline */}
          <SkeletonBase className="h-4 w-3/4" />

          {/* Meta info */}
          <div className="flex items-center gap-4">
            <SkeletonBase className="h-3 w-32" />
            <SkeletonBase className="h-3 w-24" />
          </div>
        </div>

        {/* Right panel */}
        <div className="w-60 shrink-0 flex flex-col justify-center gap-2 border-l border-border-subtle pl-4 ml-2">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <SkeletonBase className="h-3 w-3" />
              <SkeletonBase className="h-3 w-20" />
              <div className="ml-auto">
                <SkeletonBase className="h-3 w-12" />
              </div>
            </div>
            <SkeletonBase className="h-6 w-full rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function PostCardSkeleton() {
  return (
    <div className="bg-bg-secondary border border-border-subtle rounded-2xl overflow-hidden">
      <div className="p-5 pb-3">
        {/* Author section */}
        <div className="flex gap-3 mb-3">
          <SkeletonBase className="w-11 h-11 rounded-full shrink-0" />
          <div className="flex-1 min-w-0 pt-0.5 space-y-2">
            <div className="flex items-center justify-between">
              <SkeletonBase className="h-4 w-32" />
              <SkeletonBase className="h-5 w-16 rounded-full" />
            </div>
            <SkeletonBase className="h-3 w-48" />
          </div>
        </div>

        {/* Content */}
        <div className="space-y-2">
          <SkeletonBase className="h-4 w-full" />
          <SkeletonBase className="h-4 w-full" />
          <SkeletonBase className="h-4 w-3/4" />
        </div>
      </div>

      {/* Image placeholder */}
      <SkeletonBase className="h-48 w-full rounded-none" />

      {/* Footer */}
      <div className="p-3 bg-bg-tertiary/30 border-t border-border-subtle flex items-center justify-between">
        <div className="flex gap-4">
          <SkeletonBase className="h-4 w-10" />
          <SkeletonBase className="h-4 w-10" />
          <SkeletonBase className="h-4 w-10" />
        </div>
        <SkeletonBase className="h-4 w-16" />
      </div>
    </div>
  );
}

export function ProfileCardSkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="grid gap-3 max-w-5xl mx-auto">
      {Array.from({ length: count }).map((_, i) => (
        <ProfileCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function PostCardSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-6 max-w-2xl mx-auto">
      {Array.from({ length: count }).map((_, i) => (
        <PostCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function MessageBubbleSkeleton({ isUser = false }: { isUser?: boolean }) {
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] rounded-2xl p-4 ${isUser ? 'bg-accent-primary/10' : 'bg-bg-secondary'}`}>
        <div className="space-y-2">
          <SkeletonBase className="h-4 w-64" />
          <SkeletonBase className="h-4 w-48" />
          <SkeletonBase className="h-4 w-32" />
        </div>
      </div>
    </div>
  );
}

export function ToolCallSkeleton() {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-bg-tertiary rounded-lg">
      <SkeletonBase className="w-4 h-4 rounded" />
      <SkeletonBase className="h-3 w-24" />
      <div className="ml-auto">
        <SkeletonBase className="w-4 h-4 rounded-full" />
      </div>
    </div>
  );
}
