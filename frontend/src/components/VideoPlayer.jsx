import React, { useState } from 'react'
import { 
  Video, 
  VideoOff, 
  Bell, 
  Radio, 
  Smartphone, 
  Monitor, 
  Globe, 
  RefreshCw,
  CameraIcon,
  CheckCircle2,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck
} from 'lucide-react'

export default function VideoPlayer({ 
  status, 
  onToggleCamera, 
  onTestAlert, 
  onTestPhoneAlert,
  onUpdateCamera,
  onManualSnapshot,
  isCameraLoading
}) {
  const [sourceInput, setSourceInput] = useState(status.camera_source || '0')
  const [showSource, setShowSource] = useState(false)
  const [snapshotMsg, setSnapshotMsg] = useState(null)
  const [streamVersion, setStreamVersion] = useState(1)

  // Chỉ thay đổi streamVersion khi người dùng đổi nguồn camera hoặc bật/tắt camera
  React.useEffect(() => {
    setStreamVersion(v => v + 1)
  }, [status.camera_source, status.camera_enabled])

  const isConnected = status.is_connected && status.camera_enabled
  const hasViolation = status.has_violation
  const cameraEnabled = status.camera_enabled

  // Che giấu chuỗi IP/RTSP riêng tư để tăng cường bảo mật giao diện
  const getMaskedCameraLabel = (src) => {
    if (!src || src === '0') return 'Webcam Laptop (Tích hợp)'
    if (src.includes('8080') || src.startsWith('http')) return 'Camera Điện Thoại (Wi-Fi 🔒)'
    if (src.startsWith('rtsp://')) return 'Camera RTSP Ngoài Trời (🔒)'
    return 'Camera Giám Sát (🔒)'
  }

  const handlePresetSelect = (val) => {
    setSourceInput(val)
    onUpdateCamera(val)
    setShowSource(false) // Ẩn link ngay khi chuyển nguồn
  }

  const handleSubmitSource = (e) => {
    e.preventDefault()
    onUpdateCamera(sourceInput)
    setShowSource(false) // Ẩn link IP/RTSP ngay sau khi bấm kết nối
  }

  const handleSnapshotClick = async () => {
    const res = await onManualSnapshot()
    if (res && res.success) {
      setSnapshotMsg("Đã chụp và lưu ảnh bằng chứng thành công!")
      setTimeout(() => setSnapshotMsg(null), 3000)
    }
  }

  return (
    <div className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-800 p-4 relative overflow-hidden flex flex-col justify-between shadow-sm transition-colors duration-200">
      
      {/* Video Header: Title & Masked Camera Status Badge */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <Video className="w-4 h-4" />
          </div>
          <span className="font-bold text-sm text-slate-900 dark:text-white tracking-wide">
            LIVE CAMERA FEED
          </span>
          <span className="inline-flex items-center space-x-1.5 text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-cyan-700 dark:text-cyan-400 border border-slate-200 dark:border-slate-700 font-mono font-bold shadow-2xs">
            <Lock className="w-3 h-3 text-emerald-500" />
            <span>{getMaskedCameraLabel(status.camera_source)}</span>
          </span>
        </div>

        {/* Quick Toolbar */}
        <div className="flex items-center space-x-2">
          {/* Manual Snapshot Button */}
          <button
            onClick={handleSnapshotClick}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors shadow-sm"
            title="Chụp ảnh bằng chứng ngay lập tức và lưu trữ"
          >
            <CameraIcon className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">Chụp Ảnh</span>
          </button>

          {/* Test Alarm Sound */}
          <button
            onClick={onTestAlert}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors shadow-sm"
            title="Phát thử âm thanh cảnh báo loa trình duyệt"
          >
            <Bell className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">Thử Chuông</span>
          </button>

          {/* Test Phone Alert (Flash & Speaker) */}
          {status.camera_source && (status.camera_source.includes('8080') || status.camera_source.startsWith('http')) && (
            <button
              onClick={onTestPhoneAlert}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-xs text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 transition-colors shadow-sm"
              title="Thử chớp đèn flash và phát âm thanh loa ngoài trên điện thoại camera"
            >
              <Smartphone className="w-3.5 h-3.5 text-cyan-500" />
              <span className="hidden sm:inline">Thử Loa & Flash ĐT</span>
            </button>
          )}

          {/* Camera Power Toggle */}
          <button
            onClick={onToggleCamera}
            disabled={isCameraLoading}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm ${
              cameraEnabled
                ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30 hover:bg-red-500/20'
                : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
            }`}
          >
            {cameraEnabled ? (
              <>
                <VideoOff className="w-3.5 h-3.5" />
                <span>Tắt Cam</span>
              </>
            ) : (
              <>
                <Video className="w-3.5 h-3.5" />
                <span>Bật Cam</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Video Viewport (Hardware viewport with dark cinema frame) */}
      <div className="relative w-full aspect-video md:aspect-[16/10] bg-[#02050b] rounded-xl overflow-hidden border-2 border-slate-300 dark:border-slate-800 flex items-center justify-center shadow-inner group">
        
        {/* HUD Crosshairs */}
        <div className="hud-corner-tl"></div>
        <div className="hud-corner-tr"></div>
        <div className="hud-corner-bl"></div>
        <div className="hud-corner-br"></div>

        {/* Live Stream Image - Ổn định duy nhất 1 kết nối, không reload theo chu kỳ polling */}
        <img 
          src={`/video_feed?v=${streamVersion}`}
          alt="Video Stream"
          className="w-full h-full object-contain block select-none pointer-events-none"
        />

        {/* Flashing Violation Alert Banner Overlay */}
        {hasViolation && (
          <div className="absolute top-4 left-4 right-4 bg-red-600/90 backdrop-blur-md text-white px-4 py-2.5 rounded-xl border border-red-400 font-bold text-xs sm:text-sm flex items-center justify-center space-x-2 shadow-2xl animate-bounce">
            <Bell className="w-4 h-4 animate-spin" />
            <span>CẢNH BÁO: PHÁT HIỆN NGƯỜI CHƯA ĐỘI MŨ BẢO HỘ!</span>
          </div>
        )}

        {/* Snapshot Success Toast */}
        {snapshotMsg && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-emerald-600/95 backdrop-blur-md text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-2 shadow-xl border border-emerald-400 animate-fade-in">
            <CheckCircle2 className="w-4 h-4" />
            <span>{snapshotMsg}</span>
          </div>
        )}

        {/* Stream Badges Overlay (Bottom Left & Right) */}
        <div className="absolute bottom-3 left-3 flex items-center space-x-2 pointer-events-none">
          <span className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-black/70 backdrop-blur-sm text-[11px] font-mono text-emerald-400 border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span>LIVE</span>
          </span>
          <span className="px-2 py-1 rounded-md bg-black/70 backdrop-blur-sm text-[11px] font-mono text-slate-200 border border-slate-700">
            {status.fps ? `${status.fps.toFixed(1)} FPS` : '0 FPS'}
          </span>
        </div>

      </div>

      {/* Camera Switcher & Presets Toolbar */}
      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800/80">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center space-x-1.5">
            <Radio className="w-3.5 h-3.5 text-amber-500" />
            <span>Chuyển Nguồn Camera Nhanh:</span>
          </label>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center space-x-1 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Bảo mật IP & RTSP đang kích hoạt</span>
          </span>
        </div>

        {/* 3 Quick Preset Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
          {/* Preset 1: Webcam Laptop */}
          <button
            onClick={() => handlePresetSelect('0')}
            className={`p-2.5 rounded-xl border text-left transition-all flex items-center space-x-3 ${
              status.camera_source === '0'
                ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-700 dark:text-emerald-300 shadow-sm'
                : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <div className="p-2 rounded-lg bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <Monitor className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">Webcam Laptop</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Camera tích hợp (0)</div>
            </div>
          </button>

          {/* Preset 2: Phone IP Webcam */}
          <button
            onClick={() => handlePresetSelect('http://192.168.1.233:8080/video')}
            className={`p-2.5 rounded-xl border text-left transition-all flex items-center space-x-3 ${
              status.camera_source?.includes('8080')
                ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-700 dark:text-cyan-300 shadow-sm'
                : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <div className="p-2 rounded-lg bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <Smartphone className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">Camera Điện Thoại</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">IP Webcam (Wi-Fi 🔒)</div>
            </div>
          </button>

          {/* Preset 3: RTSP Camera */}
          <button
            onClick={() => handlePresetSelect('rtsp://wowzaec2demo.streamlock.net/vod/mp4:BigBuckBunny_115k.mp4')}
            className={`p-2.5 rounded-xl border text-left transition-all flex items-center space-x-3 ${
              status.camera_source?.startsWith('rtsp://')
                ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-700 dark:text-indigo-300 shadow-sm'
                : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <div className="p-2 rounded-lg bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <Globe className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">Camera RTSP Ngoài Trời</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Hikvision / Dahua (🔒)</div>
            </div>
          </button>
        </div>

        {/* Custom Input Bar with Security Masking */}
        <form 
          onSubmit={handleSubmitSource}
          className="flex items-center space-x-2"
        >
          <div className="relative flex-1">
            <input
              type={showSource ? "text" : "password"}
              value={sourceInput}
              onChange={(e) => setSourceInput(e.target.value)}
              placeholder="Nhập 0, link http://192.168.x.x:8080/video hoặc link rtsp://..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-3.5 pr-10 py-2 text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 shadow-sm font-mono tracking-wider"
            />
            {sourceInput && sourceInput !== '0' && (
              <button
                type="button"
                onClick={() => setShowSource(!showSource)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg transition-colors"
                title={showSource ? "Ẩn địa chỉ IP/RTSP (Chế độ bảo mật)" : "Hiện địa chỉ IP/RTSP"}
              >
                {showSource ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
          <button
            type="submit"
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md shadow-emerald-600/20 transition-colors shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Kết Nối</span>
          </button>
        </form>

      </div>

    </div>
  )
}
