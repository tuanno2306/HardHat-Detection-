import React, { useState, useEffect, useRef } from 'react'
import { 
  Calendar, 
  ArrowLeft, 
  Download, 
  Cloud, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  Camera, 
  Clock, 
  User, 
  Maximize2, 
  LayoutGrid, 
  Table as TableIcon,
  RefreshCw,
  ExternalLink,
  Layers,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Sparkles,
  Users,
  Award,
  X,
  FileSpreadsheet,
  AlertCircle,
  HelpCircle,
  Info,
  Filter,
  Check,
  FileText
} from 'lucide-react'

export default function DailyViolationsPage({ onBackToLive, onSelectSnapshot }) {
  const getTodayStr = () => new Date().toISOString().split('T')[0]
  
  const [selectedDate, setSelectedDate] = useState(getTodayStr())
  const [availableDates, setAvailableDates] = useState([])
  const [violations, setViolations] = useState([])
  const [kpi, setKpi] = useState({
    date: getTodayStr(),
    total_incidents: 0,
    total_inspections: 0,
    total_safe: 0,
    total_violations: 0,
    compliance_rate: 100.0
  })
  const [storageStatus, setStorageStatus] = useState(null)
  const [viewMode, setViewMode] = useState('grid') // 'grid' | 'table'
  const [isLoading, setIsLoading] = useState(false)
  const [selectedCameraFilter, setSelectedCameraFilter] = useState('all')
  const [selectedWorkerFilter, setSelectedWorkerFilter] = useState('all') // 'all' | 'identified' | 'unknown'
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false)
  const exportDropdownRef = useRef(null)

  // State cho DeepFace & Qdrant Worker Identification
  const [isIdentifying, setIsIdentifying] = useState(false)
  const [auditSummary, setAuditSummary] = useState(null)
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false)
  const [statusNotification, setStatusNotification] = useState(null)

  // 1. Tải danh sách các ngày có dữ liệu vi phạm
  const fetchAvailableDates = async () => {
    try {
      const res = await fetch('/api/violations/dates')
      if (res.ok) {
        const data = await res.json()
        setAvailableDates(data || [])
      }
    } catch (e) {
      console.warn("Lỗi fetch dates:", e)
    }
  }

  // 2. Tải dữ liệu vi phạm và chỉ số an toàn của ngày được chọn
  const fetchDayData = async (dateStr) => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/violations/by-date?date=${dateStr}`)
      if (res.ok) {
        const data = await res.json()
        setViolations(data.violations || [])
        if (data.kpi) setKpi(data.kpi)
        if (data.storage) setStorageStatus(data.storage)
      }
    } catch (e) {
      console.error("Lỗi fetch violations by date:", e)
    } finally {
      setIsLoading(false)
    }
  }

  // 3. Tải trước tổng hợp kỷ luật công nhân theo ngày (nếu có)
  const fetchWorkerSummary = async (dateStr) => {
    try {
      const res = await fetch(`/api/violations/summary-by-worker?date=${dateStr}`)
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.summary) {
          setAuditSummary(data.summary)
        }
      }
    } catch (e) {
      console.warn("Lỗi fetch worker summary:", e)
    }
  }

  useEffect(() => {
    fetchAvailableDates()
  }, [])

  useEffect(() => {
    if (selectedDate) {
      fetchDayData(selectedDate)
      fetchWorkerSummary(selectedDate)
    }
  }, [selectedDate])

  // Đóng Export Dropdown khi bấm ra ngoài
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target)) {
        setIsExportMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Phím tắt bàn phím (Keyboard Shortcuts)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return

      // Alt + A hoặc A: Kích hoạt tổng hợp AI
      if ((e.altKey && e.key.toLowerCase() === 'a') || (!e.altKey && !e.ctrlKey && e.key.toLowerCase() === 'a')) {
        if (!isIdentifying && violations.length > 0) {
          e.preventDefault()
          handleIdentifyWorkers()
        }
      } 
      // Alt + K hoặc K: Mở bảng kỷ luật
      else if ((e.altKey && e.key.toLowerCase() === 'k') || (!e.altKey && !e.ctrlKey && e.key.toLowerCase() === 'k')) {
        if (auditSummary && (auditSummary.workers?.length > 0 || auditSummary.total_violations > 0)) {
          e.preventDefault()
          setIsAuditModalOpen(true)
        }
      } 
      // V: Chuyển đổi Lưới <-> Bảng
      else if (!e.altKey && !e.ctrlKey && e.key.toLowerCase() === 'v') {
        e.preventDefault()
        setViewMode(prev => prev === 'grid' ? 'table' : 'grid')
      } 
      // R: Làm mới dữ liệu
      else if (!e.altKey && !e.ctrlKey && e.key.toLowerCase() === 'r') {
        e.preventDefault()
        fetchDayData(selectedDate)
        fetchWorkerSummary(selectedDate)
      }
      // Alt + E: Xuất báo cáo ngày
      else if (e.altKey && e.key.toLowerCase() === 'e') {
        e.preventDefault()
        handleExportCSV()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isIdentifying, violations.length, auditSummary, selectedDate])

  const handleExportCSV = () => {
    window.location.href = `/api/violations/export-by-date?date=${selectedDate}`
    setIsExportMenuOpen(false)
  }

  const handleExportWorkerAuditCSV = () => {
    window.location.href = `/api/violations/export-worker-audit-csv?date=${selectedDate}`
    setIsExportMenuOpen(false)
  }

  // Điều hướng ngày trước / sau
  const handleShiftDay = (days) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + days)
    setSelectedDate(d.toISOString().split('T')[0])
  }

  // Nút hành động: Kích hoạt DeepFace Facial Recognition & Qdrant Vector Matching
  const handleIdentifyWorkers = async () => {
    setIsIdentifying(true)
    setStatusNotification({
      type: 'info',
      message: 'Đang dùng DeepFace bóc tách khuôn mặt & truy vấn Qdrant Vector DB (512 chiều)...'
    })

    try {
      const res = await fetch(`/api/violations/identify-daily?date=${selectedDate}`, {
        method: 'POST'
      })
      const data = await res.json()

      if (data.success) {
        setAuditSummary(data.summary)
        await fetchDayData(selectedDate)
        setIsAuditModalOpen(true)
        setStatusNotification({
          type: 'success',
          message: `Đối soát AI hoàn tất: Đã nhận diện ${data.matched_violations}/${data.total_processed} lượt vi phạm!`
        })
      } else {
        setStatusNotification({
          type: 'error',
          message: data.message || 'Không thể nhận diện danh tính công nhân.'
        })
      }
    } catch (e) {
      console.error("Lỗi đối soát khuôn mặt DeepFace:", e)
      setStatusNotification({
        type: 'error',
        message: 'Lỗi kết nối máy chủ khi nhận diện khuôn mặt: ' + e.message
      })
    } finally {
      setIsIdentifying(false)
      setTimeout(() => setStatusNotification(null), 6000)
    }
  }

  // Thống kê nhanh danh tính
  const identifiedViolationsCount = violations.filter(v => v.matched_worker_id).length
  const unknownViolationsCount = violations.length - identifiedViolationsCount

  // Lọc theo camera và theo danh tính công nhân
  const filteredViolations = violations.filter(v => {
    const matchCam = selectedCameraFilter === 'all' 
      ? true 
      : (String(v.camera_id) === String(selectedCameraFilter) || v.camera_name === selectedCameraFilter)

    const matchWorker = selectedWorkerFilter === 'all'
      ? true
      : selectedWorkerFilter === 'identified'
        ? !!v.matched_worker_id
        : !v.matched_worker_id

    return matchCam && matchWorker
  })

  // Danh sách camera duy nhất xuất hiện trong ngày
  const uniqueCameras = Array.from(new Set(violations.map(v => v.camera_name || 'Camera Giám Sát')))

  return (
    <div className="max-w-7xl mx-auto w-full px-3 sm:px-4 py-4 flex-1 animate-fade-in text-slate-800 dark:text-slate-100 transition-colors duration-200">
      
      {/* ========================================================
          1. TOP HEADER BAR: Back + Page Title + Date Navigator
          ======================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-200 dark:border-slate-800">
        
        {/* Left: Back button & Title */}
        <div className="flex items-center space-x-3">
          <button
            onClick={onBackToLive}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-all shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Quay lại Giám Sát</span>
          </button>
          
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center tracking-tight">
              <span>NHẬT KÝ VI PHẠM THEO NGÀY</span>
              <span className="ml-2.5 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-center space-x-1">
                <ShieldCheck className="w-3 h-3 mr-1 text-amber-500" />
                <span>Hồ Sơ An Toàn</span>
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
              Tra cứu hồ sơ kiểm toán vi phạm mũ bảo hộ, đối chiếu hình ảnh bằng chứng công nhân
            </p>
          </div>
        </div>

        {/* Right: Date Navigator (Bộ điều hướng ngày gọn gàng & đồng bộ) */}
        <div className="flex items-center space-x-1 bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          {/* Nút Ngày trước */}
          <button
            onClick={() => handleShiftDay(-1)}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
            title="Xem ngày trước"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Ô chọn ngày HTML5 Native */}
          <div className="relative">
            <Calendar className="w-3.5 h-3.5 text-amber-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input 
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent pl-8 pr-2 py-1 text-xs font-extrabold text-slate-900 dark:text-white focus:outline-none cursor-pointer"
            />
          </div>

          {/* Nút Ngày sau */}
          <button
            onClick={() => handleShiftDay(1)}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
            title="Xem ngày sau"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Nút Về Hôm Nay (nếu đang ở ngày khác) */}
          {selectedDate !== getTodayStr() && (
            <button
              onClick={() => setSelectedDate(getTodayStr())}
              className="px-2 py-1 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/25 text-[11px] font-bold transition-colors"
            >
              Hôm nay
            </button>
          )}

          {/* Nút Tải lại */}
          <button
            onClick={() => {
              fetchDayData(selectedDate)
              fetchWorkerSummary(selectedDate)
            }}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
            title="Làm mới dữ liệu (Phím R)"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-500' : ''}`} />
          </button>
        </div>

      </div>

      {/* Thông Báo Trạng Thái Notification */}
      {statusNotification && (
        <div className={`mb-4 px-4 py-3 rounded-2xl border flex items-center justify-between text-xs font-medium animate-fade-in ${
          statusNotification.type === 'success'
            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
            : statusNotification.type === 'error'
              ? 'bg-red-500/15 border-red-500/30 text-red-700 dark:text-red-300'
              : 'bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300'
        }`}>
          <div className="flex items-center space-x-2">
            {statusNotification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : statusNotification.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            ) : (
              <Sparkles className="w-4 h-4 text-amber-500 animate-spin shrink-0" />
            )}
            <span>{statusNotification.message}</span>
          </div>
          <button 
            onClick={() => setStatusNotification(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Date Quick Filter Pills */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1 flex items-center">
          <Clock className="w-3.5 h-3.5 mr-1" />
          Các ngày có dữ liệu:
        </span>
        {availableDates.length === 0 ? (
          <span className="text-xs text-slate-400 font-mono">Chưa có ngày nào được ghi nhận</span>
        ) : (
          availableDates.map((item) => (
            <button
              key={item.date_str}
              onClick={() => setSelectedDate(item.date_str)}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 shadow-xs ${
                selectedDate === item.date_str
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-white hover:bg-slate-50 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white border border-slate-200 dark:border-slate-800'
              }`}
            >
              <span>{item.date_str}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                selectedDate === item.date_str ? 'bg-slate-950/40 text-slate-950 font-black' : 'bg-red-500/15 text-red-700 dark:text-red-400'
              }`}>
                {item.total_incidents} vụ
              </span>
            </button>
          ))
        )}
      </div>

      {/* Daily KPI Bento Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
        
        {/* Card 1: Số Vụ Vi Phạm */}
        <div className="p-4 rounded-2xl bg-white dark:bg-gradient-to-br dark:from-slate-900 dark:to-[#0e1424] border border-red-200 dark:border-red-500/20 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">Vi Phạm Trong Ngày</span>
            <div className="p-1.5 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">{kpi.total_violations}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">lượt vi phạm</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 font-medium flex items-center justify-between">
            <span>{kpi.total_incidents} thời điểm</span>
            {identifiedViolationsCount > 0 && (
              <span className="text-cyan-600 dark:text-cyan-400 font-bold">
                {identifiedViolationsCount} đã định danh
              </span>
            )}
          </div>
        </div>

        {/* Card 2: Tuân Thủ An Toàn */}
        <div className="p-4 rounded-2xl bg-white dark:bg-gradient-to-br dark:from-slate-900 dark:to-[#0e1424] border border-emerald-200 dark:border-emerald-500/20 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Lượt Hợp Lệ (Đội Mũ)</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">{kpi.total_safe}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">người an toàn</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 font-medium">
            Công nhân chấp hành tốt
          </div>
        </div>

        {/* Card 3: Tỷ Lệ Tuân Thủ */}
        <div className="p-4 rounded-2xl bg-white dark:bg-gradient-to-br dark:from-slate-900 dark:to-[#0e1424] border border-amber-200 dark:border-amber-500/20 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Tỷ Lệ Tuân Thủ KPI</span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">{kpi.compliance_rate}%</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">mục tiêu &gt; 95%</span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${
                kpi.compliance_rate >= 90 ? 'bg-emerald-500' : kpi.compliance_rate >= 70 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(100, kpi.compliance_rate)}%` }}
            ></div>
          </div>
        </div>

        {/* Card 4: Evidence Storage Status */}
        <div className="p-4 rounded-2xl bg-white dark:bg-gradient-to-br dark:from-slate-900 dark:to-[#0e1424] border border-cyan-200 dark:border-cyan-500/20 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-cyan-700 dark:text-cyan-400 uppercase tracking-wider">Lưu Trữ Bằng Chứng</span>
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
              <Cloud className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Bộ Nhớ Trực Tuyến</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Dữ liệu: <span className="text-cyan-700 dark:text-cyan-300 font-mono font-medium">Đã đồng bộ</span></span>
            <span className="text-emerald-700 dark:text-emerald-400 font-mono text-[10px] font-bold">An toàn</span>
          </div>
        </div>

      </div>

      {/* ========================================================
          2. UNIFIED COMMAND & CONTROL TOOLBAR (THEO UI/UX PRO MAX)
          Sắp xếp gọn gàng: Lọc bên trái | Nút AI ở giữa | Phím tắt & Chế độ xem bên phải
          ======================================================== */}
      <div className="mb-5 p-3 rounded-2xl bg-white dark:bg-[#0b101c] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
        
        {/* Phân khu 1: Bộ Lọc Camera & Phân Loại Danh Tính */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Lọc Camera */}
          <div className="flex items-center space-x-1.5 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
            <Camera className="w-3.5 h-3.5 text-slate-400" />
            <select 
              value={selectedCameraFilter}
              onChange={(e) => setSelectedCameraFilter(e.target.value)}
              className="bg-transparent text-slate-800 dark:text-white font-medium focus:outline-none cursor-pointer"
            >
              <option value="all">Tất cả camera ({violations.length})</option>
              {uniqueCameras.map((cam) => (
                <option key={cam} value={cam}>{cam}</option>
              ))}
            </select>
          </div>

          {/* Lọc Theo Trạng Thái Danh Tính */}
          <div className="flex items-center space-x-1.5 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedWorkerFilter}
              onChange={(e) => setSelectedWorkerFilter(e.target.value)}
              className="bg-transparent text-slate-800 dark:text-white font-medium focus:outline-none cursor-pointer"
            >
              <option value="all">Tất cả hồ sơ ({violations.length})</option>
              <option value="identified">🟢 Đã định danh ({identifiedViolationsCount})</option>
              <option value="unknown">🔴 Chưa định danh ({unknownViolationsCount})</option>
            </select>
          </div>

        </div>

        {/* Phân khu 2: Nút Hành Động Trọng Tâm (Primary Hero Button) */}
        <div className="flex items-center">
          <button
            onClick={handleIdentifyWorkers}
            disabled={isIdentifying || violations.length === 0}
            className="w-full sm:w-auto flex items-center justify-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 text-xs font-black transition-all shadow-md shadow-amber-500/25 disabled:opacity-50 disabled:cursor-not-allowed group active:scale-[0.98]"
            title="Quét đối soát ảnh vi phạm bằng DeepFace & Qdrant 512D (Phím tắt: A hoặc Alt+A)"
          >
            {isIdentifying ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                <span>AI Đang Quét Khuôn Mặt...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-slate-950 transition-transform group-hover:scale-125" />
                <span>Tổng Hợp Công Nhân Vi Phạm (AI)</span>
                <kbd className="hidden sm:inline-block ml-1 px-1.5 py-0.2 rounded bg-black/20 text-[10px] font-mono text-slate-950 font-bold">
                  Alt+A
                </kbd>
              </>
            )}
          </button>
        </div>

        {/* Phân khu 3: Nhóm Phím Tắt Thao Tác Phụ & Chuyển Chế Độ Xem */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Nút Xem Bảng Kỷ Luật Cá Nhân */}
          <button
            onClick={() => setIsAuditModalOpen(true)}
            disabled={!auditSummary || (auditSummary.workers?.length === 0 && auditSummary.total_violations === 0)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-xs ${
              auditSummary && auditSummary.workers?.length > 0
                ? 'bg-cyan-500/15 hover:bg-cyan-500/25 border-cyan-500/30 text-cyan-700 dark:text-cyan-300'
                : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 cursor-not-allowed'
            }`}
            title="Xem báo cáo xếp hạng kỷ luật công nhân theo ngày (Phím tắt: K hoặc Alt+K)"
          >
            <Award className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <span>Bảng Kỷ Luật</span>
            {auditSummary?.workers?.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-cyan-500/25 text-cyan-800 dark:text-cyan-200 font-mono text-[10px]">
                {auditSummary.workers.length}
              </span>
            )}
            <kbd className="hidden xl:inline-block px-1 rounded bg-black/10 dark:bg-white/10 text-[9px] font-mono">
              Alt+K
            </kbd>
          </button>

          {/* Dropdown Gom Gọn: Xuất Báo Cáo (CSV) */}
          <div className="relative" ref={exportDropdownRef}>
            <button
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold transition-all shadow-xs"
              title="Tải các loại báo cáo kiểm toán định dạng CSV / Excel"
            >
              <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Xuất Báo Cáo</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExportMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Menu Thả Xuống của Nút Xuất Báo Cáo */}
            {isExportMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-1.5 z-30 animate-fade-in text-xs">
                <button
                  onClick={handleExportCSV}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between text-slate-700 dark:text-slate-200 transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-emerald-500" />
                    <span className="font-semibold">Báo Cáo Vi Phạm Ngày</span>
                  </div>
                  <kbd className="text-[10px] font-mono text-slate-400">Alt+E</kbd>
                </button>

                <button
                  onClick={handleExportWorkerAuditCSV}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between text-slate-700 dark:text-slate-200 transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <FileSpreadsheet className="w-4 h-4 text-cyan-500" />
                    <span className="font-semibold">Báo Cáo Kỷ Luật AI</span>
                  </div>
                  <span className="text-[10px] text-cyan-500 font-bold">DeepFace</span>
                </button>
              </div>
            )}
          </div>

          {/* Segmented View Mode Switcher (Lưới Ảnh / Bảng Kiểm Toán) */}
          <div className="flex items-center space-x-0.5 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 sm:px-2.5 sm:py-1 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 ${
                viewMode === 'grid' 
                  ? 'bg-amber-500 text-slate-950 shadow-sm' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Chế độ lưới ảnh (Phím V)"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Lưới</span>
            </button>

            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 sm:px-2.5 sm:py-1 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 ${
                viewMode === 'table' 
                  ? 'bg-amber-500 text-slate-950 shadow-sm' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Chế độ bảng kiểm toán (Phím V)"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Bảng</span>
            </button>
          </div>

        </div>

      </div>

      {/* Main Content Area: Gallery Grid vs Table View */}
      {filteredViolations.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900/40 rounded-3xl border border-slate-200 dark:border-slate-800/80 my-8 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-3 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Không Có Vi Phạm Nào Trong Bộ Lọc Ngày {selectedDate}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
            Toàn bộ công nhân bước vào công trường đều tuân thủ đội mũ bảo hộ hợp lệ 100% hoặc không có vi phạm nào khớp với bộ lọc hiện tại.
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* DẠNG 1: GALLERY GRID VỚI ẢNH BẰNG CHỨNG LỚN & THẺ ĐỊNH DANH CÔNG NHÂN */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredViolations.map((v, idx) => {
            const imageUrl = v.snapshot_path 
              ? `/api/violations/image/${v.snapshot_path}`
              : null

            return (
              <div 
                key={v.id || idx}
                className={`bg-white dark:bg-[#0b101c] rounded-2xl border overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between group ${
                  v.matched_worker_id
                    ? 'border-cyan-500/40 dark:border-cyan-500/30 hover:border-cyan-400'
                    : 'border-slate-200 dark:border-slate-800/90 hover:border-red-400 dark:hover:border-red-500/50'
                }`}
              >
                {/* Image Snapshot with Evidence Badge */}
                <div className="relative aspect-video bg-slate-900 overflow-hidden">
                  {imageUrl ? (
                    <img 
                      src={imageUrl} 
                      alt={`Vi phạm #${v.id}`}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">
                      Không có ảnh chụp
                    </div>
                  )}

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none"></div>

                  {/* Evidence Verified Pill */}
                  <div className="absolute top-2 left-2 flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-md border border-emerald-500/30 text-[10px] font-bold text-emerald-300">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    <span>Bằng Chứng Số</span>
                  </div>

                  {/* Violation Count Badge */}
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded-lg bg-red-600/90 text-white text-[10px] font-black uppercase tracking-wider shadow">
                    {v.violation_count} Vi Phạm
                  </div>

                  {/* Zoom Action Button */}
                  {imageUrl && (
                    <button
                      onClick={() => onSelectSnapshot(imageUrl)}
                      className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/60 hover:bg-amber-500 hover:text-slate-950 text-white border border-white/20 transition-all shadow"
                      title="Phóng to ảnh bằng chứng (Lightbox)"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Timestamp Overlay */}
                  <div className="absolute bottom-2 left-2 text-[11px] font-mono font-bold text-white flex items-center space-x-1">
                    <Clock className="w-3 h-3 text-amber-400" />
                    <span>{v.time_only || v.timestamp}</span>
                  </div>
                </div>

                {/* Card Info Details */}
                <div className="p-3.5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                      <span className="font-semibold text-slate-800 dark:text-slate-300 truncate max-w-[150px] flex items-center">
                        <Camera className="w-3 h-3 mr-1 text-slate-400" />
                        {v.camera_name || 'Camera Giám Sát'}
                      </span>
                      <span className="font-mono text-amber-700 dark:text-amber-400 text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 border border-amber-500/20 font-bold">
                        {v.confidence_pct || 90}% tin cậy
                      </span>
                    </div>

                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 line-clamp-2">
                      {v.details || 'Không đội mũ bảo hộ khi bước vào công trường'}
                    </p>

                    {/* KHỐI NHẬN DIỆN DANH TÍNH CÔNG NHÂN (DEEPFACE & QDRANT) */}
                    {v.matched_worker_name ? (
                      <div className="mt-2.5 p-2 rounded-xl bg-cyan-500/10 dark:bg-cyan-950/30 border border-cyan-500/30 flex items-center space-x-2.5">
                        <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-800 shrink-0 border border-cyan-500/40">
                          {v.matched_worker_avatar ? (
                            <img 
                              src={`/api/workers/avatar/${v.matched_worker_avatar}`} 
                              alt={v.matched_worker_name} 
                              className="w-full h-full object-cover" 
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-cyan-500">
                              <User className="w-4 h-4" />
                            </div>
                          )}
                        </div>
                        <div className="overflow-hidden flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-extrabold text-cyan-800 dark:text-cyan-300 truncate">
                              {v.matched_worker_name}
                            </span>
                            <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded border border-emerald-500/20">
                              {v.match_similarity_pct || 90}% khớp
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {v.matched_worker_code ? `Mã: ${v.matched_worker_code}` : ''} {v.matched_worker_dept ? `• ${v.matched_worker_dept}` : ''}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                        <span className="flex items-center space-x-1">
                          <HelpCircle className="w-3 h-3 text-slate-400" />
                          <span>Chưa xác định danh tính</span>
                        </span>
                        <span className="text-slate-400 text-[9px] font-mono">Bấm Tổng Hợp AI</span>
                      </div>
                    )}
                  </div>

                  {/* Footer: Cán bộ trực ca ghi nhận */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                    <span className="flex items-center space-x-1 truncate">
                      <User className="w-3 h-3 text-slate-400" />
                      <span>Trực ca: <strong className="text-slate-700 dark:text-slate-300 font-semibold">{v.detected_by_name || 'Hệ Thống'}</strong></span>
                    </span>
                    <span className="font-mono text-slate-400 font-bold">#{v.id}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* DẠNG 2: BẢNG KIỂM TOÁN CHUYÊN NGHIỆP CÓ CỘT ĐỊNH DANH CÔNG NHÂN */
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b101c] shadow-sm">
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">STT</th>
                <th className="py-3 px-4">Thời Gian</th>
                <th className="py-3 px-4">Ảnh Bằng Chứng</th>
                <th className="py-3 px-4">Công Nhân Vi Phạm (AI)</th>
                <th className="py-3 px-4">Vị Trí / Camera</th>
                <th className="py-3 px-4">Số Người</th>
                <th className="py-3 px-4">Cán Bộ Trực Ca</th>
                <th className="py-3 px-4">Độ Tin Cậy</th>
                <th className="py-3 px-4">Mô Tả Vi Phạm</th>
                <th className="py-3 px-4 text-center">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
              {filteredViolations.map((v, idx) => {
                const imageUrl = v.snapshot_path 
                  ? `/api/violations/image/${v.snapshot_path}`
                  : null

                return (
                  <tr key={v.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-500 font-bold">{v.id}</td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-900 dark:text-white">{v.timestamp}</td>
                    <td className="py-3 px-4">
                      {imageUrl ? (
                        <button
                          onClick={() => onSelectSnapshot(imageUrl)}
                          className="relative rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 hover:border-amber-500 transition-all group block shadow-xs"
                        >
                          <img src={imageUrl} alt="" className="w-14 h-9 object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center">
                            <Maximize2 className="w-3 h-3 text-white" />
                          </div>
                        </button>
                      ) : (
                        <span className="text-slate-400 font-mono text-[10px]">Trống</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {v.matched_worker_name ? (
                        <div className="flex items-center space-x-2">
                          <div className="w-7 h-7 rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-800 shrink-0 border border-cyan-500/40">
                            {v.matched_worker_avatar ? (
                              <img 
                                src={`/api/workers/avatar/${v.matched_worker_avatar}`} 
                                alt="" 
                                className="w-full h-full object-cover" 
                              />
                            ) : (
                              <User className="w-4 h-4 m-1.5 text-cyan-500" />
                            )}
                          </div>
                          <div>
                            <div className="font-extrabold text-cyan-800 dark:text-cyan-300 flex items-center space-x-1">
                              <span>{v.matched_worker_name}</span>
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                                ({v.match_similarity_pct}%)
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {v.matched_worker_code || ''} {v.matched_worker_dept ? `| ${v.matched_worker_dept}` : ''}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Chưa xác định</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">{v.camera_name || 'Camera Giám Sát'}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full bg-red-500/15 text-red-700 dark:text-red-300 font-bold font-mono">
                        {v.violation_count} người
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-medium">{v.detected_by_name || 'Hệ Thống'}</td>
                    <td className="py-3 px-4 font-mono text-amber-700 dark:text-amber-400 font-bold">{v.confidence_pct || 90}%</td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300 max-w-xs truncate">{v.details}</td>
                    <td className="py-3 px-4 text-center">
                      {imageUrl && (
                        <button
                          onClick={() => onSelectSnapshot(imageUrl)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-amber-500 hover:text-slate-950 dark:bg-slate-800 dark:hover:bg-amber-500 dark:hover:text-slate-950 text-slate-600 dark:text-slate-300 transition-colors shadow-xs"
                          title="Xem ảnh chi tiết"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ========================================================
          MODAL: BẢNG TỔNG HỢP & XẾP HẠNG KỶ LUẬT CÔNG NHÂN (AUDIT)
          ======================================================== */}
      {isAuditModalOpen && auditSummary && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fade-in">
          <div className="bg-white dark:bg-[#0b101c] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-[#0e1424]">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white flex items-center tracking-tight">
                    <span>BÁO CÁO KỶ LUẬT CÔNG NHÂN THEO NGÀY</span>
                    <span className="ml-2 px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 font-mono text-xs font-black">
                      {selectedDate}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center space-x-1.5 mt-0.5">
                    <span>Đối soát khuôn mặt tự động bằng</span>
                    <span className="font-semibold text-cyan-600 dark:text-cyan-400">DeepFace AI & Qdrant 512D</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleExportWorkerAuditCSV}
                  className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold transition-all shadow-sm"
                  title="Tải file Excel/CSV báo cáo kỷ luật này"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Tải Báo Cáo Kỷ Luật (CSV)</span>
                </button>

                <button
                  onClick={() => setIsAuditModalOpen(false)}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="p-6 overflow-y-auto space-y-6">
              
              {/* 3 Metric Bento Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Tổng Vụ Vi Phạm
                  </span>
                  <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white font-mono">
                    {auditSummary.total_violations}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Toàn bộ vi phạm camera ghi nhận</p>
                </div>

                <div className="p-4 rounded-2xl bg-cyan-500/10 dark:bg-cyan-950/30 border border-cyan-500/30">
                  <span className="text-[11px] font-bold text-cyan-700 dark:text-cyan-400 uppercase tracking-wider">
                    Đã Xác Định Danh Tính
                  </span>
                  <div className="mt-2 text-2xl font-black text-cyan-800 dark:text-cyan-300 font-mono">
                    {auditSummary.identified_count}
                    <span className="text-xs font-normal text-cyan-600 dark:text-cyan-400 ml-1.5">
                      ({auditSummary.total_violations > 0 ? Math.round((auditSummary.identified_count / auditSummary.total_violations) * 100) : 0}%)
                    </span>
                  </div>
                  <p className="text-[11px] text-cyan-700/80 dark:text-cyan-400/80 mt-1">Trùng khớp hồ sơ công nhân Qdrant</p>
                </div>

                <div className="p-4 rounded-2xl bg-amber-500/10 dark:bg-amber-950/30 border border-amber-500/30">
                  <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                    Chưa Định Danh (Khách / Khác)
                  </span>
                  <div className="mt-2 text-2xl font-black text-amber-800 dark:text-amber-300 font-mono">
                    {auditSummary.unknown_count}
                  </div>
                  <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 mt-1">Người ngoài chưa lưu vector</p>
                </div>
              </div>

              {/* BẢNG XẾP HẠNG CÔNG NHÂN VI PHẠM (DISCIPLINARY RANKING) */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-tight flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                    <span>Xếp Hạng Công Nhân Vi Phạm Nhiều Nhất</span>
                  </h4>
                  <span className="text-xs text-slate-500">
                    Sắp xếp theo số lượt vi phạm giảm dần
                  </span>
                </div>

                {auditSummary.workers && auditSummary.workers.length > 0 ? (
                  <div className="space-y-3">
                    {auditSummary.workers.map((worker, rankIdx) => {
                      const simPct = Math.round((worker.highest_similarity || 0) * 100)
                      return (
                        <div 
                          key={worker.worker_id}
                          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/90 shadow-sm hover:border-amber-500/50 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                        >
                          {/* Worker Left Info */}
                          <div className="flex items-center space-x-3.5 min-w-0">
                            {/* Rank Badge */}
                            <div className={`w-8 h-8 rounded-xl font-black font-mono flex items-center justify-center text-sm shrink-0 shadow-sm ${
                              rankIdx === 0 
                                ? 'bg-red-500 text-white shadow-red-500/30' 
                                : rankIdx === 1 
                                  ? 'bg-amber-500 text-slate-950 shadow-amber-500/30' 
                                  : rankIdx === 2
                                    ? 'bg-amber-600/80 text-white'
                                    : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}>
                              #{rankIdx + 1}
                            </div>

                            {/* Avatar */}
                            <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 shrink-0">
                              {worker.avatar_path ? (
                                <img 
                                  src={`/api/workers/avatar/${worker.avatar_path}`} 
                                  alt={worker.full_name} 
                                  className="w-full h-full object-cover" 
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-400">
                                  <User className="w-6 h-6" />
                                </div>
                              )}
                            </div>

                            {/* Name & Dept */}
                            <div className="min-w-0">
                              <h5 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                                {worker.full_name}
                              </h5>
                              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center space-x-2 mt-0.5">
                                <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                                  Mã: {worker.employee_code}
                                </span>
                                <span>•</span>
                                <span>{worker.department || 'Đội Thi Công'}</span>
                              </p>
                              <div className="flex items-center space-x-2 mt-1">
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold">
                                  Độ khớp AI: {simPct}%
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  Lần cuối: {worker.latest_time}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Worker Right: Violation Count & Timeline */}
                          <div className="flex flex-col md:items-end justify-center shrink-0">
                            <div className="flex items-center space-x-2">
                              <span className="px-3 py-1 rounded-full bg-red-500 text-white font-black text-xs shadow-sm">
                                {worker.violation_count} LẦN VI PHẠM
                              </span>
                            </div>

                            {/* Timeline Chips */}
                            {worker.time_list && worker.time_list.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2 max-w-xs justify-start md:justify-end">
                                {worker.time_list.slice(0, 5).map((t, tIdx) => (
                                  <span 
                                    key={tIdx}
                                    className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-mono text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                                  >
                                    {t}
                                  </span>
                                ))}
                                {worker.time_list.length > 5 && (
                                  <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-mono text-slate-500">
                                    +{worker.time_list.length - 5}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Violation Snapshots Gallery */}
                            {worker.snapshot_list && worker.snapshot_list.length > 0 && (
                              <div className="flex items-center space-x-1.5 mt-2">
                                <span className="text-[10px] text-slate-400 mr-1">Bằng chứng:</span>
                                {worker.snapshot_list.slice(0, 3).map((snap, sIdx) => (
                                  <button
                                    key={sIdx}
                                    onClick={() => onSelectSnapshot(`/api/violations/image/${snap}`)}
                                    className="w-8 h-8 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 hover:border-amber-500 transition-all shadow-xs"
                                    title="Nhấn để phóng to ảnh vi phạm"
                                  >
                                    <img 
                                      src={`/api/violations/image/${snap}`} 
                                      alt="" 
                                      className="w-full h-full object-cover" 
                                    />
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <p className="text-xs text-slate-500">
                      Chưa có công nhân nào được xác định danh tính. Hãy đăng ký công nhân tại mục <strong>Workers</strong> và bấm nút <strong>"Tổng Hợp Công Nhân Vi Phạm (AI)"</strong> để hệ thống tự động quét lại!
                    </p>
                  </div>
                )}
              </div>

              {/* CÁC TRƯỜNG HỢP CHƯA XÁC ĐỊNH DANH TÍNH (UNKNOWN / VISITORS) */}
              {auditSummary.unknown_count > 0 && auditSummary.unknown_details && (
                <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider flex items-center space-x-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      <span>{auditSummary.unknown_count} Vụ Vi Phạm Chưa Xác Định Được Danh Tính</span>
                    </h5>
                    <span className="text-[11px] text-slate-500">
                      (Người ngoài, khách tham quan, hoặc công nhân chưa nạp khuôn mặt)
                    </span>
                  </div>

                  {auditSummary.unknown_details.unknown_snapshots && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {auditSummary.unknown_details.unknown_snapshots.slice(0, 8).map((snap, uIdx) => (
                        <button
                          key={uIdx}
                          onClick={() => onSelectSnapshot(`/api/violations/image/${snap}`)}
                          className="w-16 h-12 rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700 hover:border-amber-500 transition-all shadow-xs group relative"
                        >
                          <img 
                            src={`/api/violations/image/${snap}`} 
                            alt="" 
                            className="w-full h-full object-cover" 
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Maximize2 className="w-3.5 h-3.5 text-white" />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0e1424] flex items-center justify-between">
              <span className="text-xs text-slate-500 hidden sm:inline">
                Dữ liệu được lưu trữ tự động trong PostgreSQL & MinIO
              </span>

              <div className="flex items-center space-x-2 ml-auto">
                <button
                  onClick={handleExportWorkerAuditCSV}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>Xuất Báo Cáo Kỷ Luật (CSV)</span>
                </button>

                <button
                  onClick={() => setIsAuditModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-colors"
                >
                  Đóng
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
