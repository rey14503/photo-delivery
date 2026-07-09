import React, { useState, useEffect, useRef } from 'react';
import { Photo, ViewRole, Comment } from '../types';
import { PhotoActionMenu } from './PhotoActionMenu';
import { 
  Heart, 
  Star, 
  Download, 
  MessageSquare, 
  MoreHorizontal, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Send,
  User,
  Clock,
  Lock,
  AlertCircle
} from 'lucide-react';

interface PhotoLightboxProps {
  photo: Photo;
  role: ViewRole;
  canDownload: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  onToggleSelect: () => void;
  onDownload: () => void;
  onAddComment: (photoId: string, text: string) => void;
  onReplace?: () => void;
}

export const PhotoLightbox: React.FC<PhotoLightboxProps> = ({
  photo,
  role,
  canDownload,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  onToggleSelect,
  onDownload,
  onAddComment,
  onReplace,
}) => {
  const [isCommentsOpen, setIsCommentsOpen] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const isClient = role === 'client';

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isMenuOpen) {
          setIsMenuOpen(false);
        } else {
          onClose();
        }
      } else if (e.key === 'ArrowLeft' && hasPrev) {
        onPrev();
      } else if (e.key === 'ArrowRight' && hasNext) {
        onNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasPrev, hasNext, onPrev, onNext, onClose, isMenuOpen]);

  // Scroll to bottom of comments when open or when comment count changes
  useEffect(() => {
    if (isCommentsOpen) {
      commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [photo.comments.length, isCommentsOpen]);

  const handleSendComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    onAddComment(photo.id, commentText.trim());
    setCommentText('');
  };

  const handleDownloadClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDownload();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md animate-in fade-in duration-200">
      
      {/* Lightbox Main Split Shell */}
      <div className="flex h-full w-full flex-col lg:flex-row overflow-hidden relative">
        
        {/* Photo Stage (Left Side) */}
        <div className="relative flex flex-1 flex-col items-center justify-center p-4 lg:p-8 select-none min-w-0">
          
          {/* Top Control Overlay on Photo Stage */}
          <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
            {/* Left: Title & File Version info */}
            <div className="rounded-lg bg-black/60 px-3 py-1.5 backdrop-blur-md flex items-center space-x-3 pointer-events-auto">
              <span className="text-sm font-semibold text-white truncate max-w-[180px] sm:max-w-md">
                {photo.title}
              </span>
              {photo.version > 1 && (
                <span className="rounded bg-brand-orange px-1.5 py-0.5 text-[9px] font-bold text-white font-mono uppercase">
                  V{photo.version}
                </span>
              )}
            </div>

            {/* Right: Quick actions toolbar */}
            <div className="flex items-center space-x-2 pointer-events-auto">
              {/* Hearts / Stars Toggle */}
              <button
                onClick={onToggleSelect}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 hover:scale-110 active:scale-95 border border-white/10 transition-all cursor-pointer"
                title={isClient ? "Select Photo" : "Recommend Photo"}
              >
                {isClient ? (
                  <Heart className={`h-5 w-5 ${photo.likedByClient ? 'fill-red-500 text-red-500' : 'text-white'}`} />
                ) : (
                  <Star className={`h-5 w-5 ${photo.suggestedByPhotographer ? 'fill-amber-500 text-amber-500' : 'text-white'}`} />
                )}
              </button>

              {/* Download Quick Button */}
              {(!isClient || canDownload) && (
                <button
                  onClick={handleDownloadClick}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 hover:scale-110 active:scale-95 border border-white/10 transition-all cursor-pointer"
                  title="Download original file"
                >
                  <Download className="h-5 w-5" />
                </button>
              )}

              {/* Comment Toggle Quick Button */}
              <button
                onClick={() => setIsCommentsOpen(!isCommentsOpen)}
                className={`flex h-10 w-10 items-center justify-center rounded-full bg-black/50 border border-white/10 transition-all cursor-pointer hover:scale-110 active:scale-95
                  ${isCommentsOpen ? 'bg-brand-orange text-white border-brand-orange' : 'text-white hover:bg-black/70'}`}
                title="Toggle comments panel"
              >
                <MessageSquare className="h-5 w-5" />
              </button>

              {/* More Actions Dropdown Toggle */}
              <div className="relative">
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className={`flex h-10 w-10 items-center justify-center rounded-full bg-black/50 border border-white/10 transition-all cursor-pointer hover:scale-110 active:scale-95
                    ${isMenuOpen ? 'bg-white text-gray-900 border-white' : 'text-white hover:bg-black/70'}`}
                  title="More actions"
                >
                  <MoreHorizontal className="h-5 w-5" />
                </button>

                <div className="absolute right-0 top-12">
                  <PhotoActionMenu
                    photo={photo}
                    role={role}
                    canDownload={canDownload}
                    isOpen={isMenuOpen}
                    onClose={() => setIsMenuOpen(false)}
                    onToggleSelect={onToggleSelect}
                    onDownload={onDownload}
                    onViewComments={() => setIsCommentsOpen(true)}
                    onReplace={onReplace}
                  />
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-red-600 active:scale-95 border border-white/10 transition-all cursor-pointer ml-2"
                title="Close lightbox (Esc)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Photo Render & Scale */}
          <div className="relative flex flex-1 items-center justify-center w-full h-full max-h-[80vh] lg:max-h-full">
            <img
              src={photo.url}
              alt={photo.title}
              referrerPolicy="no-referrer"
              className="max-h-full max-w-full rounded-md object-contain shadow-2xl transition-all duration-300 pointer-events-auto"
            />
          </div>

          {/* Navigation Controls */}
          {hasPrev && (
            <button
              onClick={onPrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 flex h-12 w-12 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/75 hover:scale-110 transition-all pointer-events-auto border border-white/10"
              title="Previous photo (Left arrow)"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}

          {hasNext && (
            <button
              onClick={onNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 flex h-12 w-12 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/75 hover:scale-110 transition-all pointer-events-auto border border-white/10"
              title="Next photo (Right arrow)"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}

          {/* Bottom Indicators */}
          {!isClient && photo.clientLikers.length > 0 && (
            <div className="absolute bottom-4 left-4 z-10 flex items-center space-x-2 rounded-full bg-emerald-600/90 px-3 py-1 text-xs text-white backdrop-blur-md">
              <Heart className="h-3 w-3 fill-white" />
              <span className="font-semibold">Selected by {photo.clientLikers.join(', ')}</span>
            </div>
          )}

          {isClient && photo.suggestedByPhotographer && (
            <div className="absolute bottom-4 left-4 z-10 flex items-center space-x-2 rounded-full bg-amber-500/95 px-3 py-1 text-xs text-white backdrop-blur-md animate-pulse">
              <Star className="h-3 w-3 fill-white" />
              <span className="font-semibold">Recommended by Photographer</span>
            </div>
          )}
        </div>

        {/* Slide-in Comment Panel (Right Side) */}
        {isCommentsOpen && (
          <div className="w-full lg:w-[380px] bg-white dark:bg-brand-dark-soft text-gray-900 dark:text-white border-t lg:border-t-0 lg:border-l border-gray-100 dark:border-white/5 flex flex-col h-[35vh] lg:h-full z-10 shadow-2xl animate-in slide-in-from-right duration-200 flex-shrink-0">
            
            {/* Panel Header */}
            <div className="p-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <MessageSquare className="h-5 w-5 text-brand-orange" />
                <h3 className="font-display font-semibold text-gray-900 dark:text-white">Comments</h3>
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 dark:bg-white/10 text-xs font-bold text-gray-600 dark:text-gray-300">
                  {photo.comments.length}
                </span>
              </div>
              <button 
                onClick={() => setIsCommentsOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors p-1 hover:bg-gray-50 dark:hover:bg-white/5 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Comment List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {photo.comments.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400 space-y-2">
                  <MessageSquare className="h-8 w-8 stroke-1 text-gray-300" />
                  <p className="text-sm font-medium">No comments yet</p>
                  <p className="text-xs">Start the conversation by sending a feedback comment below.</p>
                </div>
              ) : (
                photo.comments.map((comment) => {
                  const isPhotographer = comment.role === 'photographer';
                  return (
                    <div 
                      key={comment.id} 
                      className={`flex flex-col space-y-1.5 p-3 rounded-lg text-xs border ${
                        isPhotographer 
                          ? 'bg-brand-orange/[0.03] dark:bg-brand-orange/[0.05] border-brand-orange/10 dark:border-brand-orange/20' 
                          : 'bg-emerald-50/30 dark:bg-emerald-500/[0.05] border-emerald-500/10 dark:border-emerald-500/20'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5">
                          <div className={`p-1 rounded-full ${
                            isPhotographer ? 'bg-brand-orange/10 text-brand-orange' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            <User className="h-3 w-3" />
                          </div>
                          <span className="font-semibold text-gray-800 dark:text-gray-200">{comment.author}</span>
                          <span className={`inline-block px-1.5 py-0.5 text-[8px] font-bold rounded uppercase tracking-wider ${
                            isPhotographer ? 'bg-brand-orange text-white' : 'bg-emerald-600 text-white'
                          }`}>
                            {comment.role}
                          </span>
                        </div>
                        <div className="flex items-center text-[10px] text-gray-400">
                          <Clock className="h-2.5 w-2.5 mr-1" />
                          <span>{comment.timestamp.split(', ')[1] || comment.timestamp}</span>
                        </div>
                      </div>
                      <p className="text-gray-700 dark:text-gray-300 leading-relaxed pl-6 font-sans">
                        {comment.text}
                      </p>
                    </div>
                  );
                })
              )}
              <div ref={commentsEndRef} />
            </div>

            {/* Add Comment Form */}
            <form onSubmit={handleSendComment} className="p-3 border-t border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-brand-dark">
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder={`Write as ${isClient ? 'Client...' : 'Photographer...'}`}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="flex-1 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-950 dark:text-white px-3 py-2 text-sm focus:border-brand-orange focus:outline-none transition-colors"
                />
                <button
                  type="submit"
                  disabled={!commentText.trim()}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-orange text-white hover:bg-brand-orange-hover active:scale-95 disabled:bg-gray-200 dark:disabled:bg-white/5 disabled:text-gray-400 dark:disabled:text-gray-600 disabled:scale-100 transition-all cursor-pointer"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-1.5 flex items-center text-[9px] text-gray-400">
                <Lock className="h-2.5 w-2.5 mr-1" />
                <span>Comments are shared in real-time with {isClient ? 'Photographer' : 'Client'}</span>
              </div>
            </form>

          </div>
        )}

      </div>
    </div>
  );
};
