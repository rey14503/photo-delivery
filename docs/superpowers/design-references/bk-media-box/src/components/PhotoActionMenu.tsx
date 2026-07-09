import React, { useEffect, useRef } from 'react';
import { Photo, ViewRole } from '../types';
import { 
  Heart, 
  Star, 
  Download, 
  MessageSquare, 
  UploadCloud, 
  X,
  AlertCircle 
} from 'lucide-react';

interface PhotoActionMenuProps {
  photo: Photo;
  role: ViewRole;
  canDownload: boolean;
  isOpen: boolean;
  onClose: () => void;
  onToggleSelect: () => void;
  onDownload: () => void;
  onViewComments: () => void;
  onReplace?: () => void; // photographer only
}

export const PhotoActionMenu: React.FC<PhotoActionMenuProps> = ({
  photo,
  role,
  canDownload,
  isOpen,
  onClose,
  onToggleSelect,
  onDownload,
  onViewComments,
  onReplace,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isClient = role === 'client';

  return (
    <div
      ref={menuRef}
      className="absolute right-0 top-10 z-50 w-56 rounded-lg bg-white py-1 shadow-xl ring-1 ring-black/10 focus:outline-none animate-in fade-in slide-in-from-top-2 duration-150"
      role="menu"
      aria-orientation="vertical"
      id={`photo-action-menu-${photo.id}`}
    >
      <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
        <span className="text-[10px] font-mono tracking-wider text-gray-400 uppercase">
          More Actions
        </span>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }} 
          className="text-gray-400 hover:text-gray-600 rounded"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      <div className="p-1 space-y-0.5">
        {/* Toggle Select / Suggest */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect();
            onClose();
          }}
          className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
          role="menuitem"
        >
          {isClient ? (
            <>
              <Heart 
                className={`mr-3 h-4 w-4 ${photo.likedByClient ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} 
              />
              <span className="text-left font-medium">
                {photo.likedByClient ? 'Unselect this photo' : 'Select this photo'}
              </span>
            </>
          ) : (
            <>
              <Star 
                className={`mr-3 h-4 w-4 ${photo.suggestedByPhotographer ? 'fill-amber-500 text-amber-500' : 'text-gray-400'}`} 
              />
              <span className="text-left font-medium">
                {photo.suggestedByPhotographer ? 'Unsuggest to client' : 'Suggest to client'}
              </span>
            </>
          )}
        </button>

        {/* Download Action */}
        {(!isClient || canDownload) ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDownload();
              onClose();
            }}
            className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
            role="menuitem"
          >
            <Download className="mr-3 h-4 w-4 text-gray-400" />
            <span className="text-left font-medium">Download Original</span>
          </button>
        ) : (
          <div className="flex items-center px-3 py-2 text-xs text-gray-400 cursor-not-allowed">
            <AlertCircle className="mr-3 h-4 w-4 text-gray-300 flex-shrink-0" />
            <span className="text-left">Downloads disabled by photographer</span>
          </div>
        )}

        {/* View Comments Action */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onViewComments();
            onClose();
          }}
          className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
          role="menuitem"
        >
          <MessageSquare className="mr-3 h-4 w-4 text-gray-400" />
          <div className="flex items-center justify-between w-full">
            <span className="text-left font-medium">View Comments</span>
            {photo.comments.length > 0 && (
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-orange/10 text-[10px] font-bold text-brand-orange">
                {photo.comments.length}
              </span>
            )}
          </div>
        </button>

        {/* Replace/Update Version Action (Photographer Only) */}
        {!isClient && onReplace && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReplace();
              onClose();
            }}
            className="w-full flex items-center px-3 py-2 text-sm text-brand-orange hover:bg-brand-orange/5 rounded-md transition-colors border-t border-gray-100 mt-1"
            role="menuitem"
          >
            <UploadCloud className="mr-3 h-4 w-4 text-brand-orange" />
            <span className="text-left font-semibold">Replace / Update version</span>
          </button>
        )}
      </div>
    </div>
  );
};
