import React, { useState, useRef } from 'react';
import { Album, Photo, Comment } from '../types';
import { PhotoTile } from './PhotoTile';
import { PhotoLightbox } from './PhotoLightbox';
import { MOCK_REPLACE_POOL } from '../data';
import { 
  Search, 
  Grid3X3, 
  List, 
  Star, 
  Heart, 
  MessageSquare, 
  Sparkles, 
  CheckCircle,
  RefreshCw,
  SlidersHorizontal,
  ChevronDown,
  Lock,
  Globe
} from 'lucide-react';

interface PhotographerGalleryProps {
  album: Album;
  onUpdateAlbum: (updatedAlbum: Album) => void;
}

export const PhotographerGallery: React.FC<PhotographerGalleryProps> = ({
  album,
  onUpdateAlbum,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'suggested' | 'selected' | 'comments'>('all');
  const [sortBy, setSortBy] = useState<'default' | 'version' | 'comments-count'>('default');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isReplacingId, setIsReplacingId] = useState<string | null>(null);
  const [replaceProgress, setReplaceProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hidden file input click state
  const handleReplaceTrigger = (photoId: string) => {
    setIsReplacingId(photoId);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Simulate file upload and version bump
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !isReplacingId) {
      setIsReplacingId(null);
      return;
    }

    const file = e.target.files[0];
    
    // Simulate upload progress
    setReplaceProgress(10);
    const interval = setInterval(() => {
      setReplaceProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + 20;
      });
    }, 150);

    setTimeout(() => {
      clearInterval(interval);
      setReplaceProgress(100);
      
      // Bump the version in the album photo array
      const randomImage = MOCK_REPLACE_POOL[Math.floor(Math.random() * MOCK_REPLACE_POOL.length)];
      
      const updatedPhotos = album.photos.map((photo) => {
        if (photo.id === isReplacingId) {
          const nextVersion = photo.version + 1;
          const newComment: Comment = {
            id: `sys-${Date.now()}`,
            author: 'BK Media (Admin)',
            role: 'photographer',
            text: `Replaced photo with version v${nextVersion} (Uploaded: ${file.name}). Shadow balance calibrated.`,
            timestamp: new Date().toLocaleString('en-US', { hour12: true })
          };
          return {
            ...photo,
            url: randomImage,
            thumbnailUrl: randomImage,
            version: nextVersion,
            comments: [...photo.comments, newComment]
          };
        }
        return photo;
      });

      onUpdateAlbum({
        ...album,
        photos: updatedPhotos
      });

      // Clear replace state
      setTimeout(() => {
        setIsReplacingId(null);
        setReplaceProgress(0);
      }, 300);

    }, 1000);
  };

  const handleToggleSelect = (photoId: string) => {
    const updatedPhotos = album.photos.map((p) => {
      if (p.id === photoId) {
        return {
          ...p,
          suggestedByPhotographer: !p.suggestedByPhotographer
        };
      }
      return p;
    });
    onUpdateAlbum({ ...album, photos: updatedPhotos });
  };

  const handleDownload = (photoId: string) => {
    const photo = album.photos.find(p => p.id === photoId);
    if (photo) {
      // Simulate download
      alert(`📸 Downloading original file for "${photo.title}" (ID: ${photo.id})...`);
    }
  };

  const handleAddComment = (photoId: string, text: string) => {
    const updatedPhotos = album.photos.map((p) => {
      if (p.id === photoId) {
        const newComment: Comment = {
          id: `c-${Date.now()}`,
          author: 'BK Media (Admin)',
          role: 'photographer',
          text,
          timestamp: new Date().toLocaleString('en-US', { hour12: true })
        };
        return {
          ...p,
          comments: [...p.comments, newComment]
        };
      }
      return p;
    });
    onUpdateAlbum({ ...album, photos: updatedPhotos });
  };

  // Filter and Sort implementation
  let processedPhotos = [...album.photos];

  // Search filter
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    processedPhotos = processedPhotos.filter(
      p => p.title.toLowerCase().includes(query) || p.id.toLowerCase().includes(query)
    );
  }

  // Segment filters
  if (filter === 'suggested') {
    processedPhotos = processedPhotos.filter(p => p.suggestedByPhotographer);
  } else if (filter === 'selected') {
    processedPhotos = processedPhotos.filter(p => p.likedByClient);
  } else if (filter === 'comments') {
    processedPhotos = processedPhotos.filter(p => p.comments.length > 0);
  }

  // Sorting
  if (sortBy === 'version') {
    processedPhotos.sort((a, b) => b.version - a.version);
  } else if (sortBy === 'comments-count') {
    processedPhotos.sort((a, b) => b.comments.length - a.comments.length);
  }

  return (
    <div className="space-y-6" id="photographer-gallery-container">
      {/* Hidden file uploader for simulated replacements */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*"
      />

      {/* Uploading overlay */}
      {isReplacingId && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/75 backdrop-blur-sm">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl flex flex-col items-center space-y-4">
            <RefreshCw className="h-10 w-10 text-brand-orange animate-spin" />
            <h3 className="font-display font-semibold text-gray-900 text-base">Uploading New Version...</h3>
            <p className="text-xs text-gray-500 text-center">
              Compiling color tones, bumping version tag, and updating the client delivery pipeline.
            </p>
            <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
              <div 
                className="bg-brand-orange h-full transition-all duration-300"
                style={{ width: `${replaceProgress}%` }}
              />
            </div>
            <span className="text-xs font-mono text-gray-600 font-bold">{replaceProgress}%</span>
          </div>
        </div>
      )}

      {/* Album Specs Card / Banner */}
      <div className="relative rounded-2xl overflow-hidden bg-brand-dark-soft text-white p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between shadow-lg border border-white/5">
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <span className="bg-brand-orange/20 text-brand-orange text-[10px] font-bold px-2 py-0.5 rounded tracking-wider uppercase font-mono border border-brand-orange/25">
              Photographer Mode
            </span>
            <span className="text-gray-400 text-xs font-mono">• ID: {album.id}</span>
          </div>
          <h2 className="text-xl md:text-3xl font-display font-bold tracking-tight text-white">{album.title}</h2>
          <p className="text-xs text-gray-300 flex items-center">
            <span className="font-semibold text-white mr-2">Client Access:</span>
            <span className="bg-white/10 px-2 py-0.5 rounded font-mono select-all text-brand-orange text-[11px] font-bold">
              /a/{album.shareToken}
            </span>
          </p>
          <div className="pt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-400">
            <div>📍 <span className="text-gray-200">{album.location || 'Studio'}</span></div>
            <div>📅 <span className="text-gray-200">{album.date}</span></div>
            <div>📂 <span className="text-gray-200">{album.photos.length} original photos</span></div>
          </div>
        </div>

        {/* Action Column */}
        <div className="mt-4 md:mt-0 flex flex-col items-end space-y-2">
          {/* Download Toggle (Album Level) */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between space-x-6">
            <div className="text-left">
              <div className="text-xs font-semibold text-white flex items-center">
                {album.downloadEnabled ? (
                  <Globe className="h-3.5 w-3.5 text-emerald-400 mr-1.5" />
                ) : (
                  <Lock className="h-3.5 w-3.5 text-amber-400 mr-1.5" />
                )}
                Client Downloads
              </div>
              <p className="text-[10px] text-gray-400">Toggle original files download</p>
            </div>
            <button
              onClick={() => onUpdateAlbum({ ...album, downloadEnabled: !album.downloadEnabled })}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none
                ${album.downloadEnabled ? 'bg-emerald-500' : 'bg-gray-700'}`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out
                  ${album.downloadEnabled ? 'translate-x-5' : 'translate-x-0'}`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Grid Toolbar Controls */}
      <div className="bg-white dark:bg-brand-dark-soft border border-gray-100 dark:border-white/5 rounded-xl p-3 flex flex-col md:flex-row items-center justify-between gap-3 shadow-sm transition-colors duration-300">
        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search photos by title or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-lg focus:bg-white dark:focus:bg-brand-dark text-gray-900 dark:text-white focus:border-brand-orange dark:focus:border-brand-orange focus:outline-none transition-all"
          />
        </div>

        {/* Filter buttons */}
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors
              ${filter === 'all' 
                ? 'bg-brand-dark dark:bg-brand-orange text-white' 
                : 'bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10'}`}
          >
            All Photos ({album.photos.length})
          </button>
          <button
            onClick={() => setFilter('suggested')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1 cursor-pointer transition-colors
              ${filter === 'suggested' 
                ? 'bg-amber-500 text-white' 
                : 'bg-gray-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-100/50 dark:hover:bg-amber-500/20'}`}
          >
            <Star className="h-3.5 w-3.5 fill-current" />
            <span>Recommended ({album.photos.filter(p => p.suggestedByPhotographer).length})</span>
          </button>
          <button
            onClick={() => setFilter('selected')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1 cursor-pointer transition-colors
              ${filter === 'selected' 
                ? 'bg-emerald-600 text-white' 
                : 'bg-gray-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100/50 dark:hover:bg-emerald-500/20'}`}
          >
            <Heart className="h-3.5 w-3.5 fill-current" />
            <span>Selected by Client ({album.photos.filter(p => p.likedByClient).length})</span>
          </button>
          <button
            onClick={() => setFilter('comments')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1 cursor-pointer transition-colors
              ${filter === 'comments' 
                ? 'bg-brand-orange text-white' 
                : 'bg-gray-50 dark:bg-brand-orange/10 text-brand-orange dark:text-brand-orange hover:bg-brand-orange/5 dark:hover:bg-brand-orange/20'}`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>With Comments ({album.photos.filter(p => p.comments.length > 0).length})</span>
          </button>
        </div>

        {/* Sorting Dropdown */}
        <div className="flex items-center space-x-2 w-full md:w-auto justify-end">
          <SlidersHorizontal className="h-4 w-4 text-gray-400" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="text-xs bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-lg p-1.5 focus:outline-none focus:border-brand-orange text-gray-700 dark:text-gray-200 font-semibold cursor-pointer"
          >
            <option value="default" className="dark:bg-brand-dark-soft dark:text-white">Default Order</option>
            <option value="version" className="dark:bg-brand-dark-soft dark:text-white">Sort by Version Bump</option>
            <option value="comments-count" className="dark:bg-brand-dark-soft dark:text-white">Sort by Comments</option>
          </select>
        </div>
      </div>

      {/* Grid List Renderer */}
      {processedPhotos.length === 0 ? (
        <div className="bg-white dark:bg-brand-dark-soft border border-gray-100 dark:border-white/5 rounded-xl p-12 text-center flex flex-col items-center justify-center space-y-3">
          <Search className="h-10 w-10 text-gray-300 dark:text-gray-600 stroke-1" />
          <h3 className="font-display font-semibold text-gray-800 dark:text-white text-base">No Matching Photos Found</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm">
            Adjust your search queries or category filters to list the matching client delivery photo cards.
          </p>
          <button
            onClick={() => { setSearchQuery(''); setFilter('all'); }}
            className="text-xs text-brand-orange font-bold hover:underline"
          >
            Reset all filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {processedPhotos.map((photo, index) => {
            // Find its actual index in the fully complete album photo array to support correct Lightbox mapping
            const actualIndex = album.photos.findIndex(p => p.id === photo.id);
            return (
              <PhotoTile
                key={photo.id}
                photo={photo}
                role="photographer"
                canDownload={true}
                onToggleSelect={() => handleToggleSelect(photo.id)}
                onDownload={() => handleDownload(photo.id)}
                onViewComments={() => setLightboxIndex(actualIndex)}
                onReplace={() => handleReplaceTrigger(photo.id)}
                onClick={() => setLightboxIndex(actualIndex)}
              />
            );
          })}
        </div>
      )}

      {/* Lightbox orchestration */}
      {lightboxIndex !== null && (
        <PhotoLightbox
          photo={album.photos[lightboxIndex]}
          role="photographer"
          canDownload={true}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex(prev => prev !== null && prev > 0 ? prev - 1 : null)}
          onNext={() => setLightboxIndex(next => next !== null && next < album.photos.length - 1 ? next + 1 : null)}
          hasPrev={lightboxIndex > 0}
          hasNext={lightboxIndex < album.photos.length - 1}
          onToggleSelect={() => handleToggleSelect(album.photos[lightboxIndex].id)}
          onDownload={() => handleDownload(album.photos[lightboxIndex].id)}
          onAddComment={handleAddComment}
          onReplace={() => handleReplaceTrigger(album.photos[lightboxIndex].id)}
        />
      )}
    </div>
  );
};
