import React, { useState, useEffect, useRef } from 'react'
import { 
  Users, 
  UserPlus, 
  Camera, 
  Upload, 
  Scan, 
  ShieldCheck, 
  Trash2, 
  Search, 
  Sparkles, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  ArrowLeft,
  Phone,
  Building,
  Hash,
  Database,
  Cpu,
  UserCheck,
  VideoOff
} from 'lucide-react'

export default function WorkersPage({ onBackToLive, onWorkerCountChange }) {
  const [activeTab, setActiveTab] = useState('upload') // 'upload' | 'scan'
  const [workers, setWorkers] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [alertMsg, setAlertMsg] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form State
  const [fullName, setFullName] = useState('')
  const [employeeCode, setEmployeeCode] = useState('')
  const [department, setDepartment] = useState('Đội Thi Công')
  const [phone, setPhone] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)

  // Camera Live Face Scan Booth State
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const isCameraActiveRef = useRef(false)
  const capturedSnapshotRef = useRef(null)
  const isProbingRef = useRef(false)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [probeStatus, setProbeStatus] = useState({
    detected: false,
    status: 'not_found',
    direction: 'none',
    advice: 'Đang khởi động camera...',
    auto_capture_ready: false
  })
  const [capturedSnapshot, setCapturedSnapshot] = useState(null)
  const [autoCountdown, setAutoCountdown] = useState(null) // null | 4 | 3 | 2 | 1
  const [isFlashing, setIsFlashing] = useState(false)
  const countdownTimerRef = useRef(null)
  const countdownValueRef = useRef(3)
  const probeTimerRef = useRef(null)

  // Hủy bộ đếm ngược 4 giây nếu khuôn mặt bị lệch ra ngoài hoặc đổi trạng thái
  const cancelAutoCountdown = () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current)
      countdownTimerRef.current = null
    }
    countdownValueRef.current = 3
    setAutoCountdown(null)
  }

  // Phát âm thanh tiếng chụp màn trập máy ảnh (Web Audio API không cần file ngoài)
  const playCameraShutterSound = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      
      // Âm thanh gương lật
      const osc1 = ctx.createOscillator()
      const gain1 = ctx.createGain()
      osc1.type = 'triangle'
      osc1.frequency.setValueAtTime(800, ctx.currentTime)
      osc1.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.04)
      gain1.gain.setValueAtTime(0.3, ctx.currentTime)
      gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.04)
      osc1.connect(gain1)
      gain1.connect(ctx.destination)
      osc1.start(ctx.currentTime)
      osc1.stop(ctx.currentTime + 0.05)

      // Âm thanh màn trập đóng (click)
      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.type = 'sine'
      osc2.frequency.setValueAtTime(1200, ctx.currentTime + 0.06)
      osc2.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.12)
      gain2.gain.setValueAtTime(0.4, ctx.currentTime + 0.06)
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12)
      osc2.connect(gain2)
      gain2.connect(ctx.destination)
      osc2.start(ctx.currentTime + 0.06)
      osc2.stop(ctx.currentTime + 0.13)
    } catch {}
  }

  // 1. Tải danh sách công nhân
  const fetchWorkers = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/workers')
      if (res.ok) {
        const data = await res.json()
        setWorkers(data || [])
        if (onWorkerCountChange) {
          onWorkerCountChange((data || []).length)
        }
      }
    } catch (e) {
      console.error("Lỗi fetch workers:", e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchWorkers()
  }, [])

  // 2. Xử lý File Upload Preview
  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setSelectedFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreviewUrl(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  // 3. Khởi động và Dừng Camera Quét Mặt Trực Tiếp
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: false
      })
      streamRef.current = stream
      isCameraActiveRef.current = true
      setIsCameraActive(true)
      capturedSnapshotRef.current = null
      setCapturedSnapshot(null)
      cancelAutoCountdown()
      setProbeStatus({
        detected: false,
        status: 'not_found',
        direction: 'none',
        advice: 'Đang kết nối camera, vui lòng nhìn vào màn hình...',
        auto_capture_ready: false
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        const playAndProbe = () => {
          videoRef.current.play().catch(e => console.warn("Video play error:", e))
          startFaceProbe()
        }
        if (videoRef.current.readyState >= 1) {
          playAndProbe()
        } else {
          videoRef.current.onloadedmetadata = playAndProbe
        }
      }
    } catch (err) {
      console.warn("Không thể truy cập camera cục bộ:", err)
      isCameraActiveRef.current = false
      setIsCameraActive(false)
      setAlertMsg({ type: 'error', text: 'Không thể mở webcam. Vui lòng cho phép quyền truy cập camera trên trình duyệt!' })
    }
  }

  const stopCamera = () => {
    if (probeTimerRef.current) {
      clearInterval(probeTimerRef.current)
      probeTimerRef.current = null
    }
    cancelAutoCountdown()
    isCameraActiveRef.current = false
    setIsCameraActive(false)
    isProbingRef.current = false

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  // 4. Live Face Scan Probe (Quét mặt thời gian thực & Tự động chụp khi căn chính giữa đủ 4 giây)
  const startFaceProbe = () => {
    if (probeTimerRef.current) {
      clearInterval(probeTimerRef.current)
      probeTimerRef.current = null
    }
    cancelAutoCountdown()

    probeTimerRef.current = setInterval(async () => {
      // Dùng ref trực tiếp để tránh stale closure trong React
      if (!isCameraActiveRef.current || capturedSnapshotRef.current) return
      if (!videoRef.current || !canvasRef.current) return
      
      const video = videoRef.current
      if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) return

      // Tránh dồn ứ request bất đồng bộ
      if (isProbingRef.current) return
      isProbingRef.current = true

      try {
        const canvas = canvasRef.current
        canvas.width = 320
        canvas.height = 240
        const ctx = canvas.getContext('2d')
        ctx.drawImage(video, 0, 0, 320, 240)
        const base64 = canvas.toDataURL('image/jpeg', 0.6)

        const res = await fetch('/api/workers/scan-probe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_base64: base64 })
        })

        if (res.ok) {
          const data = await res.json()
          
          // Nếu đã chụp ảnh trong lúc chờ API thì không cập nhật nữa
          if (capturedSnapshotRef.current) return

          setProbeStatus(data)

          // CƠ CHẾ TỰ ĐỘNG CHỤP KHI KHUÔN MẶT CĂN ĐÚNG CHÍNH GIỮA:
          // auto_capture_ready = true khi mặt nằm ở tâm oval, kích thước chuẩn
          // Người dùng giữ nguyên đúng 4 giây: 4 -> 3 -> 2 -> 1 -> Tự động chụp!
          if (data.auto_capture_ready) {
            if (!countdownTimerRef.current && !capturedSnapshotRef.current) {
              countdownValueRef.current = 3
              setAutoCountdown(3)
              countdownTimerRef.current = setInterval(() => {
                if (capturedSnapshotRef.current) {
                  cancelAutoCountdown()
                  return
                }
                countdownValueRef.current -= 1
                if (countdownValueRef.current > 0) {
                  setAutoCountdown(countdownValueRef.current)
                } else {
                  // Đã đủ 4 giây giữ nguyên chuẩn xác -> Chụp!
                  cancelAutoCountdown()
                  handleCaptureSnapshot(true)
                }
              }, 1000)
            }
          } else {
            // Nếu người dùng lệch mặt ra ngoài trong 4s, hủy đếm ngược ngay lập tức
            cancelAutoCountdown()
          }
        }
      } catch (err) {
        // probe silently ignores network glitches
      } finally {
        isProbingRef.current = false
      }
    }, 320)
  }

  useEffect(() => {
    if (activeTab === 'scan') {
      startCamera()
    } else {
      stopCamera()
    }
    return () => stopCamera()
  }, [activeTab])

  // 5. Chụp khung hình từ camera quét mặt (Hỗ trợ cả Tự động & Thủ công)
  const handleCaptureSnapshot = (isAuto = false) => {
    cancelAutoCountdown()
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current

    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const base64 = canvas.toDataURL('image/jpeg', 0.92)

    capturedSnapshotRef.current = base64
    setCapturedSnapshot(base64)

    // Hiệu ứng đèn flash trắng màn hình & âm thanh màn trập chân thực
    playCameraShutterSound()
    setIsFlashing(true)
    setTimeout(() => setIsFlashing(false), 220)

    if (isAuto) {
      setAlertMsg({ 
        type: 'success', 
        text: '🎯 AI ĐÃ TỰ ĐỘNG CĂN CHÍNH GIỮA & CHỤP THÀNH CÔNG! Bạn có thể nhấn "Lưu Hồ Sơ & Nạp Vector" bên dưới.' 
      })
    }
  }

  // Chụp lại ảnh khác
  const handleRetakeSnapshot = () => {
    cancelAutoCountdown()
    capturedSnapshotRef.current = null
    setCapturedSnapshot(null)
    setAlertMsg(null)
    setProbeStatus({
      detected: false,
      status: 'not_found',
      direction: 'none',
      advice: 'Căn khuôn mặt vào vòng oval giữa màn hình...',
      auto_capture_ready: false
    })
    startFaceProbe()
  }

  // 6. Gửi đăng ký công nhân
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!fullName.trim() || !employeeCode.trim()) {
      setAlertMsg({ type: 'error', text: 'Vui lòng nhập Họ tên và Mã công nhân!' })
      return
    }

    if (activeTab === 'upload' && !selectedFile) {
      setAlertMsg({ type: 'error', text: 'Vui lòng chọn 1 ảnh chân dung của công nhân!' })
      return
    }

    if (activeTab === 'scan' && !capturedSnapshot) {
      setAlertMsg({ type: 'error', text: 'Vui lòng nhấn nút "Chụp Quét Mặt" trước khi đăng ký!' })
      return
    }

    setIsSubmitting(true)
    setAlertMsg(null)

    const formData = new FormData()
    formData.append('full_name', fullName.trim())
    formData.append('employee_code', employeeCode.trim().toUpperCase())
    formData.append('department', department.trim())
    if (phone.trim()) formData.append('phone', phone.trim())

    if (activeTab === 'upload' && selectedFile) {
      formData.append('file', selectedFile)
    } else if (activeTab === 'scan' && capturedSnapshot) {
      formData.append('image_base64', capturedSnapshot)
    }

    try {
      const res = await fetch('/api/workers/register', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()

      if (res.ok && data.success) {
        setAlertMsg({ type: 'success', text: data.message })
        // Reset form
        setFullName('')
        setEmployeeCode('')
        setPhone('')
        setSelectedFile(null)
        setPreviewUrl(null)
        capturedSnapshotRef.current = null
        setCapturedSnapshot(null)
        cancelAutoCountdown()
        if (activeTab === 'scan') {
          startFaceProbe()
        }
        fetchWorkers()
      } else {
        setAlertMsg({ type: 'error', text: data.detail || data.message || 'Đăng ký thất bại' })
      }
    } catch (err) {
      setAlertMsg({ type: 'error', text: `Lỗi kết nối: ${err.message}` })
    } finally {
      setIsSubmitting(false)
    }
  }

  // 7. Xóa công nhân
  const handleDeleteWorker = async (id, name) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa hồ sơ công nhân "${name}" khỏi hệ thống và Qdrant Vector DB?`)) {
      return
    }
    try {
      const res = await fetch(`/api/workers/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setAlertMsg({ type: 'success', text: `Đã xóa công nhân "${name}" thành công!` })
        fetchWorkers()
      } else {
        const data = await res.json()
        setAlertMsg({ type: 'error', text: data.detail || 'Xóa thất bại' })
      }
    } catch (err) {
      setAlertMsg({ type: 'error', text: err.message })
    }
  }

  // Lọc tìm kiếm công nhân
  const filteredWorkers = workers.filter(w => {
    const q = searchQuery.toLowerCase()
    return (
      w.full_name?.toLowerCase().includes(q) ||
      w.employee_code?.toLowerCase().includes(q) ||
      w.department?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="max-w-7xl mx-auto w-full px-3 sm:px-4 py-4 flex-1 animate-fade-in text-slate-800 dark:text-slate-100 transition-colors duration-200">
      
      {/* Hidden Canvas used for image snapshot and probe */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Top Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBackToLive}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-all shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại Giám Sát</span>
          </button>
          
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center tracking-tight">
              <span>HỒ SƠ CÔNG NHÂN</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Đăng ký khuôn mặt công nhân qua ảnh hoặc tự quét mặt trực tiếp qua camera để AI nhận diện khi vi phạm
            </p>
          </div>
        </div>

        {/* Status Pills */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 shadow-sm">
            <Users className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            <span>Tổng nhân sự:</span>
            <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 font-mono text-[11px]">
              {workers.length}
            </span>
          </div>

          <button
            onClick={fetchWorkers}
            className="p-2 rounded-xl bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors shadow-sm"
            title="Tải lại danh sách"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Global Alert Notification */}
      {alertMsg && (
        <div className={`p-4 rounded-2xl mb-6 flex items-center justify-between gap-3 text-xs font-semibold shadow-sm animate-fade-in ${
          alertMsg.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300'
            : 'bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-500/40 text-red-800 dark:text-red-300'
        }`}>
          <div className="flex items-center space-x-2">
            {alertMsg.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
            )}
            <span>{alertMsg.text}</span>
          </div>
          <button 
            onClick={() => setAlertMsg(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Grid: Left 5 Cols = Registration (Upload or Scan), Right 7 Cols = Workers Directory */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Worker Registration Form */}
        <div className="lg:col-span-5 bg-white dark:bg-[#0b101c] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
          
          {/* Registration Mode Tabs */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 mb-5">
            <button
              onClick={() => setActiveTab('upload')}
              className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'upload'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <Upload className="w-3.5 h-3.5 text-amber-500" />
              <span>Tải Ảnh Chân Dung</span>
            </button>

            <button
              onClick={() => setActiveTab('scan')}
              className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'scan'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <Scan className="w-3.5 h-3.5 text-cyan-500" />
              <span>Buồng Quét Mặt AI</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Input 1: Full Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center space-x-1.5">
                <Users className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                <span>Họ Và Tên Công Nhân <span className="text-red-500">*</span></span>
              </label>
              <input
                type="text"
                required
                placeholder="Ví dụ: Nguyễn Văn An"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 shadow-xs"
              />
            </div>

            {/* Input 2 & 3: Code and Department */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center space-x-1.5">
                  <Hash className="w-3.5 h-3.5 text-amber-500" />
                  <span>Mã Công Nhân <span className="text-red-500">*</span></span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="CN-001"
                  value={employeeCode}
                  onChange={(e) => setEmployeeCode(e.target.value.toUpperCase())}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 font-mono font-bold shadow-xs uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center space-x-1.5">
                  <Building className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Tổ Đội / Phân Xưởng</span>
                </label>
                <input
                  type="text"
                  placeholder="Đội Cốp Pha, Hàn..."
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 shadow-xs"
                />
              </div>
            </div>

            {/* Input 4: Phone Number */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center space-x-1.5">
                <Phone className="w-3.5 h-3.5 text-indigo-500" />
                <span>Số Điện Thoại Liên Hệ (Tùy chọn)</span>
              </label>
              <input
                type="tel"
                placeholder="0987654321"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 font-mono shadow-xs"
              />
            </div>

            {/* TAB CONTENT 1: Upload File */}
            {activeTab === 'upload' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Ảnh Chân Dung Rõ Nét <span className="text-red-500">*</span>
                </label>
                
                <div className="relative border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-4 text-center hover:border-cyan-500/50 transition-colors bg-slate-50/50 dark:bg-slate-950/40">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  
                  {previewUrl ? (
                    <div className="flex flex-col items-center">
                      <img 
                        src={previewUrl} 
                        alt="Preview" 
                        className="w-28 h-28 object-cover rounded-xl border-2 border-cyan-500 shadow-md mb-2"
                      />
                      <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400">
                        {selectedFile?.name}
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5">Nhấp để chọn ảnh khác</span>
                    </div>
                  ) : (
                    <div className="py-6 flex flex-col items-center">
                      <div className="w-12 h-12 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mb-2">
                        <Upload className="w-6 h-6" />
                      </div>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Nhấp hoặc kéo thả ảnh chân dung vào đây
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Hỗ trợ JPG, PNG, WEBP (Góc chụp chính diện, đủ ánh sáng)
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT 2: Live Face Scan Booth */}
            {activeTab === 'scan' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>Buồng Quét Mặt Trực Tiếp Qua Camera</span>
                  <span className="text-[10px] font-mono font-bold text-cyan-600 dark:text-cyan-400">
                    Live Probe AI
                  </span>
                </label>

                <div className="relative aspect-[4/3] bg-black rounded-2xl overflow-hidden border-2 border-slate-300 dark:border-slate-800 flex items-center justify-center shadow-inner">
                  
                  {/* HTML5 Live Video Stream (Mirror Mode -scale-x-100) */}
                  <video 
                    ref={videoRef} 
                    playsInline 
                    muted 
                    className={`w-full h-full object-cover -scale-x-100 ${capturedSnapshot ? 'hidden' : 'block'}`}
                  />

                  {/* Hiệu ứng đèn Flash trắng khi chụp ảnh */}
                  <div className={`absolute inset-0 bg-white transition-opacity duration-200 pointer-events-none z-20 ${
                    isFlashing ? 'opacity-95' : 'opacity-0'
                  }`} />

                  {/* Captured Snapshot Preview */}
                  {capturedSnapshot && (
                    <img 
                      src={capturedSnapshot} 
                      alt="Captured Face" 
                      className="w-full h-full object-cover block"
                    />
                  )}

                  {/* Oval HUD Face Guide Overlay & Directional Arrows */}
                  {!capturedSnapshot && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      {/* Dark Vignette around oval */}
                      <div className="absolute inset-0 bg-black/35 backdrop-blur-[0.5px]"></div>
                      
                      {/* Central Oval Target with Dynamic Glow */}
                      <div className={`relative w-44 h-60 rounded-[50%] border-2 transition-all duration-300 shadow-2xl flex items-center justify-center ${
                        probeStatus.auto_capture_ready
                          ? 'border-emerald-400 ring-4 ring-emerald-500/40 shadow-[0_0_35px_rgba(52,211,153,0.7)]'
                          : probeStatus.status === 'adjust'
                            ? 'border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.4)]'
                            : 'border-slate-400/80 shadow-black'
                      }`}>
                        {/* Scanning Laser Beam Effect */}
                        {!probeStatus.auto_capture_ready && (
                          <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse-subtle"></div>
                        )}

                        {/* ĐẾM NGƯỢC TỰ ĐỘNG CHỤP KHI CĂN CHÍNH GIỮA */}
                        {probeStatus.auto_capture_ready && autoCountdown && (
                          <div className="flex flex-col items-center justify-center animate-fade-in">
                            <span className="text-4xl font-black text-emerald-400 font-mono drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] animate-pulse">
                              {autoCountdown}
                            </span>
                            <span className="text-[10px] font-black uppercase text-emerald-300 tracking-wider mt-1 bg-black/70 px-2.5 py-0.5 rounded-full border border-emerald-500/40 shadow">
                              Giữ Nguyên 3 Giây 🎯
                            </span>
                          </div>
                        )}
                      </div>

                      {/* CÁC MŨI TÊN & BIỂU TƯỢNG HƯỚNG DẪN CĂN CHỈNH KHI LỆCH */}
                      {probeStatus.detected && !probeStatus.auto_capture_ready && (
                        <>
                          {/* Lệch phải màn hình -> Nhích sang Trái */}
                          {probeStatus.direction === 'screen_left' && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-1.5 bg-amber-500 text-slate-950 font-black text-xs px-3 py-1.5 rounded-xl shadow-xl animate-pulse">
                              <span>⬅️ Nhích sang TRÁI</span>
                            </div>
                          )}

                          {/* Lệch trái màn hình -> Nhích sang Phải */}
                          {probeStatus.direction === 'screen_right' && (
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center space-x-1.5 bg-amber-500 text-slate-950 font-black text-xs px-3 py-1.5 rounded-xl shadow-xl animate-pulse">
                              <span>Nhích sang PHẢI ➡️</span>
                            </div>
                          )}

                          {/* Mặt quá cao -> Hạ xuống */}
                          {probeStatus.direction === 'down' && (
                            <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center space-x-1.5 bg-amber-500 text-slate-950 font-black text-xs px-3 py-1.5 rounded-xl shadow-xl animate-pulse">
                              <span>⬇️ Hạ đầu / Ngồi thấp xuống</span>
                            </div>
                          )}

                          {/* Mặt quá thấp -> Nâng lên */}
                          {probeStatus.direction === 'up' && (
                            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex items-center space-x-1.5 bg-amber-500 text-slate-950 font-black text-xs px-3 py-1.5 rounded-xl shadow-xl animate-pulse">
                              <span>⬆️ Nâng cằm / Ngồi cao lên</span>
                            </div>
                          )}

                          {/* Quá xa -> Tiến lại gần */}
                          {probeStatus.direction === 'closer' && (
                            <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center space-x-1.5 bg-amber-500 text-slate-950 font-black text-xs px-3.5 py-1.5 rounded-xl shadow-xl animate-bounce">
                              <span>🔍 Hãy tiến lại gần camera hơn</span>
                            </div>
                          )}

                          {/* Quá gần -> Lùi ra xa */}
                          {probeStatus.direction === 'further' && (
                            <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center space-x-1.5 bg-amber-500 text-slate-950 font-black text-xs px-3.5 py-1.5 rounded-xl shadow-xl animate-bounce">
                              <span>🔙 Hãy lùi ra xa camera một chút</span>
                            </div>
                          )}
                        </>
                      )}

                      {/* Dòng chữ hướng dẫn thời gian thực ở đáy khung hình */}
                      <div className="absolute bottom-3 left-4 right-4 text-center">
                        <span className={`inline-block px-3.5 py-1.5 rounded-full text-xs font-extrabold shadow-lg transition-all ${
                          probeStatus.auto_capture_ready
                            ? 'bg-emerald-600/95 text-white ring-2 ring-emerald-400 shadow-emerald-500/40 animate-pulse'
                            : 'bg-black/85 text-amber-300 border border-amber-500/40'
                        }`}>
                          {probeStatus.auto_capture_ready
                            ? `🎯 KHUÔN MẶT CHUẨN XÁC! TỰ ĐỘNG CHỤP TRONG ${autoCountdown || 4}S...`
                            : probeStatus.advice}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Captured indicator */}
                  {capturedSnapshot && (
                    <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-emerald-600/95 text-white text-xs font-black flex items-center space-x-1.5 shadow-lg">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Đã Chụp Thành Công!</span>
                    </div>
                  )}

                </div>

                {/* Scan Action Controls */}
                <div className="mt-2.5 flex items-center space-x-2">
                  {!capturedSnapshot ? (
                    <button
                      type="button"
                      onClick={() => handleCaptureSnapshot(false)}
                      className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-md transition-all border border-slate-700"
                      title="AI đang tự động căn mặt và chụp. Nhấp vào đây nếu muốn chụp ngay lập tức."
                    >
                      <Camera className="w-4 h-4 text-cyan-400" />
                      <span>Chụp Ngay (Hoặc Giữ Yên Để AI Tự Chụp)</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRetakeSnapshot}
                      className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center space-x-1.5 transition-all shadow-md shadow-amber-500/20"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Chụp Lại Khuôn Mặt Khác</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Submit Register Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-extrabold text-xs shadow-lg shadow-cyan-600/20 flex items-center justify-center space-x-2 transition-all disabled:opacity-60 cursor-pointer mt-4"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Đang Trích Xuất Vector...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Lưu Hồ Sơ & Nạp Vector Khuôn Mặt</span>
                </>
              )}
            </button>

          </form>

        </div>

        {/* Right Column: Worker Directory / Roster */}
        <div className="lg:col-span-7 bg-white dark:bg-[#0b101c] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm flex flex-col justify-between min-h-[500px]">
          
          <div>
            {/* Header & Search Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center space-x-2">
                  <span>DANH BẠ CÔNG NHÂN ĐÃ ĐĂNG KÝ</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-mono font-bold">
                    {filteredWorkers.length}
                  </span>
                </h3>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Tìm theo tên, mã NV..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 shadow-xs"
                />
              </div>
            </div>

            {/* Workers List / Grid */}
            {filteredWorkers.length === 0 ? (
              <div className="text-center py-16 px-4 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-200 dark:border-slate-800/80 my-4">
                <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mx-auto mb-3">
                  <UserCheck className="w-7 h-7" />
                </div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-300">
                  {searchQuery ? 'Không tìm thấy công nhân phù hợp' : 'Chưa có công nhân nào trong hệ thống'}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                  Hãy tải ảnh chân dung lên hoặc dùng buồng quét mặt ở cột bên trái để nạp khuôn mặt công nhân đầu tiên!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[560px] overflow-y-auto pr-1">
                {filteredWorkers.map((w) => (
                  <div
                    key={w.id}
                    className="p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/60 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-cyan-500/40 transition-all flex items-start justify-between gap-3 group shadow-xs"
                  >
                    <div className="flex items-start space-x-3 overflow-hidden">
                      {/* Avatar Image */}
                      {w.avatar_url ? (
                        <img
                          src={w.avatar_url}
                          alt={w.full_name}
                          className="w-12 h-12 rounded-xl object-cover border border-slate-300 dark:border-slate-700 shadow-xs shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400 font-bold text-sm shrink-0">
                          {w.full_name?.charAt(0).toUpperCase()}
                        </div>
                      )}

                      {/* Info */}
                      <div className="overflow-hidden">
                        <div className="flex items-center space-x-1.5 mb-0.5">
                          <span className="text-[10px] font-mono font-extrabold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                            {w.employee_code}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-mono font-bold flex items-center">
                            <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                          </span>
                        </div>

                        <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {w.full_name}
                        </h4>

                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {w.department || 'Chưa phân ban'}
                        </p>

                        {w.phone && (
                          <p className="text-[10px] text-slate-400 font-mono truncate">
                            {w.phone}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Delete Action */}
                    <button
                      onClick={() => handleDeleteWorker(w.id, w.full_name)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors shrink-0"
                      title="Xóa công nhân khỏi hệ thống"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Info */}
          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center space-x-1">
              <Cpu className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 mr-1" />
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Tự động đồng bộ</span>
          </div>

        </div>

      </div>

    </div>
  )
}

