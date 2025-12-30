import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchProfileDetail } from '../lib/api';
import type { ProfileDetail, ProfilePost, ProfileMessage } from '../lib/api';
import { useAppStore } from '../store/app';
import { open } from '@tauri-apps/plugin-shell';
import { 
  ArrowLeft, 
  MapPin, 
  Briefcase, 
  GraduationCap, 
  Wrench, 
  MessageSquare, 
  Calendar, 
  Heart, 
  MessageCircle, 
  Repeat, 
  ExternalLink, 
  Loader2, 
  AlertCircle,
  User,
  ArrowUpRight,
  ArrowDownLeft
} from 'lucide-react';

export function ProfileDetailView() {
  const { selectedProfileId, closeProfile } = useAppStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'posts' | 'messages'>('overview');

  const { data, isLoading, isError } = useQuery({ 
    queryKey: ['profile-detail', selectedProfileId], 
    queryFn: () => fetchProfileDetail(selectedProfileId!), 
    enabled: !!selectedProfileId 
  });

  const profile = data?.profile;
  const posts = data?.posts || [];
  const messages = data?.messages || [];

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-bg-primary text-text-muted gap-2">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span>Loading profile details...</span>
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-bg-primary text-red-400 gap-2">
        <AlertCircle className="w-6 h-6" />
        <span>Failed to load profile. Please try again.</span>
        <button 
          onClick={closeProfile}
          className="mt-4 px-4 py-2 bg-bg-secondary rounded-lg text-text-primary text-sm hover:bg-bg-tertiary transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-bg-primary">
      <div className="px-6 py-4 border-b border-border-subtle shrink-0 bg-bg-primary/80 backdrop-blur-md sticky top-0 z-10">
        <button 
          onClick={closeProfile}
          className="flex items-center gap-2 text-text-muted hover:text-text-primary transition-colors mb-4 text-sm font-medium group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to Network
        </button>

        <div className="flex items-start justify-between gap-6">
          <div className="flex gap-5">
            <div className="shrink-0 relative">
              {profile.profilePictureUrl ? (
                <img 
                  src={profile.profilePictureUrl} 
                  alt={profile.fullName} 
                  className="w-20 h-20 rounded-full object-cover border-2 border-bg-tertiary shadow-lg"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-bg-tertiary to-bg-elevated flex items-center justify-center text-3xl font-bold text-text-secondary border-2 border-bg-tertiary shadow-lg">
                  {profile.fullName.charAt(0)}
                </div>
              )}
              {profile.isPartial && (
                <div className="absolute -bottom-1 -right-1 bg-bg-primary rounded-full p-1 border border-border-subtle" title="Partial Profile">
                  <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center">
                    <AlertCircle className="w-3 h-3" />
                  </div>
                </div>
              )}
            </div>

            <div className="pt-1">
              <h1 className="text-2xl font-bold text-text-primary leading-tight mb-1">
                {profile.fullName}
              </h1>
              {profile.headline && (
                <p className="text-text-secondary text-sm max-w-xl mb-3 leading-relaxed">
                  {profile.headline}
                </p>
              )}
              
              <div className="flex flex-wrap items-center gap-4 text-sm text-text-muted">
                {(profile.currentTitle || profile.currentCompany) && (
                  <div className="flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5" />
                    <span>
                      {profile.currentTitle}
                      {profile.currentTitle && profile.currentCompany && " at "}
                      {profile.currentCompany}
                    </span>
                  </div>
                )}
                
                {profile.location && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{profile.location}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => open(`https://linkedin.com/in/${profile.publicIdentifier}`)}
            className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-accent-primary/10 text-accent-primary hover:bg-accent-primary/20 transition-colors text-sm font-medium"
          >
            Open on LinkedIn
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-6 mt-8 border-b border-border-subtle">
          {[
            { id: 'overview', label: 'Overview', icon: User },
            { id: 'posts', label: 'Posts', icon: Calendar, count: posts.length },
            { id: 'messages', label: 'Messages', icon: MessageSquare, count: messages.length }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`relative pb-3 text-sm font-medium flex items-center gap-2 transition-colors
                ${activeTab === tab.id ? 'text-accent-primary' : 'text-text-muted hover:text-text-secondary'}`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {typeof tab.count === 'number' && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] 
                  ${activeTab === tab.id ? 'bg-accent-primary/10 text-accent-primary' : 'bg-bg-tertiary text-text-muted'}`}>
                  {tab.count}
                </span>
              )}
              {activeTab === tab.id && (
                <motion.div 
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-primary rounded-t-full"
                />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 scrollbar-hidden">
        <div className="max-w-4xl mx-auto">
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <OverviewTab key="overview" profile={profile} />
            )}
            {activeTab === 'posts' && (
              <PostsTab key="posts" posts={posts} />
            )}
            {activeTab === 'messages' && (
              <MessagesTab key="messages" messages={messages} />
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function OverviewTab({ profile }: { profile: ProfileDetail }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-8"
    >
      {profile.about && (
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-3">About</h2>
          <div className="bg-bg-secondary border border-border-subtle rounded-2xl p-5">
            <p className="text-text-secondary whitespace-pre-wrap leading-relaxed text-sm">
              {profile.about}
            </p>
          </div>
        </section>
      )}

      {profile.experience && profile.experience.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-accent-primary" />
            Experience
          </h2>
          <div className="bg-bg-secondary border border-border-subtle rounded-2xl p-1 overflow-hidden">
            {profile.experience.map((exp, i) => (
              <div key={i} className={`p-4 ${i !== 0 ? 'border-t border-border-subtle' : ''}`}>
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h3 className="font-medium text-text-primary">{exp.title}</h3>
                    <p className="text-sm text-text-secondary">{exp.company}</p>
                    {exp.description && (
                      <p className="text-sm text-text-muted mt-2 whitespace-pre-wrap line-clamp-3">
                        {exp.description}
                      </p>
                    )}
                  </div>
                  <div className="text-xs text-text-muted text-right shrink-0">
                    <div>
                      {exp.startDate} - {exp.endDate || 'Present'}
                    </div>
                    {exp.location && <div>{exp.location}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {profile.education && profile.education.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-accent-primary" />
            Education
          </h2>
          <div className="bg-bg-secondary border border-border-subtle rounded-2xl p-1 overflow-hidden">
            {profile.education.map((edu, i) => (
              <div key={i} className={`p-4 ${i !== 0 ? 'border-t border-border-subtle' : ''}`}>
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h3 className="font-medium text-text-primary">{edu.school}</h3>
                    <p className="text-sm text-text-secondary">
                      {edu.degree} {edu.field && `• ${edu.field}`}
                    </p>
                  </div>
                  {(edu.startYear || edu.endYear) && (
                    <div className="text-xs text-text-muted shrink-0">
                      {edu.startYear} - {edu.endYear}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {profile.skills && profile.skills.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-accent-primary" />
            Skills
          </h2>
          <div className="flex flex-wrap gap-2">
            {profile.skills.map((skill, i) => (
              <span 
                key={i}
                className="px-3 py-1.5 rounded-lg bg-bg-secondary border border-border-subtle text-sm text-text-secondary hover:text-text-primary hover:border-accent-primary/30 transition-colors cursor-default"
              >
                {skill}
              </span>
            ))}
          </div>
        </section>
      )}
    </motion.div>
  );
}

function PostsTab({ posts }: { posts: ProfilePost[] }) {
  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-text-muted gap-3">
        <Calendar className="w-12 h-12 text-bg-tertiary" />
        <span className="font-medium">No posts found</span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-4"
    >
      {posts.map((post) => (
        <div 
          key={post.id}
          className="bg-bg-secondary border border-border-subtle rounded-2xl p-5 hover:border-accent-primary/20 transition-colors"
        >
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs text-text-muted flex items-center gap-1.5 bg-bg-tertiary px-2 py-1 rounded-md">
              <Calendar className="w-3 h-3" />
              {new Date(post.postedAt).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              })}
            </span>
            <button 
              onClick={() => open(post.postUrl)}
              className="text-accent-primary hover:text-accent-primary/80"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
          
          <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed mb-4 line-clamp-5">
            {post.content}
          </p>

          {(post.hasImage || post.hasVideo || post.hasDocument) && (
            <div className="mb-4">
              {post.imageUrls && post.imageUrls.length > 0 && (
                <div className="grid grid-cols-2 gap-1 rounded-xl overflow-hidden">
                  {post.imageUrls.slice(0, 2).map((url, i) => (
                    <img key={i} src={url} alt="" className="w-full h-32 object-cover bg-bg-tertiary" />
                  ))}
                </div>
              )}
            </div>
          )}
          
          <div className="flex items-center gap-6 pt-3 border-t border-border-subtle/50">
            <div className="flex items-center gap-1.5 text-xs text-text-secondary" title="Likes">
              <Heart className="w-3.5 h-3.5" />
              <span>{post.likesCount}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-text-secondary" title="Comments">
              <MessageCircle className="w-3.5 h-3.5" />
              <span>{post.commentsCount}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-text-secondary" title="Reposts">
              <Repeat className="w-3.5 h-3.5" />
              <span>{post.repostsCount}</span>
            </div>
          </div>
        </div>
      ))}
    </motion.div>
  );
}

function MessagesTab({ messages }: { messages: ProfileMessage[] }) {
  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-text-muted gap-3">
        <MessageSquare className="w-12 h-12 text-bg-tertiary" />
        <span className="font-medium">No messages found</span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-4"
    >
      {messages.map((msg) => {
        const isSent = msg.direction === 'sent';
        return (
          <div 
            key={msg.id} 
            className={`flex ${isSent ? 'justify-end' : 'justify-start'}`}
          >
            <div 
              className={`max-w-[80%] rounded-2xl p-4 ${
                isSent 
                  ? 'bg-accent-primary/10 text-text-primary rounded-tr-sm' 
                  : 'bg-bg-secondary border border-border-subtle text-text-primary rounded-tl-sm'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5 opacity-60">
                {isSent ? (
                  <ArrowUpRight className="w-3 h-3" />
                ) : (
                  <ArrowDownLeft className="w-3 h-3" />
                )}
                <span className="text-[10px] font-medium uppercase tracking-wider">
                  {isSent ? 'You sent' : 'Received'}
                </span>
                <span className="text-[10px]">
                  • {new Date(msg.sentAt).toLocaleDateString()}
                </span>
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {msg.content}
              </p>
            </div>
          </div>
        );
      })}
    </motion.div>
  );
}
