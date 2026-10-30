import React, { useState, useEffect } from 'react'
import { 
  Volume2, 
  VolumeX, 
  Maximize, 
  Settings, 
  Clock, 
  Calendar,
  AlertTriangle,
  ShieldCheck,
  Menu,
  Sun,
  Moon
} from 'lucide-react'

export default function Header({ 
  status, 
  currentUser,
  isAudioMuted, 
  toggleAudio, 
  onOpenSettings, 
  toggleFullscreen,
  currentView = 'home',
  onToggleMobileSidebar,
  theme = 'light',
  toggleTheme
}) {
  const isConnected = status?.is_connected && status?.camera_enabled
  const hasViolation = status?.has_violation
  const isDark = theme === 'dark'
  const [currentTime, setCurrentTime] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const formatClock = (date) => {
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const formatDate = (date) => {
    return date.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  return (
    <header className="border-b border-slate-200 dark:border-slate-800/80 bg-white/85 dark:bg-[#070b13]/85 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-6 py-3 transition-colors duration-200">
      <div className="flex items-center justify-between gap-4">
        
        {/* Left: Mobile Menu Toggle & Page Context Title */}
        <div className="flex items-center space-x-3">
          {onToggleMobileSidebar && (
            <button
              onClick={onToggleMobileSidebar}
              className="lg:hidden p-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <div>
            <div className="flex items-center space-x-2">
              <h2 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white tracking-tight uppercase">
                {currentView === 'home' 
                  ? 'Giám Sát Trực Tiếp' 
                  : currentView === 'workers' 
                    ? 'Hồ Sơ Công Nhân' 
                    : 'Nhật Ký Vi Phạm'}
              </h2>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                currentView === 'home'
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
                  : currentView === 'workers'
                    ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-500/30'
                    : 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30'
              }`}>
                {currentView === 'home' 
                  ? 'Real-time Feed' 
                  : currentView === 'workers' 
                    ? 'Qdrant Vector DB' 
                    : 'Hồ Sơ Kiểm Toán'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
              {currentView === 'home' 
                ? 'Nhận diện và cảnh báo vi phạm mũ bảo hộ thời gian thực' 
                : currentView === 'workers'
                  ? 'Quản lý nhân sự, đăng ký ảnh chân dung & buồng quét khuôn mặt AI DeepFace'
                  : 'Tra cứu lịch sử vi phạm, thống kê tỷ lệ tuân thủ và đối chiếu ảnh bằng chứng'}
            </p>
          </div>
        </div>

        {/* Center: Live Alert Status Banner */}
        <div className="hidden md:flex items-center space-x-2">
          <div className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl border text-xs font-semibold shadow-sm transition-all ${
            hasViolation
              ? 'bg-red-500/15 border-red-500/40 text-red-700 dark:text-red-300 animate-pulse'
              : isConnected
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                : 'bg-slate-100 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400'
          }`}>
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                hasViolation ? 'bg-red-500' : isConnected ? 'bg-emerald-500' : 'bg-slate-400'
              }`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                hasViolation ? 'bg-red-600' : isConnected ? 'bg-emerald-500' : 'bg-slate-400'
              }`}></span>
            </span>
            <span>
              {hasViolation 
                ? 'CẢNH BÁO: PHÁT HIỆN VI PHẠM' 
                : isConnected 
                  ? 'HỆ THỐNG AN TOÀN - ĐANG GIÁM SÁT' 
                  : status?.status_message || 'Chờ kết nối'}
            </span>
          </div>
        </div>

        {/* Right: Live Clock, Theme Switcher & Quick Audio Toggle */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          
          {/* Live Date/Clock */}
          <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 text-xs font-mono text-slate-600 dark:text-slate-300">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span className="font-bold text-slate-900 dark:text-white">{formatClock(currentTime)}</span>
            <span className="text-slate-400 dark:text-slate-600">|</span>
            <span className="text-slate-500 dark:text-slate-400">{formatDate(currentTime)}</span>
          </div>

          {/* Theme Quick Toggle Button */}
          {toggleTheme && (
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 transition-all shadow-sm"
              title={isDark ? "Chuyển sang chế độ Sáng (Bright)" : "Chuyển sang chế độ Tối (Dark)"}
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700" />
              )}
            </button>
          )}

          {/* Audio Quick Toggle */}
          <button
            onClick={toggleAudio}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
              isAudioMuted
                ? 'bg-slate-100 dark:bg-amber-500/10 text-slate-500 dark:text-amber-400 border-slate-200 dark:border-amber-500/30 hover:bg-slate-200'
                : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20'
            }`}
            title={isAudioMuted ? "Bật âm thanh cảnh báo" : "Tắt âm thanh cảnh báo"}
          >
            {isAudioMuted ? (
              <>
                <VolumeX className="w-3.5 h-3.5 text-amber-500" />
                <span className="hidden md:inline">Loa: Tắt</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 animate-pulse" />
                <span className="hidden md:inline">Loa: Bật</span>
              </>
            )}
          </button>

          {/* Fullscreen Quick Button */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all"
            title="Toàn màn hình"
          >
            <Maximize className="w-3.5 h-3.5" />
          </button>

        </div>

      </div>
    </header>
  )
}
