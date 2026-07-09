import React, { useState } from 'react';
import { Photo, ViewRole } from '../types';
import { PhotoActionMenu } from './PhotoActionMenu';
import { Heart, Star, MoreHorizontal, MessageSquare } from 'lucide-react';

interface PhotoTileProps {
  photo: Photo;
  role: ViewRole;
  canDownload: boolean;
  onToggleSelect: () => void;
  onDownload: () => void;
  onViewComments: () => void;
  onReplace?: () => void;
  onClick: () => void; // opens lightbox
}

export const PhotoTile: React.FC<PhotoTileProps> = ({
  photo,
  role,
  canDownload,
  onToggleSelect,
  onDownload,
  onViewComments,
  onReplace,
  onClick,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isClient = role === 'client';

  // Determine aspect ratio class
  let aspectClass = 'aspect-[4/3]';
  if (photo.aspectRatio === 'portrait') {
    aspectClass = 'aspect-[3/4]';
  } else if (photo.aspectRatio === 'square') {
    aspectClass = 'aspect-square';
  }

  const handleSelectClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleSelect();
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <div 
      className="group relative overflow-hidden rounded-xl bg-gray-100 dark:bg-brand-dark-soft shadow-sm ring-1 ring-black/5 dark:ring-white/5 hover:shadow-md transition-all duration-300 flex flex-col cursor-pointer"
      onClick={onClick}
    >
      {/* Photo Container */}
      <div className={`relative w-full overflow-hidden ${aspectClass} bg-gray-200`}>
        <img
          src={photo.thumbnailUrl}
          alt={photo.title}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Hover / Always-visible Overlay for controls */}
        {/* We use group-hover:opacity-100 on desktop, but make it visible if menu is open or on hover:none devices */}
        <div 
          className={`absolute inset-0 bg-black/35 transition-opacity duration-200 flex flex-col justify-between p-3
            ${isMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} 
            @media-hover-none:opacity-100`}
          style={{
            // CSS fallback for devices with no hover: make always visible
            contentVisibility: 'auto'
          }}
        >
          {/* Top row controls */}
          <div className="flex w-full items-center justify-between z-10">
            {/* Quick Toggle Select / Suggest */}
            <button
              onClick={handleSelectClick}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-gray-800 hover:bg-white hover:scale-110 active:scale-95 shadow-md transition-all duration-150 cursor-pointer"
              title={isClient ? (photo.likedByClient ? 'Unselect photo' : 'Select photo') : (photo.suggestedByPhotographer ? 'Unsuggest to client' : 'Suggest to client')}
            >
              {isClient ? (
                <Heart 
                  className={`h-4 w-4 transition-colors ${photo.likedByClient ? 'fill-red-500 text-red-500' : 'text-gray-600 hover:text-red-500'}`} 
                />
              ) : (
                <Star 
                  className={`h-4 w-4 transition-colors ${photo.suggestedByPhotographer ? 'fill-amber-500 text-amber-500' : 'text-gray-600 hover:text-amber-500'}`} 
                />
              )}
            </button>

            {/* Menu Trigger */}
            <div className="relative">
              <button
                onClick={handleMenuClick}
                className={`flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-gray-800 hover:bg-white hover:scale-110 active:scale-95 shadow-md transition-all duration-150 cursor-pointer ${isMenuOpen ? 'bg-white text-brand-orange ring-2 ring-brand-orange/50' : ''}`}
                title="More actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>

              {/* Dropdown Action Menu */}
              <PhotoActionMenu
                photo={photo}
                role={role}
                canDownload={canDownload}
                isOpen={isMenuOpen}
                onClose={() => setIsMenuOpen(false)}
                onToggleSelect={onToggleSelect}
                onDownload={onDownload}
                onViewComments={onViewComments}
                onReplace={onReplace}
              />
            </div>
          </div>

          {/* Bottom row: comment count indicator if any, shown on hover */}
          <div className="flex justify-end pointer-events-none">
            {photo.comments.length > 0 && (
              <div className="flex items-center space-x-1 rounded-md bg-black/60 px-2 py-1 text-[10px] font-medium text-white backdrop-blur-xs">
                <MessageSquare className="h-3 w-3" />
                <span>{photo.comments.length}</span>
              </div>
            )}
          </div>
        </div>

        {/* ALWAYS VISIBLE BADGES (Absolute positions overlayed on image) */}
        
        {/* Top-right (or below top-left) Version Badge */}
        {photo.version > 1 && (
          <div className="absolute bottom-3 left-3 z-10 flex items-center space-x-1 rounded bg-brand-orange px-2 py-0.5 text-[10px] font-bold text-white shadow-sm font-mono tracking-wider">
            <span>V{photo.version}</span>
          </div>
        )}

        {/* Client Likers indicator (only for photographer) - bottom-right of the image overlay */}
        {!isClient && photo.clientLikers.length > 0 && (
          <div className="absolute bottom-3 right-3 z-10 flex items-center space-x-1 rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
            <Heart className="h-2.5 w-2.5 fill-white" />
            <span className="max-w-[120px] truncate">
              {photo.clientLikers.join(', ')}
            </span>
          </div>
        )}

        {/* Suggested indicator (only for client) - bottom-right of the image overlay */}
        {isClient && photo.suggestedByPhotographer && (
          <div className="absolute bottom-3 right-3 z-10 flex items-center space-x-1 rounded bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm animate-pulse">
            <Star className="h-2.5 w-2.5 fill-white" />
            <span>Recommended</span>
          </div>
        )}
      </div>

      {/* Meta info underneath */}
      <div className="p-3 bg-white dark:bg-brand-dark-soft flex-1 flex flex-col justify-between transition-colors">
        <h4 className="text-xs font-semibold text-gray-800 dark:text-gray-200 line-clamp-1">{photo.title}</h4>
        <div className="mt-1 flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 font-mono">
          <span>ID: {photo.id}</span>
          <span className="uppercase">{photo.aspectRatio || 'landscape'}</span>
        </div>
      </div>

      {/* Custom Styles to support @media-hover-none fallback in standard css */}
      <style>{`
        @media (hover: none) {
          .group .absolute.inset-0 {
            opacity: 1 !important;
          }
        }
      `}</style>
    </div>
  );
};
