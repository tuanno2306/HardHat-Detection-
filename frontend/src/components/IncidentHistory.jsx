import React from 'react'
import { 
  History, 
  Download, 
  CheckCircle2, 
  ExternalLink,
  Clock, 
  Calendar,
  Cloud
} from 'lucide-react'

export default function IncidentHistory({ history = [], onSelectSnapshot, onOpenDailyPage }) {
  const handleExportCSV = () => {
    window.location.href = '/api/export_csv'
  }

  return (
    <div className="glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex-1 flex flex-col justify-between shadow-sm transition-colors duration-200">
      
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
              <History className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Nhật Ký Vi Phạm
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20 font-bold">
              {history.length}
            </span>
          </div>

          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors shadow-sm"
            title="Tải toàn bộ lịch sử vi phạm dạng file Excel/CSV"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Xuất Báo Cáo</span>
          </button>
        </div>

        {/* Incident List */}
        <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
          {history.length === 0 ? (
            <div className="text-center py-8 px-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-800/80">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 dark:text-emerald-400 mx-auto mb-2 opacity-80" />
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-300">
                Chưa ghi nhận vi phạm nào
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Mọi công nhân đều đang chấp hành tốt quy định mũ bảo hộ!
              </p>
            </div>
          ) : (
            history.map((item, idx) => (
              <div 
                key={item.id || idx}
                className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100/90 dark:bg-slate-900/70 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800/80 hover:border-red-400 dark:hover:border-red-500/40 transition-all flex items-start justify-between gap-3 group shadow-xs"
              >
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/25">
                      VI PHẠM
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono flex items-center">
                      <Clock className="w-3 h-3 mr-1 text-slate-400" />
                      {item.timestamp}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {item.details || 'Không đội mũ bảo hộ'}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                    Nguồn: {item.camera_name || 'Camera Giám Sát'}
                  </p>
                </div>

                {/* Evidence Snapshot Thumbnail */}
                {item.snapshot && (
                  <button
                    onClick={() => onSelectSnapshot(`/static/violations/${item.snapshot}`)}
                    className="relative rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700/80 hover:border-emerald-500 transition-all group-hover:shadow-md flex-shrink-0"
                    title="Bấm để xem ảnh bằng chứng kích thước đầy đủ"
                  >
                    <img 
                      src={`/static/violations/${item.snapshot}`} 
                      alt="Evidence" 
                      className="w-14 h-12 object-cover block"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <ExternalLink className="w-3.5 h-3.5 text-white" />
                    </div>
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Button to Daily Violations Page */}
      {onOpenDailyPage && (
        <button
          onClick={onOpenDailyPage}
          className="w-full mt-3 py-2 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-bold transition-all flex items-center justify-center space-x-1.5 shadow-sm"
          title="Xem toàn bộ hồ sơ vi phạm theo từng ngày kèm ảnh bằng chứng"
        >
          <Calendar className="w-3.5 h-3.5 text-amber-500" />
          <span>Tra Cứu Theo Ngày &rarr;</span>
        </button>
      )}

      {/* Footer Info */}
      <div className="mt-2.5 pt-2.5 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
        <span className="flex items-center space-x-1">
          <Cloud className="w-3 h-3 text-emerald-600 dark:text-emerald-400 mr-0.5" />
          <span>Lưu trữ ảnh bằng chứng an toàn</span>
        </span>
        <span className="text-emerald-600 dark:text-emerald-400 font-medium">Đã mã hóa</span>
      </div>

    </div>
  )
}
