import React, { useState, useEffect, useRef } from 'react'
import { Smartphone, CheckCircle2, AlertCircle } from 'lucide-react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import MetricCards from './components/MetricCards'
import VideoPlayer from './components/VideoPlayer'
import TelemetryChart from './components/TelemetryChart'
import IncidentHistory from './components/IncidentHistory'
import TechSpecsModal from './components/TechSpecsModal'
import SettingsModal from './components/SettingsModal'
import LightboxModal from './components/LightboxModal'
import LoginModal from './components/LoginModal'
import DailyViolationsPage from './components/DailyViolationsPage'
import WorkersPage from './components/WorkersPage'

export default function App() {
  const [currentView, setCurrentView] = useState('home') // 'home' | 'violations' | 'workers'
  const [workerCount, setWorkerCount] = useState(0)
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('hardhat_theme') || 'light' // Default to light/bright per user request
  })
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('hardhat_user')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })

  const [status, setStatus] = useState({
    camera_enabled: true,
    is_connected: false,
    status_message: 'Đang kết nối hệ thống...',
    fps: 0,
    camera_source: '0',
    has_violation: false,
    total_safe: 0,
    total_violations: 0,
    compliance_rate: 100.0,
    api_latency_ms: 0,
    latency_history: [110, 105, 98, 115, 108, 102],
    latest_alert_id: 0
  })

  const [history, setHistory] = useState([])
  const [isAudioMuted, setIsAudioMuted] = useState(() => {
    return localStorage.getItem('hardhat_audio_muted') === 'true'
  })
  const [selectedSnapshot, setSelectedSnapshot] = useState(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isTechSpecsOpen, setIsTechSpecsOpen] = useState(false)
  const [isCameraLoading, setIsCameraLoading] = useState(false)
  const [toast, setToast] = useState(null)

  const showToast = (message, type = 'info') => {
    setToast({ message, type })
    setTimeout(() => {
      setToast(null)
    }, 3500)
  }

  const audioRef = useRef(null)
  const clientLastAlertIdRef = useRef(null)
  const prevHasViolationRef = useRef(false)

  // Khóa chống lặp âm thanh giữa các Tab trên cùng một máy
  const canPlayAudioGlobally = (force = false) => {
    const now = Date.now()
    const last = parseInt(localStorage.getItem('last_alert_played_time') || '0', 10)
    if (!force && (now - last < 3500)) return false
    localStorage.setItem('last_alert_played_time', now.toString())
    return true
  }

  // Phát còi báo động công nghiệp bằng Web Audio API (Dự phòng đảm bảo 100% phát được tiếng)
  const playWebAudioSiren = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      if (ctx.state === 'suspended') {
        ctx.resume()
      }

      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sawtooth'

      // Còi báo động hai âm vực luân phiên (Emergency Industrial Alarm)
      osc.frequency.setValueAtTime(850, now)
      osc.frequency.exponentialRampToValueAtTime(550, now + 0.22)
      osc.frequency.exponentialRampToValueAtTime(850, now + 0.45)
      osc.frequency.exponentialRampToValueAtTime(550, now + 0.68)

      gain.gain.setValueAtTime(0.35, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.75)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.75)
    } catch (e) {
      console.warn("WebAudio siren error:", e)
    }
  }

  const playWarningSound = (force = false) => {
    if (isAudioMuted) return
    if (!canPlayAudioGlobally(force)) return

    if (audioRef.current) {
      audioRef.current.currentTime = 0
      audioRef.current.play().catch((err) => {
        console.warn("[Audio] HTML5 audio gặp trở ngại trình duyệt, phát còi Web Audio dự phòng:", err)
        playWebAudioSiren()
      })
    } else {
      playWebAudioSiren()
    }
  }

  // Mở khóa âm thanh trình duyệt ngay khi người dùng chạm hoặc click lần đầu vào trang
  useEffect(() => {
    const unlockAudio = () => {
      if (audioRef.current) {
        audioRef.current.play().then(() => {
          audioRef.current.pause()
          audioRef.current.currentTime = 0
        }).catch(() => {})
      }
    }
    window.addEventListener('click', unlockAudio, { once: true })
    window.addEventListener('keydown', unlockAudio, { once: true })
    window.addEventListener('touchstart', unlockAudio, { once: true })
    return () => {
      window.removeEventListener('click', unlockAudio)
      window.removeEventListener('keydown', unlockAudio)
      window.removeEventListener('touchstart', unlockAudio)
    }
  }, [])

  const toggleAudio = () => {
    const newState = !isAudioMuted
    setIsAudioMuted(newState)
    localStorage.setItem('hardhat_audio_muted', newState.toString())
    if (!newState && audioRef.current) {
      audioRef.current.play().then(() => {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      }).catch(() => {})
    }
  }

  // Lấy lịch sử vi phạm
  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/history')
      if (res.ok) {
        const data = await res.json()
        setHistory(data)
      }
    } catch (e) {
      console.warn("Lỗi fetch history:", e)
    }
  }

  // Lấy danh sách công nhân để đếm số lượng
  const fetchWorkerCount = async () => {
    try {
      const res = await fetch('/api/workers')
      if (res.ok) {
        const data = await res.json()
        setWorkerCount((data || []).length)
      }
    } catch (e) {
      console.warn("Lỗi fetch workers count:", e)
    }
  }

  // Kiểm tra phiên đăng nhập hiện tại từ server
  useEffect(() => {
    fetchWorkerCount()
    const checkMe = async () => {
      try {
        const res = await fetch('/api/auth/me')
        const data = await res.json()
        if (data.authenticated && data.user) {
          setCurrentUser(data.user)
          localStorage.setItem('hardhat_user', JSON.stringify(data.user))
        }
      } catch (e) {
        console.warn("Auth check error:", e)
      }
    }
    checkMe()
  }, [])

  // Đồng bộ chế độ sáng / tối (Theme Synchronizer)
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('hardhat_theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))
  }

  // Chu kỳ Polling trạng thái hệ thống (chỉ chạy khi đã đăng nhập)
  useEffect(() => {
    if (!currentUser) return

    fetchHistory()

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/status')
        if (!res.ok) return
        const data = await res.json()
        setStatus(data)

        // Xử lý kích hoạt âm thanh cảnh báo tự động khi phát hiện vi phạm
        const currentAlertId = data.latest_alert_id
        const shouldPlayFlag = data.should_play_alert === true
        const isNewAlertId = (
          currentAlertId !== undefined && 
          currentAlertId !== null && 
          clientLastAlertIdRef.current !== null && 
          currentAlertId > clientLastAlertIdRef.current
        )
        const isViolationTransition = (
          data.has_violation === true && 
          prevHasViolationRef.current === false
        )

        if (shouldPlayFlag || isNewAlertId || isViolationTransition) {
          playWarningSound()
          fetchHistory()
        }

        if (currentAlertId !== undefined && currentAlertId !== null) {
          clientLastAlertIdRef.current = currentAlertId
        }
        prevHasViolationRef.current = !!data.has_violation

      } catch (e) {
        console.warn("Polling error:", e)
      }
    }, 400)

    return () => clearInterval(pollInterval)
  }, [currentUser, isAudioMuted])

  // Đăng xuất
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {}
    setCurrentUser(null)
    localStorage.removeItem('hardhat_user')
  }

  // Bật/Tắt Camera
  const handleToggleCamera = async () => {
    setIsCameraLoading(true)
    try {
      const res = await fetch('/api/toggle_camera', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !status.camera_enabled })
      })
      const data = await res.json()
      if (data.success) {
        setStatus(prev => ({ ...prev, camera_enabled: data.camera_enabled }))
      }
    } catch (e) {
      showToast("Lỗi bật/tắt camera: " + e.message, "error")
    } finally {
      setIsCameraLoading(false)
    }
  }

  // Chuyển nguồn Camera
  const handleUpdateCamera = async (newSource) => {
    if (!newSource) return
    setIsCameraLoading(true)
    try {
      const res = await fetch('/api/update_camera', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: newSource })
      })
      const data = await res.json()
      if (data.success) {
        setStatus(prev => ({ ...prev, camera_source: data.source }))
      }
    } catch (e) {
      showToast("Lỗi đổi nguồn camera: " + e.message, "error")
    } finally {
      setIsCameraLoading(false)
    }
  }

  // Thử chuông
  const handleTestAlert = async () => {
    playWarningSound(true)
    try {
      await fetch('/api/test_alert', { method: 'POST' })
      fetchHistory()
    } catch (e) {
      console.error(e)
    }
  }

  // Thử loa ngoài trên điện thoại IP Webcam (Non-blocking Toast)
  const handleTestPhoneAlert = async () => {
    try {
      showToast("Đang kích hoạt loa ngoài điện thoại...", "info")
      const res = await fetch('/api/test_phone_alert', { method: 'POST' })
      const data = await res.json()
      showToast(data.message, data.success ? "success" : "error")
    } catch (e) {
      showToast("Lỗi kết nối điện thoại: " + e.message, "error")
    }
  }

  // Chụp ảnh bằng chứng thủ công
  const handleManualSnapshot = async () => {
    try {
      const res = await fetch('/api/manual_snapshot', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        fetchHistory()
      }
      return data
    } catch (e) {
      console.error("Lỗi chụp ảnh:", e)
      return { success: false, message: e.message }
    }
  }

  // Lưu Cài Đặt (Admin only)
  const handleSaveSettings = async (settings) => {
    try {
      const res = await fetch('/api/update_settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })
      const data = await res.json()
      if (data.success) {
        showToast("Đã lưu cấu hình thành công!", "success")
      }
      return data.success
    } catch (e) {
      showToast("Lỗi lưu cấu hình: " + e.message, "error")
      return false
    }
  }

  // Xóa 1 vi phạm (khi AI detect sai / false positive)
  const handleDeleteViolation = async (id) => {
    if (!id) return
    if (!window.confirm(`Bạn có chắc chắn muốn xóa vụ vi phạm #${id} do AI nhận diện sai không?`)) {
      return
    }
    try {
      const res = await fetch(`/api/violations/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        showToast(data.message, "success")
        fetchHistory()
      } else {
        showToast(data.message, "error")
      }
    } catch (e) {
      showToast("Lỗi khi xóa vi phạm: " + e.message, "error")
    }
  }

  // Xóa toàn bộ vi phạm
  const handleClearAllViolations = async () => {
    if (!window.confirm("Bạn có chắc chắn muốn XÓA TOÀN BỘ nhật ký vi phạm không? Hành động này không thể hoàn tác!")) {
      return
    }
    try {
      const res = await fetch('/api/violations/clear', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        showToast(data.message, "success")
        fetchHistory()
      } else {
        showToast(data.message, "error")
      }
    } catch (e) {
      showToast("Lỗi khi xóa toàn bộ vi phạm: " + e.message, "error")
    }
  }

  // Toàn màn hình Kiosk Mode
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
      }
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#070b13] flex text-slate-800 dark:text-slate-100 selection:bg-amber-500/20 selection:text-amber-600 transition-colors duration-200">
      
      {/* Audio Element ẩn phát file cảnh báo chuẩn tiếng Việt */}
      <audio ref={audioRef} preload="auto">
        <source src="/static/audio/alert.mp3" type="audio/mpeg" />
      </audio>

      {/* Login Screen nếu chưa đăng nhập */}
      <LoginModal 
        isOpen={!currentUser} 
        onLoginSuccess={(user) => {
          setCurrentUser(user)
          localStorage.setItem('hardhat_user', JSON.stringify(user))
        }} 
      />

      {/* Left-hand Taskbar / Sidebar */}
      <Sidebar 
        currentView={currentView}
        setCurrentView={setCurrentView}
        status={status}
        currentUser={currentUser}
        onLogout={handleLogout}
        isAudioMuted={isAudioMuted}
        toggleAudio={toggleAudio}
        onOpenSettings={() => setIsSettingsOpen(true)}
        toggleFullscreen={toggleFullscreen}
        violationCount={history.length}
        workerCount={workerCount}
        theme={theme}
        toggleTheme={toggleTheme}
      />

      {/* Right Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto min-h-screen bg-slate-100 dark:bg-[#070b13] transition-colors duration-200">
        
        {/* Streamlined Top Header */}
        <Header 
          status={status}
          currentUser={currentUser}
          isAudioMuted={isAudioMuted}
          toggleAudio={toggleAudio}
          onOpenSettings={() => setIsSettingsOpen(true)}
          toggleFullscreen={toggleFullscreen}
          currentView={currentView}
          theme={theme}
          toggleTheme={toggleTheme}
        />

        {/* Dynamic Content Views */}
        {currentView === 'violations' ? (
          /* Violations Audit Page */
          <div className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full">
            <DailyViolationsPage 
              onBackToLive={() => setCurrentView('home')}
              onSelectSnapshot={(url) => setSelectedSnapshot(url)}
            />
          </div>
        ) : currentView === 'workers' ? (
          /* Workers Management & AI Face Scan */
          <div className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full">
            <WorkersPage 
              onBackToLive={() => setCurrentView('home')}
              onWorkerCountChange={(count) => setWorkerCount(count)}
            />
          </div>
        ) : (
          /* Home: Live Camera Feed & Telemetry Dashboard */
          <main className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-4">
            
            {/* Metric Cards Bento Grid */}
            <MetricCards status={status} />

            {/* Content Layout: Left 8 cols = Camera Feed, Right 4 cols = Charts & Logs */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              
              {/* Left Column: Live Video Stream & Camera Switcher */}
              <div className="lg:col-span-8 space-y-4">
                <VideoPlayer 
                  status={status}
                  onToggleCamera={handleToggleCamera}
                  onTestAlert={handleTestAlert}
                  onTestPhoneAlert={handleTestPhoneAlert}
                  onUpdateCamera={handleUpdateCamera}
                  onManualSnapshot={handleManualSnapshot}
                  isCameraLoading={isCameraLoading}
                />
              </div>

              {/* Right Column: Telemetry Sparkline & Violation History */}
              <div className="lg:col-span-4 flex flex-col space-y-4">
                <TelemetryChart 
                  latencyHistory={status.latency_history}
                  currentLatency={status.api_latency_ms}
                />
                <IncidentHistory 
                  history={history}
                  onSelectSnapshot={(url) => setSelectedSnapshot(url)}
                  onOpenDailyPage={() => setCurrentView('violations')}
                  onDeleteViolation={handleDeleteViolation}
                  onClearAllViolations={handleClearAllViolations}
                />
              </div>

            </div>

          </main>
        )}

        {/* Clean Enterprise Footer without Tech Names */}
        <footer className="border-t border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-[#070b13] py-3.5 text-xs text-slate-500 mt-auto transition-colors">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-slate-600 dark:text-slate-400">
              Hệ Thống Giám Sát Mũ Bảo Hộ Công Trường Thông Minh &copy; 2026
            </span>
            <div className="flex items-center space-x-2 text-slate-500 text-[11px]">
              <span>Phát hiện & cảnh báo an toàn thời gian thực</span>
              <span>•</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">Bảo mật & Kiểm toán số</span>
            </div>
          </div>
        </footer>

      </div>

      {/* Modals */}
      <TechSpecsModal 
        isOpen={isTechSpecsOpen} 
        onClose={() => setIsTechSpecsOpen(false)} 
      />

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        status={status}
        onSaveSettings={handleSaveSettings}
      />

      <LightboxModal 
        imageUrl={selectedSnapshot} 
        onClose={() => setSelectedSnapshot(null)} 
      />

      {/* Global Floating Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center space-x-2.5 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md border text-sm font-medium transition-all animate-bounce ${
          toast.type === 'error'
            ? 'bg-rose-950/90 text-rose-100 border-rose-500/50'
            : toast.type === 'success'
            ? 'bg-emerald-950/90 text-emerald-100 border-emerald-500/50'
            : 'bg-slate-900/90 text-slate-100 border-cyan-500/50'
        }`}>
          {toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <Smartphone className="w-4 h-4 text-cyan-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

    </div>
  )
}
