import React from 'react';
import { ActiveTab } from '../types';
import { Layout, Eye, Camera, Settings, ArrowLeftRight } from 'lucide-react';

interface PerspectiveBannerProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  albumTitle: string;
}

export const PerspectiveBanner: React.FC<PerspectiveBannerProps> = ({
  activeTab,
  setActiveTab,
  albumTitle,
}) => {
  return (
    <div className="bg-brand-dark text-white border-b border-white/5 py-2 px-4 flex flex-col md:flex-row items-center justify-between gap-2 z-40 relative shadow-sm">
      <div className="flex items-center space-x-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-orange text-white text-[10px] font-bold animate-pulse">
          <ArrowLeftRight className="h-3 w-3" />
        </span>
        <div className="text-left">
          <span className="text-[10px] font-bold text-brand-orange uppercase tracking-wider font-mono">
            Interactive Spec Simulator
          </span>
          <p className="text-[11px] text-gray-300 font-sans leading-none">
            Test and toggle between photographer management and client viewing in real time.
          </p>
        </div>
      </div>

      {/* Perspective tabs */}
      <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 space-x-1">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all
            ${activeTab === 'dashboard' ? 'bg-white text-gray-950 shadow-sm font-bold' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
        >
          <Layout className="h-3.5 w-3.5" />
          <span>👨‍🎨 Photographer Dashboard</span>
        </button>

        <button
          onClick={() => setActiveTab('album-detail')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all
            ${activeTab === 'album-detail' ? 'bg-white text-gray-950 shadow-sm font-bold' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
        >
          <Camera className="h-3.5 w-3.5" />
          <span>📸 Studio Album Detail ({albumTitle.split(' ')[0]})</span>
        </button>

        <button
          onClick={() => setActiveTab('client-gallery')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all
            ${activeTab === 'client-gallery' ? 'bg-white text-gray-950 shadow-sm font-bold' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
        >
          <Eye className="h-3.5 w-3.5" />
          <span>👥 Client Web Gallery</span>
        </button>
      </div>

      {/* Active Feature Guideline Tip */}
      <div className="hidden xl:flex items-center space-x-1 bg-white/5 border border-white/5 px-2.5 py-1 rounded-md text-[10px] font-mono text-gray-400">
        <span className="font-bold text-brand-orange">Active Spec:</span>
        <span>
          {activeTab === 'dashboard' && 'ShotPik Dashboard Shell layout + album creation'}
          {activeTab === 'album-detail' && 'Photographer detail view: ⭐ suggestions, file uploader version bumper'}
          {activeTab === 'client-gallery' && 'Client portal: ❤️ selection likes, comment feedback, permissions downloads'}
        </span>
      </div>
    </div>
  );
};
