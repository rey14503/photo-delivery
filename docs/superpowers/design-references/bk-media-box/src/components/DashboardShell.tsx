import React, { useState } from 'react';
import { Album } from '../types';
import { Logo } from './Logo';
import { 
  Plus, 
  HelpCircle, 
  Bell, 
  Moon, 
  Sun, 
  Search, 
  ArrowUpDown, 
  LayoutGrid, 
  Calendar, 
  Image, 
  Users, 
  ExternalLink, 
  FolderOpen, 
  Trash2, 
  Check, 
  Gift,
  X,
  MapPin,
  Mail,
  ChevronDown,
  LogOut,
  LogIn,
  Settings,
  UploadCloud,
  Globe,
  FileText,
  CheckCircle2,
  Lock,
  Unlock,
  Info,
  Sparkles
} from 'lucide-react';

interface DashboardShellProps {
  albums: Album[];
  onSelectAlbum: (albumId: string) => void;
  onOpenClientGallery: (shareToken: string) => void;
  onAddAlbum: (newAlbum: Album) => void;
  onDeleteAlbum: (albumId: string) => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export const DashboardShell: React.FC<DashboardShellProps> = ({
  albums,
  onSelectAlbum,
  onOpenClientGallery,
  onAddAlbum,
  onDeleteAlbum,
  isDarkMode,
  onToggleDarkMode,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'photos'>('date');
  const [language, setLanguage] = useState<'VI' | 'EN'>('VI');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Authentication State
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    const saved = localStorage.getItem('isLoggedIn');
    return saved !== 'false'; // Defaults to true
  });
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Sign In Form States
  const [loginEmail, setLoginEmail] = useState('khoanguyenfotk5@gmail.com');
  const [loginPassword, setLoginPassword] = useState('123456');

  // Form states matching the exact "Tạo album" mockup from image
  const [googleDriveLink, setGoogleDriveLink] = useState('');
  const [newAlbumTitle, setNewAlbumTitle] = useState('');
  const [newAlbumClientName, setNewAlbumClientName] = useState('');
  const [newAlbumClientEmail, setNewAlbumClientEmail] = useState('');
  const [newAlbumLocation, setNewAlbumLocation] = useState('');
  const [newAlbumCategory, setNewAlbumCategory] = useState<'wedding' | 'fashion' | 'portrait' | 'studio'>('wedding');
  const [customCoverUrl, setCustomCoverUrl] = useState('');
  const [customCoverName, setCustomCoverName] = useState('');

  // Setting Toggles matching image
  const [refreshTime, setRefreshTime] = useState('Không'); // Thời gian làm mới dropdown
  const [commentsEnabled, setCommentsEnabled] = useState(true); // Cho phép bình luận toggle
  const [passwordProtected, setPasswordProtected] = useState(false); // Bảo vệ album bằng mật khẩu toggle
  const [albumPassword, setAlbumPassword] = useState(''); // Mật khẩu của album
  const [downloadEnabled, setDownloadEnabled] = useState(true); // Cho phép tải xuống toggle
  const [maxSelectedLimit, setMaxSelectedLimit] = useState(false); // Giới hạn số lượng ảnh được chọn toggle
  const [maxSelectedCount, setMaxSelectedCount] = useState(50); // Số lượng giới hạn

  const handleFillDemoDriveLink = () => {
    setGoogleDriveLink('https://drive.google.com/drive/folders/1A_B_C_Demo_BK_Media_Box');
    if (!newAlbumTitle) {
      setNewAlbumTitle('Album Ngoại Cảnh Đà Lạt');
    }
    if (!newAlbumClientName) {
      setNewAlbumClientName('Khách Hàng Nguyễn Văn A');
    }
  };

  const handleSimulateCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCustomCoverName(file.name);
      // Generate a temporary object URL to show it
      const url = URL.createObjectURL(file);
      setCustomCoverUrl(url);
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggedIn(true);
    localStorage.setItem('isLoggedIn', 'true');
    setIsLoginModalOpen(false);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.setItem('isLoggedIn', 'false');
    setIsProfileOpen(false);
  };

  const handleCreateAlbumSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlbumTitle.trim() || !newAlbumClientName.trim()) {
      alert('Vui lòng điền đầy đủ Tên Album và Tên Khách Hàng!');
      return;
    }

    // Map cover images based on chosen category if no custom cover was uploaded
    const covers = {
      wedding: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&auto=format&fit=crop&q=80',
      fashion: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&auto=format&fit=crop&q=80',
      portrait: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80',
      studio: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&auto=format&fit=crop&q=80'
    };

    const newAlbumId = `album-${Date.now()}`;
    const shareToken = `share-${Math.random().toString(36).substring(2, 8)}`;

    const newAlbum: Album = {
      id: newAlbumId,
      title: newAlbumTitle.trim(),
      date: new Date().toLocaleDateString('vi-VN', { year: 'numeric', month: 'long', day: 'numeric' }),
      location: newAlbumLocation.trim() || 'BK Studio',
      coverUrl: customCoverUrl || covers[newAlbumCategory],
      photosCount: 3,
      downloadEnabled: downloadEnabled,
      clientName: newAlbumClientName.trim(),
      clientEmail: newAlbumClientEmail.trim() || 'client@gmail.com',
      shareToken: shareToken,
      googleDriveLink: googleDriveLink.trim() || undefined,
      refreshTime: refreshTime,
      commentsEnabled: commentsEnabled,
      passwordProtected: passwordProtected,
      password: passwordProtected ? albumPassword : undefined,
      maxSelectedLimit: maxSelectedLimit,
      maxSelectedCount: maxSelectedLimit ? maxSelectedCount : undefined,
      photos: [
        {
          id: `${newAlbumId}-p1`,
          url: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=1200&auto=format&fit=crop&q=80',
          thumbnailUrl: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400&auto=format&fit=crop&q=80',
          title: 'Initial Shot A',
          version: 1,
          suggestedByPhotographer: true,
          likedByClient: false,
          clientLikers: [],
          aspectRatio: 'landscape',
          comments: []
        },
        {
          id: `${newAlbumId}-p2`,
          url: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=1200&auto=format&fit=crop&q=80',
          thumbnailUrl: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=400&auto=format&fit=crop&q=80',
          title: 'Initial Shot B',
          version: 1,
          suggestedByPhotographer: false,
          likedByClient: false,
          clientLikers: [],
          aspectRatio: 'portrait',
          comments: []
        },
        {
          id: `${newAlbumId}-p3`,
          url: 'https://images.unsplash.com/photo-1513829096999-4978602297a7?w=1200&auto=format&fit=crop&q=80',
          thumbnailUrl: 'https://images.unsplash.com/photo-1513829096999-4978602297a7?w=400&auto=format&fit=crop&q=80',
          title: 'Initial Shot C',
          version: 1,
          suggestedByPhotographer: false,
          likedByClient: false,
          clientLikers: [],
          aspectRatio: 'square',
          comments: []
        }
      ]
    };

    onAddAlbum(newAlbum);

    // Reset Form
    setGoogleDriveLink('');
    setNewAlbumTitle('');
    setNewAlbumClientName('');
    setNewAlbumClientEmail('');
    setNewAlbumLocation('');
    setCustomCoverUrl('');
    setCustomCoverName('');
    setRefreshTime('Không');
    setCommentsEnabled(true);
    setPasswordProtected(false);
    setAlbumPassword('');
    setDownloadEnabled(true);
    setMaxSelectedLimit(false);
    setMaxSelectedCount(50);
    setIsCreateModalOpen(false);
  };

  // Processing albums (search + sort)
  let processedAlbums = [...albums];

  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    processedAlbums = processedAlbums.filter(
      a => a.title.toLowerCase().includes(query) || a.clientName.toLowerCase().includes(query)
    );
  }

  if (sortBy === 'title') {
    processedAlbums.sort((a, b) => a.title.localeCompare(b.title));
  } else if (sortBy === 'photos') {
    processedAlbums.sort((a, b) => b.photos.length - a.photos.length);
  } else {
    // default: date descending (our order is fine or sorting)
    processedAlbums.sort((a, b) => b.id.localeCompare(a.id));
  }

  const handleRewardClick = () => {
    alert('🎁 Reward Program: You have received a loyalty voucher from BK Media Box for 50GB extra cloud storage!');
  };

  const handleWebsiteSettingsClick = () => {
    alert('🌐 Website Settings: Configure domain integration, custom HTML templates, and white-label client watermarks for BK Media Box.');
  };

  return (
    <div className={`space-y-6 min-h-screen pb-12 ${isDarkMode ? 'bg-gray-950 text-gray-100' : 'bg-gray-50 text-gray-900'}`} id="dashboard-shell-container">
      
      {/* 1. ShotPik Top Nav Bar */}
      <nav className={`sticky top-0 z-30 flex items-center justify-between border-b px-4 py-3 md:px-8 shadow-xs transition-colors duration-300 ${
        isDarkMode ? 'bg-brand-dark-soft border-white/5 text-white' : 'bg-white border-gray-100 text-gray-900'
      }`}>
        {/* Left: Beautiful Logo Vector matching BK Media */}
        <Logo />

        {/* Center: Action CTAs */}
        <div className="hidden sm:flex items-center space-x-2.5">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center space-x-1.5 rounded-full bg-brand-orange px-4 py-2 text-xs font-bold text-white hover:bg-brand-orange-hover active:scale-95 transition-all shadow-sm cursor-pointer"
          >
            <Plus className="h-4 w-4 stroke-[3]" />
            <span>Tạo album</span>
          </button>
          <button
            onClick={handleWebsiteSettingsClick}
            className={`inline-flex items-center space-x-1.5 rounded-full border px-4 py-2 text-xs font-bold active:scale-95 transition-all cursor-pointer ${
              isDarkMode 
                ? 'border-white/10 bg-white/5 text-gray-200 hover:bg-white/10' 
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span>Thiết lập website</span>
          </button>
        </div>

        {/* Right: Utility Indicators */}
        <div className="flex items-center space-x-3 text-gray-500">
          <button 
            onClick={() => alert('BK Media Box Helpdesk & User Guide centers are available 24/7.')} 
            className={`transition-colors cursor-pointer ${isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`} 
            title="Hỗ trợ"
          >
            <HelpCircle className="h-5 w-5" />
          </button>
          <button 
            onClick={() => alert('No new notifications')} 
            className={`relative transition-colors cursor-pointer ${isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`} 
            title="Thông báo"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-red-500" />
          </button>
          
          {/* Language Toggle */}
          <button
            onClick={() => setLanguage(lang => lang === 'VI' ? 'EN' : 'VI')}
            className={`text-xs font-bold px-2 py-0.5 rounded-md cursor-pointer select-none border transition-colors ${
              isDarkMode 
                ? 'border-white/10 text-gray-300 hover:text-white hover:bg-white/5' 
                : 'border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
            title="Ngôn ngữ / Language"
          >
            {language}
          </button>

          {/* Dark Mode toggle */}
          <button
            onClick={onToggleDarkMode}
            className={`transition-colors cursor-pointer ${isDarkMode ? 'text-amber-400 hover:text-amber-300' : 'text-gray-500 hover:text-gray-900'}`}
            title="Giao diện"
          >
            {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          <div className={`h-4 w-[1px] hidden md:block ${isDarkMode ? 'bg-white/10' : 'bg-gray-200'}`} />

          {/* User profile with Dropdown */}
          {isLoggedIn ? (
            <div className="relative">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className={`flex items-center space-x-1.5 rounded-full p-1 transition-colors focus:outline-none cursor-pointer ${
                  isDarkMode ? 'hover:bg-white/5' : 'hover:bg-gray-100'
                }`}
                id="user-profile-menu-trigger"
              >
                <div className="relative">
                  <div className="h-8 w-8 rounded-full bg-brand-orange text-white flex items-center justify-center font-bold text-xs shadow-sm">
                    DK
                  </div>
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-brand-dark-soft" />
                </div>
                <span className={`text-xs font-bold hidden md:inline-block ${isDarkMode ? 'text-gray-300' : 'text-gray-800'}`}>
                  Duy Khoa Nguyễn
                </span>
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </button>

              {/* Profile Menu Dropdown */}
              {isProfileOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsProfileOpen(false)} />
                  <div className={`absolute right-0 mt-2.5 w-64 rounded-xl border shadow-xl z-50 py-1 transition-all ${
                    isDarkMode ? 'bg-brand-dark-soft border-white/5 text-white' : 'bg-white border-gray-100 text-gray-900'
                  }`} id="user-profile-dropdown-menu">
                    {/* Account detail */}
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-white/5 flex items-center space-x-3">
                      <div className="h-10 w-10 rounded-full bg-brand-orange/10 text-brand-orange flex items-center justify-center font-bold text-sm">
                        DK
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold truncate">Duy Khoa Nguyễn</p>
                        <p className="text-[10px] text-gray-500 truncate">khoanguyenfotk5@gmail.com</p>
                        <span className="inline-flex mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/30">
                          Chủ Studio (PRO)
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="py-1">
                      <button
                        onClick={() => {
                          setIsProfileOpen(false);
                          handleWebsiteSettingsClick();
                        }}
                        className="w-full text-left px-4 py-2 text-xs flex items-center space-x-2.5 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-200 cursor-pointer"
                      >
                        <Settings className="h-4 w-4 opacity-70 text-gray-400" />
                        <span>Quản lý website</span>
                      </button>
                      <button
                        onClick={() => {
                          setIsProfileOpen(false);
                          handleRewardClick();
                        }}
                        className="w-full text-left px-4 py-2 text-xs flex items-center space-x-2.5 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-200 cursor-pointer"
                      >
                        <Gift className="h-4 w-4 opacity-70 text-amber-500" />
                        <span>Nhận thưởng 50GB</span>
                      </button>
                      <button
                        onClick={() => {
                          setIsProfileOpen(false);
                          alert('Hỗ trợ: khoanguyenfotk5@gmail.com (Hỗ trợ 24/7)');
                        }}
                        className="w-full text-left px-4 py-2 text-xs flex items-center space-x-2.5 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-200 cursor-pointer"
                      >
                        <HelpCircle className="h-4 w-4 opacity-70 text-gray-400" />
                        <span>Hỗ trợ kỹ thuật</span>
                      </button>
                    </div>

                    <div className="border-t border-gray-100 dark:border-white/5 my-1" />

                    {/* Log Out */}
                    <div className="px-1 py-0.5">
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-3 py-2 rounded-lg text-xs flex items-center space-x-2.5 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-600 dark:text-red-400 font-semibold cursor-pointer"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>Đăng xuất</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={() => setIsLoginModalOpen(true)}
              className="inline-flex items-center space-x-1.5 rounded-full bg-brand-orange hover:bg-brand-orange-hover px-4 py-1.5 text-xs font-bold text-white transition-all active:scale-95 cursor-pointer"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Đăng nhập</span>
            </button>
          )}
        </div>
      </nav>

      {/* Main shell contents */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 space-y-6">

        {/* 2. ShotPik Stats & Toolbar Row */}
        <div className={`flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 border-b pb-5 transition-colors ${
          isDarkMode ? 'border-white/5 text-gray-300' : 'border-gray-100 text-gray-500'
        }`}>
          {/* Stats Counters Grid (ShotPik copy) */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-xs">
            <div className="flex items-center space-x-2">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-orange" />
              <span>Tổng số album đã tạo:</span>
              <strong className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{albums.length}</strong>
            </div>
            <div className={`h-4 w-[1px] hidden sm:block ${isDarkMode ? 'bg-white/10' : 'bg-gray-200'}`} />
            <div className="flex items-center space-x-2">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              <span>Số album tạo mới trong tháng này:</span>
              <strong className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{albums.length}/5</strong>
            </div>
            <div className={`h-4 w-[1px] hidden sm:block ${isDarkMode ? 'bg-white/10' : 'bg-gray-200'}`} />
            <div className="flex items-center space-x-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>Số website album tạo mới trong tháng này:</span>
              <strong className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>1/1</strong>
            </div>

            {/* Gift/Reward CTA button */}
            <button
              onClick={handleRewardClick}
              className="inline-flex items-center space-x-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 px-3 py-1.5 rounded-full font-bold transition-all animate-bounce cursor-pointer"
            >
              <Gift className="h-3.5 w-3.5" />
              <span>Nhận thưởng</span>
            </button>
          </div>

          {/* Sắp xếp (Sort) and Search (Tìm kiếm) */}
          <div className="flex flex-wrap items-center gap-3 justify-end">
            {/* Sorting Dropdown */}
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold">Sắp xếp:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className={`text-xs border rounded-lg p-1.5 focus:outline-none focus:border-brand-orange font-bold cursor-pointer shadow-2xs transition-colors ${
                  isDarkMode 
                    ? 'bg-white/5 border-white/10 text-white focus:bg-brand-dark-soft' 
                    : 'bg-white border-gray-200 text-gray-700'
                }`}
              >
                <option value="date" className={isDarkMode ? 'bg-brand-dark text-white' : ''}>Ngày tạo mới nhất</option>
                <option value="title" className={isDarkMode ? 'bg-brand-dark text-white' : ''}>Tên album (A-Z)</option>
                <option value="photos" className={isDarkMode ? 'bg-brand-dark text-white' : ''}>Số lượng ảnh (Nhiều nhất)</option>
              </select>
            </div>

            {/* View Mode indicator (Simulated) */}
            <div className={`flex items-center border rounded-lg p-0.5 shadow-2xs ${
              isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200'
            }`}>
              <button className={`p-1 rounded ${isDarkMode ? 'bg-white/10 text-brand-orange' : 'bg-gray-100 text-brand-orange'}`} title="Cách hiển thị: Lưới">
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>

            {/* Search Box */}
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Tìm kiếm..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-8 pr-3 py-1.5 text-xs border rounded-lg focus:border-brand-orange focus:outline-none transition-all shadow-2xs ${
                  isDarkMode 
                    ? 'bg-white/5 border-white/10 text-white focus:bg-white/10' 
                    : 'bg-white border-gray-200 text-gray-900 focus:bg-white'
                }`}
              />
            </div>
          </div>
        </div>

        {/* 3. Cards Grid: first card is Create, followed by actual Album cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          
          {/* First Tile: DASHED CREATE BUTTON (ShotPik design) */}
          <div
            onClick={() => setIsCreateModalOpen(true)}
            className={`flex flex-col items-center justify-center p-6 min-h-[280px] rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer text-center group ${
              isDarkMode 
                ? 'border-emerald-500/30 bg-emerald-500/[0.01] hover:bg-emerald-500/[0.04] hover:border-emerald-500' 
                : 'border-emerald-500 bg-emerald-500/[0.02] hover:bg-emerald-500/[0.04]'
            }`}
          >
            <div className={`h-12 w-12 rounded-full flex items-center justify-center group-hover:scale-110 transition-all shadow-xs mb-3 ${
              isDarkMode ? 'bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20' : 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100'
            }`}>
              <Plus className="h-6 w-6 stroke-[3]" />
            </div>
            <span className={`text-sm font-display font-bold ${isDarkMode ? 'text-emerald-400' : 'text-emerald-800'}`}>Tạo album</span>
            <p className={`text-[10px] mt-1 max-w-[150px] ${isDarkMode ? 'text-emerald-500/70' : 'text-emerald-600'}`}>
              Tải ảnh, tạo liên kết và chia sẻ cho khách hàng duyệt ngay.
            </p>
          </div>

          {/* Actual Album Cards */}
          {processedAlbums.map((album) => (
            <div 
              key={album.id}
              className={`group flex flex-col rounded-2xl overflow-hidden shadow-xs ring-1 transition-all duration-300 ${
                isDarkMode 
                  ? 'bg-brand-dark-soft ring-white/[0.04] hover:shadow-[0_0_15px_rgba(255,87,34,0.15)] hover:ring-brand-orange/30' 
                  : 'bg-white ring-black/[0.04] hover:shadow-md'
              }`}
            >
              {/* Cover Image Container */}
              <div className="relative aspect-[3/2] overflow-hidden bg-gray-100">
                <img
                  src={album.coverUrl}
                  alt={album.title}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                
                {/* Overlay Action Buttons */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center space-x-2">
                  <button
                    onClick={() => onSelectAlbum(album.id)}
                    className="inline-flex items-center space-x-1 bg-white hover:bg-brand-orange hover:text-white text-gray-900 text-xs font-bold px-3 py-1.5 rounded-lg transition-all shadow-lg cursor-pointer"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    <span>Chi tiết</span>
                  </button>
                  <button
                    onClick={() => onOpenClientGallery(album.shareToken)}
                    className="inline-flex items-center space-x-1 bg-brand-dark hover:bg-gray-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all shadow-lg cursor-pointer"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Xem Web</span>
                  </button>
                </div>

                {/* Badges */}
                <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md text-white rounded px-2 py-0.5 text-[9px] font-mono font-semibold">
                  {album.photos.length} PHOTOS
                </div>
                
                {/* Delete button (photographer delete) */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`❌ Are you sure you want to delete album "${album.title}"?`)) {
                      onDeleteAlbum(album.id);
                    }
                  }}
                  className="absolute top-3 right-3 h-7 w-7 rounded-full bg-black/50 text-white hover:bg-red-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow cursor-pointer"
                  title="Xóa album"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Album Info */}
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className={`font-display font-bold text-sm transition-colors line-clamp-1 group-hover:text-brand-orange ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    {album.title}
                  </h3>
                  
                  <div className={`mt-2.5 space-y-1 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    <div className="flex items-center">
                      <Users className="h-3.5 w-3.5 mr-2 text-gray-400" />
                      <span className={`font-semibold truncate ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>{album.clientName}</span>
                    </div>
                    <div className="flex items-center text-[11px]">
                      <Mail className="h-3.5 w-3.5 mr-2 text-gray-400" />
                      <span className="truncate">{album.clientEmail}</span>
                    </div>
                    {album.location && (
                      <div className="flex items-center text-[11px]">
                        <MapPin className="h-3.5 w-3.5 mr-2 text-gray-400" />
                        <span className="truncate">{album.location}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className={`mt-4 pt-3 border-t flex items-center justify-between text-[10px] font-mono font-semibold ${
                  isDarkMode ? 'border-white/5 text-gray-400' : 'border-gray-100 text-gray-500'
                }`}>
                  <div className="flex items-center">
                    <Calendar className="h-3 w-3 mr-1" />
                    <span>{album.date}</span>
                  </div>
                  <span className={`uppercase px-1.5 py-0.5 rounded ${
                    isDarkMode ? 'text-emerald-400 bg-emerald-500/10' : 'text-emerald-600 bg-emerald-50'
                  }`}>
                    {album.downloadEnabled ? 'Download On' : 'Preview Only'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* 4. Beautiful Redesigned Create Album Modal popup Form (Matches Screenshot) */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-brand-dark-soft rounded-3xl max-w-[460px] w-full overflow-hidden shadow-2xl border border-gray-100 dark:border-white/5 animate-in zoom-in-95 duration-200 text-gray-900 dark:text-white">
            
            {/* Header */}
            <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100 dark:border-white/5">
              <h3 className="text-xl font-display font-bold text-[#e13b30] dark:text-rose-500 tracking-tight">
                Tạo album
              </h3>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateAlbumSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              
              {/* Google Drive Link input with helper & cyan plus button */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center">
                  <span className="text-[#e13b30] mr-1">*</span>
                  Link ảnh Google Drive
                  <span 
                    className="ml-1 text-gray-400 hover:text-[#e13b30] cursor-pointer relative group"
                    onClick={() => alert('Dán liên kết thư mục chứa ảnh trên Google Drive vào đây để hệ thống tự động đồng bộ ảnh vào album của khách.')}
                  >
                    <HelpCircle className="h-3.5 w-3.5 inline" />
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block w-48 p-2 bg-gray-900 text-[10px] text-white rounded shadow-lg z-50 font-normal leading-normal">
                      Nhấp để xem hướng dẫn đồng bộ Google Drive.
                    </span>
                  </span>
                </label>
                
                <div className="flex items-center space-x-2">
                  <input
                    type="url"
                    placeholder="Link Google Drive thư mục chứa ảnh vào đây"
                    value={googleDriveLink}
                    onChange={(e) => setGoogleDriveLink(e.target.value)}
                    className="flex-1 rounded-xl border border-gray-200 dark:border-white/10 px-3.5 py-2.5 text-xs focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white transition-all placeholder:text-gray-400"
                  />
                  <button
                    type="button"
                    onClick={handleFillDemoDriveLink}
                    title="Tự động điền link mẫu Google Drive"
                    className="p-2.5 rounded-xl bg-[#00c5a2] hover:bg-[#00af8f] text-white font-bold transition-all hover:scale-105 active:scale-95 shadow-xs cursor-pointer"
                  >
                    <Plus className="h-4.5 w-4.5 stroke-[3]" />
                  </button>
                </div>
              </div>

              {/* Album Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center">
                  <span className="text-[#e13b30] mr-1">*</span>
                  Tên album
                </label>
                <input
                  type="text"
                  required
                  placeholder="Tên album"
                  value={newAlbumTitle}
                  onChange={(e) => setNewAlbumTitle(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 dark:border-white/10 px-3.5 py-2.5 text-xs focus:border-rose-500 focus:ring-1 focus:ring-rose-500 focus:outline-none bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white transition-all placeholder:text-gray-400"
                />
              </div>

              {/* Client Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center">
                  <span className="text-[#e13b30] mr-1">*</span>
                  Tên khách hàng
                </label>
                <input
                  type="text"
                  required
                  placeholder="Tên khách hàng"
                  value={newAlbumClientName}
                  onChange={(e) => setNewAlbumClientName(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 dark:border-white/10 px-3.5 py-2.5 text-xs focus:border-rose-500 focus:ring-1 focus:ring-rose-500 focus:outline-none bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white transition-all placeholder:text-gray-400"
                />
              </div>

              {/* Client Email & Location Info */}
              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                    Email khách hàng
                  </label>
                  <input
                    type="email"
                    placeholder="client@gmail.com"
                    value={newAlbumClientEmail}
                    onChange={(e) => setNewAlbumClientEmail(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 dark:border-white/10 px-3 py-2 text-xs focus:border-rose-500 focus:ring-1 focus:ring-rose-500 focus:outline-none bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white transition-all placeholder:text-gray-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                    Địa điểm chụp
                  </label>
                  <input
                    type="text"
                    placeholder="Địa điểm chụp..."
                    value={newAlbumLocation}
                    onChange={(e) => setNewAlbumLocation(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 dark:border-white/10 px-3 py-2 text-xs focus:border-rose-500 focus:ring-1 focus:ring-rose-500 focus:outline-none bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white transition-all placeholder:text-gray-400"
                  />
                </div>
              </div>

              {/* Album Cover & Preset Selector */}
              <div className="flex items-center justify-between gap-4 py-2 border-b border-gray-100 dark:border-white/5">
                <div className="flex-1">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center">
                    <span className="text-[#e13b30] mr-1">*</span>
                    Chọn ảnh bìa album
                  </label>
                  <p className="text-[10px] text-gray-400 mt-1">Preset thể loại: {newAlbumCategory.toUpperCase()}</p>
                  <div className="flex gap-1 mt-1.5">
                    {['wedding', 'fashion', 'portrait', 'studio'].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          setNewAlbumCategory(cat as any);
                          setCustomCoverUrl('');
                          setCustomCoverName('');
                        }}
                        className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                          newAlbumCategory === cat && !customCoverUrl
                            ? 'bg-rose-50 border-[#e13b30] text-[#e13b30]'
                            : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/5 text-gray-500 dark:text-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Upload Area for Cover Image */}
                <div className="w-[160px]">
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 dark:border-white/10 hover:border-brand-orange hover:bg-rose-50/5 rounded-2xl p-4 cursor-pointer text-center transition-colors group relative h-20">
                    <UploadCloud className="h-5 w-5 text-gray-400 group-hover:text-brand-orange mb-1" />
                    <span className="text-[9px] text-gray-400 font-bold truncate max-w-[130px]">
                      {customCoverName || 'Tải ảnh lên'}
                    </span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleSimulateCoverUpload} 
                      className="hidden" 
                    />
                  </label>
                </div>
              </div>

              {/* Settings Rows matching exact layout */}
              
              {/* 1. Thời gian làm mới Dropdown */}
              <div className="flex items-center justify-between py-1">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Thời gian làm mới
                </span>
                <select
                  value={refreshTime}
                  onChange={(e) => setRefreshTime(e.target.value)}
                  className="rounded-lg border border-gray-200 dark:border-white/10 px-3 py-1.5 text-xs focus:border-rose-500 focus:outline-none bg-gray-50 dark:bg-white/5 text-gray-700 dark:text-gray-200 font-medium cursor-pointer"
                >
                  <option value="Không">Không</option>
                  <option value="1 ngày">1 ngày</option>
                  <option value="3 ngày">3 ngày</option>
                  <option value="1 tuần">1 tuần</option>
                </select>
              </div>

              {/* 2. Cho phép bình luận Toggle */}
              <div className="flex items-center justify-between py-1">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Cho phép bình luận
                </span>
                <button
                  type="button"
                  onClick={() => setCommentsEnabled(!commentsEnabled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    commentsEnabled ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-white/10'
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    commentsEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {/* 3. Bảo vệ album bằng mật khẩu Toggle */}
              <div className="space-y-2">
                <div className="flex items-center justify-between py-1">
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Bảo vệ album bằng mật khẩu
                  </span>
                  <button
                    type="button"
                    onClick={() => setPasswordProtected(!passwordProtected)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      passwordProtected ? 'bg-rose-500' : 'bg-gray-200 dark:bg-white/10'
                    }`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      passwordProtected ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
                {passwordProtected && (
                  <div className="pl-4 border-l-2 border-rose-200 animate-in slide-in-from-top duration-150">
                    <input
                      type="text"
                      placeholder="Nhập mật khẩu truy cập album..."
                      value={albumPassword}
                      onChange={(e) => setAlbumPassword(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 dark:border-white/10 px-3 py-1.5 text-xs bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white"
                    />
                  </div>
                )}
              </div>

              {/* 4. Cho phép tải xuống Toggle */}
              <div className="flex items-center justify-between py-1">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Cho phép tải xuống
                </span>
                <button
                  type="button"
                  onClick={() => setDownloadEnabled(!downloadEnabled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    downloadEnabled ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-white/10'
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    downloadEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {/* 5. Giới hạn số lượng ảnh được chọn Toggle */}
              <div className="space-y-2">
                <div className="flex items-center justify-between py-1">
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Giới hạn số lượng ảnh được chọn
                  </span>
                  <button
                    type="button"
                    onClick={() => setMaxSelectedLimit(!maxSelectedLimit)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      maxSelectedLimit ? 'bg-rose-500' : 'bg-gray-200 dark:bg-white/10'
                    }`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      maxSelectedLimit ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
                {maxSelectedLimit && (
                  <div className="pl-4 border-l-2 border-rose-200 animate-in slide-in-from-top duration-150 flex items-center space-x-2">
                    <span className="text-xs text-gray-500">Giới hạn:</span>
                    <input
                      type="number"
                      min="1"
                      value={maxSelectedCount}
                      onChange={(e) => setMaxSelectedCount(parseInt(e.target.value) || 50)}
                      className="w-20 rounded-lg border border-gray-200 dark:border-white/10 px-3 py-1 text-xs bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white"
                    />
                    <span className="text-xs text-gray-500">ảnh</span>
                  </div>
                )}
              </div>

              {/* Bottom Action Buttons */}
              <div className="pt-4 border-t border-gray-100 dark:border-white/5 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-5 py-2 rounded-xl border border-gray-200 dark:border-white/10 text-xs font-bold text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl bg-[#e13b30] hover:bg-[#c93228] text-white text-xs font-bold shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
                >
                  Tạo ngay
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Elegant user Sign-In modal if logged out */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-brand-dark-soft rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl border border-gray-100 dark:border-white/5 animate-in zoom-in-95 duration-200 p-6 text-gray-900 dark:text-white">
            <div className="flex flex-col items-center text-center">
              {/* Logo badge load */}
              <img
                src="/logo_badge.svg"
                className="h-28 w-28 object-contain mb-3"
                alt="BK Media Badge"
                referrerPolicy="no-referrer"
              />
              <h3 className="text-xl font-display font-black tracking-tight text-gray-900 dark:text-white uppercase leading-none">
                Đăng nhập hệ thống
              </h3>
              <p className="text-xs text-gray-400 mt-2 max-w-[260px]">
                Quản lý thư viện ảnh, bàn giao sản phẩm chuyên nghiệp cùng BK Media Box.
              </p>
            </div>

            <form onSubmit={handleLoginSubmit} className="mt-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Địa chỉ Email
                </label>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="khoanguyenfotk5@gmail.com"
                  className="w-full rounded-xl border border-gray-200 dark:border-white/10 px-3.5 py-2.5 text-xs bg-gray-50 dark:bg-white/5 focus:border-brand-orange focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Mật khẩu
                </label>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-gray-200 dark:border-white/10 px-3.5 py-2.5 text-xs bg-gray-50 dark:bg-white/5 focus:border-brand-orange focus:outline-none"
                />
              </div>

              <div className="pt-2 flex flex-col space-y-2">
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-bold shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
                >
                  Đăng nhập ngay
                </button>
                <button
                  type="button"
                  onClick={() => setIsLoginModalOpen(false)}
                  className="w-full py-2 rounded-xl text-xs font-semibold text-gray-400 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Trở lại
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
