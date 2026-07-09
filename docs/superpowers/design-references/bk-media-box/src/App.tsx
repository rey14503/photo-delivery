import { useState, useEffect } from 'react';
import { Album, ActiveTab } from './types';
import { INITIAL_ALBUMS } from './data';
import { PerspectiveBanner } from './components/PerspectiveBanner';
import { DashboardShell } from './components/DashboardShell';
import { PhotographerGallery } from './components/PhotographerGallery';
import { ClientGallery } from './components/ClientGallery';
import { ArrowLeft, Camera, Eye, Sun, Moon } from 'lucide-react';

export default function App() {
  const [albums, setAlbums] = useState<Album[]>(INITIAL_ALBUMS);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>('wedding-duykhoa');
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  
  // Theme state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark';
  });

  // Keep dark class on html tag in sync
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem('theme', next ? 'dark' : 'light');
      return next;
    });
  };

  // Find currently active album
  const activeAlbum = albums.find((a) => a.id === selectedAlbumId) || albums[0];

  const handleSelectAlbum = (albumId: string) => {
    setSelectedAlbumId(albumId);
    setActiveTab('album-detail');
  };

  const handleOpenClientGallery = (shareToken: string) => {
    const matchedAlbum = albums.find((a) => a.shareToken === shareToken);
    if (matchedAlbum) {
      setSelectedAlbumId(matchedAlbum.id);
      setActiveTab('client-gallery');
    }
  };

  const handleUpdateAlbum = (updatedAlbum: Album) => {
    setAlbums((prev) => prev.map((a) => (a.id === updatedAlbum.id ? updatedAlbum : a)));
  };

  const handleAddAlbum = (newAlbum: Album) => {
    setAlbums((prev) => [newAlbum, ...prev]);
    // Optionally open it immediately
    setSelectedAlbumId(newAlbum.id);
    setActiveTab('album-detail');
  };

  const handleDeleteAlbum = (albumId: string) => {
    setAlbums((prev) => prev.filter((a) => a.id !== albumId));
    // If deleted current, fallback to first remaining
    if (selectedAlbumId === albumId) {
      const remaining = albums.filter((a) => a.id !== albumId);
      if (remaining.length > 0) {
        setSelectedAlbumId(remaining[0].id);
      }
    }
  };

  return (
    <div className={`flex flex-col min-h-screen transition-colors duration-300 selection:bg-brand-orange/20 selection:text-brand-orange font-sans antialiased ${
      isDarkMode ? 'bg-gray-950 text-gray-100' : 'bg-gray-50 text-gray-900'
    }`}>
      
      {/* Interactive Perspective Controller */}
      <PerspectiveBanner
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        albumTitle={activeAlbum.title}
      />

      {/* Main Container */}
      <main className="flex-1">
        
        {/* Render Dashboard */}
        {activeTab === 'dashboard' && (
          <DashboardShell
            albums={albums}
            onSelectAlbum={handleSelectAlbum}
            onOpenClientGallery={handleOpenClientGallery}
            onAddAlbum={handleAddAlbum}
            onDeleteAlbum={handleDeleteAlbum}
            isDarkMode={isDarkMode}
            onToggleDarkMode={toggleDarkMode}
          />
        )}

        {/* Render Photographer Detail View */}
        {activeTab === 'album-detail' && (
          <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`inline-flex items-center space-x-2 text-xs font-bold transition-colors cursor-pointer ${
                  isDarkMode ? 'text-gray-400 hover:text-brand-orange' : 'text-gray-600 hover:text-brand-orange'
                }`}
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Quay lại Bảng điều khiển / Back to Dashboard</span>
              </button>

              <div className="flex items-center space-x-3">
                {/* Embedded Theme Switcher for secondary pages */}
                <button
                  onClick={toggleDarkMode}
                  className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                    isDarkMode 
                      ? 'border-white/10 bg-white/5 text-amber-400 hover:text-amber-300' 
                      : 'border-gray-200 bg-white text-gray-500 hover:text-gray-900'
                  }`}
                  title="Đổi giao diện / Change Theme"
                >
                  {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>

                <div className={`flex items-center space-x-1.5 text-xs px-2.5 py-1 rounded-full border ${
                  isDarkMode 
                    ? 'text-brand-orange bg-brand-orange/10 border-brand-orange/20' 
                    : 'text-brand-orange bg-brand-orange/5 border-brand-orange/10'
                }`}>
                  <Camera className="h-3.5 w-3.5" />
                  <span className="font-semibold">Photographer Admin View</span>
                </div>
              </div>
            </div>

            <PhotographerGallery
              album={activeAlbum}
              onUpdateAlbum={handleUpdateAlbum}
            />
          </div>
        )}

        {/* Render Client Gallery Shared View */}
        {activeTab === 'client-gallery' && (
          <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`inline-flex items-center space-x-2 text-xs font-bold transition-colors cursor-pointer ${
                  isDarkMode ? 'text-gray-400 hover:text-brand-orange' : 'text-gray-600 hover:text-brand-orange'
                }`}
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Quay lại Bảng điều khiển / Back to Dashboard</span>
              </button>

              <div className="flex items-center space-x-3">
                {/* Embedded Theme Switcher for secondary pages */}
                <button
                  onClick={toggleDarkMode}
                  className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                    isDarkMode 
                      ? 'border-white/10 bg-white/5 text-amber-400 hover:text-amber-300' 
                      : 'border-gray-200 bg-white text-gray-500 hover:text-gray-900'
                  }`}
                  title="Đổi giao diện / Change Theme"
                >
                  {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>

                <div className={`flex items-center space-x-1.5 text-xs px-2.5 py-1 rounded-full border ${
                  isDarkMode 
                    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' 
                    : 'text-emerald-700 bg-emerald-50 border-emerald-500/10'
                }`}>
                  <Eye className="h-3.5 w-3.5" />
                  <span className="font-semibold">Live Client Preview Mode</span>
                </div>
              </div>
            </div>

            <ClientGallery
              album={activeAlbum}
              onUpdateAlbum={handleUpdateAlbum}
              clientActorName={activeAlbum.clientName}
            />
          </div>
        )}

      </main>

      {/* Footer Area with details of built prototype */}
      <footer className={`py-10 border-t font-sans mt-12 transition-colors duration-300 ${
        isDarkMode ? 'bg-brand-dark border-white/5 text-gray-500' : 'bg-brand-dark text-gray-400 border-white/5'
      }`}>
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center md:text-left">
            <div className="text-sm font-display font-black text-white uppercase tracking-wider">
              BK <span className="text-brand-orange">Media Box</span>
            </div>
            <p className="text-[11px] text-gray-500 font-mono">
              Designed as a premium Google Photos-style delivery engine for professional studios.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] font-mono">
            <span className="bg-white/5 px-2 py-1 rounded text-gray-300 border border-white/5 flex items-center">
              🎨 Tailwind CSS v4
            </span>
            <span className="bg-white/5 px-2 py-1 rounded text-gray-300 border border-white/5 flex items-center">
              ⚙️ Client-side Engine
            </span>
            <span className="bg-white/5 px-2 py-1 rounded text-gray-300 border border-white/5 flex items-center">
              📱 Fluid Responsiveness
            </span>
          </div>

          <div className="text-[10px] text-gray-500 text-center md:text-right">
            <span>&copy; 2026 BK Media Box. All rights reserved.</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
