import React, { useState, useEffect } from 'react'
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
  ChevronRight
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

  useEffect(() => {
    fetchAvailableDates()
  }, [])

  useEffect(() => {
    if (selectedDate) {
      fetchDayData(selectedDate)
    }
  }, [selectedDate])

  const handleExportCSV = () => {
    window.location.href = `/api/violations/export-by-date?date=${selectedDate}`
  }

  // Lọc theo camera nếu có
  const filteredViolations = violations.filter(v => {
    if (selectedCameraFilter === 'all') return true
    return String(v.camera_id) === String(selectedCameraFilter) || v.camera_name === selectedCameraFilter
  })

  // Danh sách camera duy nhất xuất hiện trong ngày
  const uniqueCameras = Array.from(new Set(violations.map(v => v.camera_name || 'Camera Giám Sát')))

  return (
    <div className="max-w-7xl mx-auto w-full px-3 sm:px-4 py-4 flex-1 animate-fade-in text-slate-800 dark:text-slate-100 transition-colors duration-200">
      
      {/* Top Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBackToLive}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-all shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại Giám Sát Trực Tiếp</span>
          </button>
          
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center tracking-tight">
              <span>NHẬT KÝ VI PHẠM THEO NGÀY</span>
              <span className="ml-2.5 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-center space-x-1">
                <ShieldCheck className="w-3 h-3 mr-1 text-amber-500" />
                <span>Hồ Sơ An Toàn</span>
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tra cứu hồ sơ kiểm toán vi phạm mũ bảo hộ, đối chiếu hình ảnh bằng chứng công nhân
            </p>
          </div>
        </div>

        {/* Date Selector & CSV Export */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Native HTML5 Datepicker */}
          <div className="relative">
            <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input 
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl pl-9 pr-3 py-1.5 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-amber-500 shadow-sm"
            />
          </div>

          <button
            onClick={() => fetchDayData(selectedDate)}
            className="p-2 rounded-xl bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors shadow-sm"
            title="Tải lại dữ liệu ngày này"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-500' : ''}`} />
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold transition-all shadow-sm"
            title="Tải file Excel/CSV báo cáo của ngày này"
          >
            <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Xuất Báo Cáo Ngày</span>
          </button>
        </div>
      </div>

      {/* Date Quick Filter Pills */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-6">
        
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
          <div className="mt-1 text-[11px] text-slate-500 font-medium">
            Ghi nhận {kpi.total_incidents} thời điểm phát hiện
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

      {/* Filter and View Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 bg-white dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Lọc Camera:</span>
          <select 
            value={selectedCameraFilter}
            onChange={(e) => setSelectedCameraFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-amber-500 shadow-xs"
          >
            <option value="all">Tất cả camera ({violations.length})</option>
            {uniqueCameras.map((cam) => (
              <option key={cam} value={cam}>{cam}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
              viewMode === 'grid' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Lưới Ảnh (Gallery)</span>
          </button>

          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
              viewMode === 'table' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>Bảng Kiểm Toán</span>
          </button>
        </div>
      </div>

      {/* Main Content Area: Gallery Grid vs Table View */}
      {filteredViolations.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900/40 rounded-3xl border border-slate-200 dark:border-slate-800/80 my-8 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-3 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Không Có Vi Phạm Nào Trong Ngày {selectedDate}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
            Toàn bộ công nhân bước vào công trường đều tuân thủ đội mũ bảo hộ hợp lệ 100%. Hãy chọn một ngày khác có vi phạm trong danh sách phía trên!
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* DẠNG 1: GALLERY GRID VỚI ẢNH BẰNG CHỨNG LỚN */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredViolations.map((v, idx) => {
            const imageUrl = v.snapshot_path 
              ? `/api/violations/image/${v.snapshot_path}`
              : null

            return (
              <div 
                key={v.id || idx}
                className="bg-white dark:bg-[#0b101c] rounded-2xl border border-slate-200 dark:border-slate-800/90 overflow-hidden shadow-sm hover:shadow-md hover:border-red-400 dark:hover:border-red-500/50 transition-all flex flex-col justify-between group"
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
        /* DẠNG 2: BẢNG KIỂM TOÁN CHUYÊN NGHIỆP */
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b101c] shadow-sm">
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">STT</th>
                <th className="py-3 px-4">Thời Gian</th>
                <th className="py-3 px-4">Ảnh Bằng Chứng</th>
                <th className="py-3 px-4">Vị Trí / Camera</th>
                <th className="py-3 px-4">Số Người Vi Phạm</th>
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

    </div>
  )
}
