import React from 'react'
import { 
  Home, 
  ShieldAlert, 
  Users,
  Volume2, 
  VolumeX, 
  Maximize, 
  Settings, 
  LogOut, 
  User, 
  Activity, 
  Radio,
  Sliders,
  Shield,
  Sun,
  Moon
} from 'lucide-react'

export default function Sidebar({
  currentView = 'home',
  setCurrentView,
  status,
  currentUser,
  onLogout,
  isAudioMuted,
  toggleAudio,
  onOpenSettings,
  toggleFullscreen,
  violationCount = 0,
  workerCount = 0,
  theme = 'light',
  toggleTheme
}) {
  const isConnected = status?.is_connected && status?.camera_enabled
  const hasViolation = status?.has_violation
  const isAdmin = currentUser?.role === 'admin'
  const isDark = theme === 'dark'

  const navItems = [
    {
      id: 'home',
      label: 'Home',
      sublabel: 'Giám sát trực tiếp',
      icon: Home,
      badge: isConnected ? 'Live' : 'Off',
      badgeColor: isConnected 
        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' 
        : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-600'
    },
    {
      id: 'violations',
      label: 'Violations',
      sublabel: 'Nhật ký vi phạm',
      icon: ShieldAlert,
      badge: violationCount > 0 ? violationCount : null,
      badgeColor: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30'
    },
    {
      id: 'workers',
      label: 'Workers',
      sublabel: 'Công nhân & Quét mặt AI',
      icon: Users,
      badge: workerCount > 0 ? workerCount : null,
      badgeColor: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-500/30'
    }
  ]

  return (
    <aside className="w-64 bg-white dark:bg-[#080c15] border-r border-slate-200 dark:border-slate-800/80 flex flex-col justify-between shrink-0 min-h-screen select-none transition-colors duration-200 shadow-sm">
      
      {/* Top: Logo & System Brand */}
      <div>
        <div className="p-4 border-b border-slate-200 dark:border-slate-800/80">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-md shadow-amber-500/20 text-slate-950 font-black text-xl shrink-0">
              🪖
            </div>
            <div className="overflow-hidden">
              <h1 className="font-extrabold text-base text-slate-900 dark:text-white tracking-tight leading-tight flex items-center">
                HARDHAT VISION
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                Giám Sát An Toàn Mũ Bảo Hộ
              </p>
            </div>
          </div>
        </div>

        {/* Live Status Pill */}
        <div className="px-4 py-3">
          <div className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
            hasViolation 
              ? 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400' 
              : isConnected 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400' 
                : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400'
          }`}>
            <div className="flex items-center space-x-2">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  hasViolation ? 'bg-red-500' : isConnected ? 'bg-emerald-500' : 'bg-slate-400'
                }`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${
                  hasViolation ? 'bg-red-600' : isConnected ? 'bg-emerald-500' : 'bg-slate-400'
                }`}></span>
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider">
                {hasViolation ? 'Phát Hiện Vi Phạm' : isConnected ? 'Đang Giám Sát' : 'Tạm Dừng'}
              </span>
            </div>
            <Radio className={`w-3.5 h-3.5 ${isConnected ? 'animate-pulse' : 'opacity-40'}`} />
          </div>
        </div>

        {/* Main Navigation (Home & Violations) */}
        <div className="px-3 py-2 space-y-1">
          <div className="px-3 pb-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Menu Chính
          </div>

          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = currentView === item.id

            return (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-medium text-xs transition-all text-left group ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/25'
                    : 'text-slate-700 hover:text-slate-950 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                    isActive ? 'text-slate-950' : 'text-slate-400 group-hover:text-amber-500'
                  }`} />
                  <div>
                    <div className="text-sm font-bold leading-tight">
                      {item.label}
                    </div>
                    <div className={`text-[10px] font-normal leading-tight ${
                      isActive ? 'text-slate-900/80' : 'text-slate-500 dark:text-slate-400'
                    }`}>
                      {item.sublabel}
                    </div>
                  </div>
                </div>

                {item.badge && (
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                    isActive 
                      ? 'bg-slate-950/20 text-slate-950 border-slate-950/30' 
                      : item.badgeColor
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Quick Tools & Theme Switcher Section */}
        <div className="px-3 py-3 mt-2 border-t border-slate-200 dark:border-slate-800/60 space-y-1">
          <div className="px-3 pb-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Tiện Ích & Điều Khiển
          </div>

          {/* Theme Switcher (Bright / Dark) */}
          {toggleTheme && (
            <button
              onClick={toggleTheme}
              className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-900/80 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 transition-all shadow-sm"
              title="Chuyển đổi giao diện Sáng / Tối"
            >
              <div className="flex items-center space-x-2.5">
                {isDark ? (
                  <Moon className="w-4 h-4 text-cyan-400" />
                ) : (
                  <Sun className="w-4 h-4 text-amber-500" />
                )}
                <span>Giao Diện</span>
              </div>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                isDark 
                  ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' 
                  : 'bg-amber-500/15 text-amber-700 border-amber-500/30'
              }`}>
                {isDark ? 'Tối (Dark)' : 'Sáng (Bright)'}
              </span>
            </button>
          )}

          {/* Audio Alert Toggle */}
          <button
            onClick={toggleAudio}
            className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              isAudioMuted
                ? 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-900/80 text-slate-500 hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-400 border border-slate-200 dark:border-slate-800'
                : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20'
            }`}
          >
            <div className="flex items-center space-x-2.5">
              {isAudioMuted ? (
                <VolumeX className="w-4 h-4 text-amber-500" />
              ) : (
                <Volume2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              )}
              <span>Cảnh Báo Âm Thanh</span>
            </div>
            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
              isAudioMuted ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400' : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
            }`}>
              {isAudioMuted ? 'Tắt' : 'Bật'}
            </span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="w-full flex items-center space-x-2.5 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all border border-transparent"
          >
            <Maximize className="w-4 h-4" />
            <span>Toàn Màn Hình</span>
          </button>

          {/* Settings (Admin only) */}
          {isAdmin && (
            <button
              onClick={onOpenSettings}
              className="w-full flex items-center space-x-2.5 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all border border-transparent"
            >
              <Settings className="w-4 h-4" />
              <span>Cấu Hình Hệ Thống</span>
            </button>
          )}
        </div>
      </div>

      {/* Bottom: User Profile & Logout */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-950/60">
        <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center space-x-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-700 dark:text-emerald-400 font-bold text-xs shrink-0">
              {currentUser?.full_name ? currentUser.full_name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate leading-tight">
                {currentUser?.full_name || currentUser?.username || 'Cán Bộ Giám Sát'}
              </p>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono truncate leading-tight">
                {currentUser?.role === 'admin' ? 'Chỉ Huy Trưởng' : 'Giám Sát Viên'}
              </p>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors shrink-0"
            title="Đăng xuất khỏi hệ thống"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

    </aside>
  )
}
