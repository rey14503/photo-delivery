import React, { useState } from 'react';
import { Album, Photo, Comment } from '../types';
import { PhotoTile } from './PhotoTile';
import { PhotoLightbox } from './PhotoLightbox';
import { 
  Heart, 
  Star, 
  MessageSquare, 
  Download, 
  Search, 
  Globe, 
  Lock, 
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';

interface ClientGalleryProps {
  album: Album;
  onUpdateAlbum: (updatedAlbum: Album) => void;
  clientActorName: string;
}

export const ClientGallery: React.FC<ClientGalleryProps> = ({
  album,
  onUpdateAlbum,
  clientActorName,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'recommended' | 'liked' | 'comments'>('all');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Password Protection States
  const [enteredPassword, setEnteredPassword] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(!album.passwordProtected);
  const [unlockError, setUnlockError] = useState('');

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (enteredPassword === album.password) {
      setIsUnlocked(true);
      setUnlockError('');
    } else {
      setUnlockError('Mật khẩu truy cập không chính xác. Vui lòng thử lại!');
    }
  };

  const handleToggleSelect = (photoId: string) => {
    // Check if we are selecting or unselecting
    const photo = album.photos.find(p => p.id === photoId);
    if (!photo) return;

    const isCurrentlyLiked = photo.likedByClient;

    if (!isCurrentlyLiked && album.maxSelectedLimit && album.maxSelectedCount) {
      const selectedCount = album.photos.filter(p => p.likedByClient).length;
      if (selectedCount >= album.maxSelectedCount) {
        alert(`⚠️ Đã đạt giới hạn chọn tối đa cho album này! Bạn chỉ được phép chọn tối đa ${album.maxSelectedCount} ảnh.`);
        return;
      }
    }

    const updatedPhotos = album.photos.map((p) => {
      if (p.id === photoId) {
        let updatedLikers = [...p.clientLikers];
        
        if (isCurrentlyLiked) {
          // Remove client name from list
          updatedLikers = updatedLikers.filter(name => name !== clientActorName);
        } else {
          // Add client name
          if (!updatedLikers.includes(clientActorName)) {
            updatedLikers.push(clientActorName);
          }
        }

        return {
          ...p,
          likedByClient: !isCurrentlyLiked,
          clientLikers: updatedLikers
        };
      }
      return p;
    });
    onUpdateAlbum({ ...album, photos: updatedPhotos });
  };

  const handleDownloadSingle = (photoId: string) => {
    if (!album.downloadEnabled) {
      alert('🔒 Download permission for this album is currently disabled by the photographer.');
      return;
    }
    const photo = album.photos.find(p => p.id === photoId);
    if (photo) {
      alert(`⬇️ Downloading original file for "${photo.title}" (ID: ${photo.id})...`);
    }
  };

  const handleDownloadAllSelected = () => {
    if (!album.downloadEnabled) {
      alert('🔒 Download permission for this album is disabled by the photographer.');
      return;
    }
    const likedPhotos = album.photos.filter(p => p.likedByClient);
    if (likedPhotos.length === 0) {
      alert('ℹ️ You have not selected any photos yet! Double-click or click the ❤️ icon on your favorites first.');
      return;
    }
    alert(`⚡ Downloading ZIP containing all ${likedPhotos.length} selected favorite photos...`);
  };

  const handleAddComment = (photoId: string, text: string) => {
    const updatedPhotos = album.photos.map((p) => {
      if (p.id === photoId) {
        const newComment: Comment = {
          id: `c-${Date.now()}`,
          author: clientActorName,
          role: 'client',
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

  // Processing photos
  let processedPhotos = [...album.photos];

  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    processedPhotos = processedPhotos.filter(
      p => p.title.toLowerCase().includes(query) || p.id.toLowerCase().includes(query)
    );
  }

  if (filter === 'recommended') {
    processedPhotos = processedPhotos.filter(p => p.suggestedByPhotographer);
  } else if (filter === 'liked') {
    processedPhotos = processedPhotos.filter(p => p.likedByClient);
  } else if (filter === 'comments') {
    processedPhotos = processedPhotos.filter(p => p.comments.length > 0);
  }

  const selectedCount = album.photos.filter(p => p.likedByClient).length;

  if (album.passwordProtected && !isUnlocked) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4 py-12" id="client-gallery-lock-screen">
        <div className="bg-white dark:bg-brand-dark-soft rounded-3xl border border-gray-100 dark:border-white/5 shadow-2xl p-8 max-w-sm w-full text-center space-y-6">
          <div className="mx-auto h-16 w-16 rounded-full bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center text-[#e13b30]">
            <Lock className="h-8 w-8 stroke-[2.5]" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-xl font-display font-black tracking-tight text-gray-900 dark:text-white uppercase">
              Bảo vệ mật khẩu
            </h2>
            <p className="text-xs text-gray-400 max-w-[280px] mx-auto leading-relaxed">
              Album <span className="font-bold text-gray-800 dark:text-gray-200">"{album.title}"</span> đã được thiết lập mã khoá riêng tư để bảo mật ảnh.
            </p>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="space-y-1.5 text-left">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Nhập mật khẩu truy cập
              </label>
              <input
                type="password"
                required
                placeholder="••••••"
                value={enteredPassword}
                onChange={(e) => setEnteredPassword(e.target.value)}
                className="w-full text-center rounded-xl border border-gray-200 dark:border-white/10 px-4 py-2.5 text-sm bg-gray-50 dark:bg-white/5 focus:border-[#e13b30] focus:ring-1 focus:ring-[#e13b30] focus:outline-none font-mono"
              />
            </div>

            {unlockError && (
              <p className="text-[11px] font-semibold text-[#e13b30] dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 py-1.5 px-3 rounded-lg flex items-center justify-center">
                <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                {unlockError}
              </p>
            )}

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-[#e13b30] hover:bg-[#c93228] text-white text-xs font-bold shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
            >
              Mở khoá album
            </button>
          </form>

          {album.password && (
            <div className="pt-2 border-t border-gray-100 dark:border-white/5">
              <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/10">
                💡 Gợi ý mật khẩu: {album.password}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" id="client-gallery-container">
      {/* Client Shared Album Header */}
      <div className="bg-white dark:bg-brand-dark-soft border border-gray-100 dark:border-white/5 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-sm transition-colors duration-300">
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded tracking-wider uppercase font-mono border border-emerald-500/10 dark:border-emerald-500/25 flex items-center">
              <ShieldCheck className="h-3 w-3 mr-1" /> Shared Gallery Access
            </span>
            <span className="text-gray-400 dark:text-gray-500 text-xs font-mono">• Welcome, {clientActorName}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight text-gray-900 dark:text-white">{album.title}</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Delivered by <span className="font-semibold text-brand-orange">BK Media Box</span> • Photographer: Duy Khoa Nguyễn
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-400 dark:text-gray-500">
            <div>📍 <span className="text-gray-600 dark:text-gray-300">{album.location || 'Studio'}</span></div>
            <div>📅 <span className="text-gray-600 dark:text-gray-300">{album.date}</span></div>
            <div>📂 <span className="text-gray-600 dark:text-gray-300">{album.photos.length} photos delivered</span></div>
          </div>
        </div>

        {/* Global Album download controls */}
        <div className="flex flex-col items-stretch sm:items-end space-y-2.5 w-full md:w-auto">
          {album.downloadEnabled ? (
            <button
              onClick={handleDownloadAllSelected}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 rounded-xl bg-brand-orange px-4 py-2.5 text-xs font-bold text-white hover:bg-brand-orange-hover active:scale-95 transition-all shadow-md cursor-pointer"
            >
              <Download className="h-4 w-4" />
              <span>Download Selected Favorites ({selectedCount})</span>
            </button>
          ) : (
            <div className="rounded-xl border border-amber-100 dark:border-amber-500/10 bg-amber-50/50 dark:bg-amber-500/5 p-3 flex items-start space-x-2 max-w-sm text-left">
              <Lock className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-amber-800 dark:text-amber-400">Original Downloads Disabled</p>
                <p className="text-[10px] text-amber-600 dark:text-amber-500/80">The photographer has limited access to compressed preview only. Contact the studio for original delivery.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Grid Toolbar controls */}
      <div className="bg-white dark:bg-brand-dark-soft border border-gray-100 dark:border-white/5 rounded-xl p-3 flex flex-col md:flex-row items-center justify-between gap-3 shadow-sm transition-colors duration-300">
        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search shared photos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-lg focus:bg-white dark:focus:bg-brand-dark text-gray-900 dark:text-white focus:border-brand-orange dark:focus:border-brand-orange focus:outline-none transition-all"
          />
        </div>

        {/* Filter categories */}
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors
              ${filter === 'all' 
                ? 'bg-brand-dark dark:bg-brand-orange text-white' 
                : 'bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10'}`}
          >
            All Shared ({album.photos.length})
          </button>
          <button
            onClick={() => setFilter('recommended')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1 cursor-pointer transition-colors
              ${filter === 'recommended' 
                ? 'bg-amber-500 text-white' 
                : 'bg-gray-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-100/50 dark:hover:bg-amber-500/20'}`}
          >
            <Star className="h-3.5 w-3.5 fill-current" />
            <span>Studio Choice ({album.photos.filter(p => p.suggestedByPhotographer).length})</span>
          </button>
          <button
            onClick={() => setFilter('liked')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1 cursor-pointer transition-colors
              ${filter === 'liked' 
                ? 'bg-red-500 text-white' 
                : 'bg-gray-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/20'}`}
          >
            <Heart className="h-3.5 w-3.5 fill-current" />
            <span>My Selections ({selectedCount})</span>
          </button>
          <button
            onClick={() => setFilter('comments')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1 cursor-pointer transition-colors
              ${filter === 'comments' 
                ? 'bg-brand-orange text-white' 
                : 'bg-gray-50 dark:bg-brand-orange/10 text-brand-orange dark:text-brand-orange hover:bg-brand-orange/5 dark:hover:bg-brand-orange/20'}`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>With Feedback ({album.photos.filter(p => p.comments.length > 0).length})</span>
          </button>
        </div>
      </div>

      {/* Grid List */}
      {processedPhotos.length === 0 ? (
        <div className="bg-white dark:bg-brand-dark-soft border border-gray-100 dark:border-white/5 rounded-xl p-12 text-center flex flex-col items-center justify-center space-y-3">
          <Search className="h-10 w-10 text-gray-300 dark:text-gray-600 stroke-1" />
          <h3 className="font-display font-semibold text-gray-800 dark:text-white text-base">No Matching Photos Found</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm">
            Adjust your search queries or category filters to list the matching shared photos.
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
            const actualIndex = album.photos.findIndex(p => p.id === photo.id);
            return (
              <PhotoTile
                key={photo.id}
                photo={photo}
                role="client"
                canDownload={album.downloadEnabled}
                onToggleSelect={() => handleToggleSelect(photo.id)}
                onDownload={() => handleDownloadSingle(photo.id)}
                onViewComments={() => setLightboxIndex(actualIndex)}
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
          role="client"
          canDownload={album.downloadEnabled}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex(prev => prev !== null && prev > 0 ? prev - 1 : null)}
          onNext={() => setLightboxIndex(next => next !== null && next < album.photos.length - 1 ? next + 1 : null)}
          hasPrev={lightboxIndex > 0}
          hasNext={lightboxIndex < album.photos.length - 1}
          onToggleSelect={() => handleToggleSelect(album.photos[lightboxIndex].id)}
          onDownload={() => handleDownloadSingle(album.photos[lightboxIndex].id)}
          onAddComment={handleAddComment}
        />
      )}
    </div>
  );
};
