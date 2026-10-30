import React from 'react'
import { 
  X, 
  Cpu, 
  Database, 
  Layers, 
  Radio, 
  Zap, 
  Network
} from 'lucide-react'

export default function TechSpecsModal({ isOpen, onClose }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-[#0b101c] border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl relative text-slate-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 sticky top-0 bg-[#0b101c]/95 backdrop-blur-md z-10">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Kiến Trúc Kỹ Thuật & Công Nghệ (Tech Specs)
              </h2>
              <p className="text-xs text-slate-400">
                Tài liệu thiết kế kiến trúc dành cho Nhà tuyển dụng & Technical Interviewer
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">

          {/* Module 1: Decoupled Multi-Threading */}
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center space-x-2 text-emerald-400 font-bold mb-1.5">
              <Zap className="w-4 h-4" />
              <span>1. Kiến Trúc Đa Luồng Độc Lập (Decoupled Multi-Threading)</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              Tách biệt hoàn toàn <b>Luồng thu hình (Capture Worker)</b> và <b>Luồng suy luận AI (Inference Worker)</b>. Luồng video duy trì tốc độ <b>30-60 FPS</b> không bao giờ bị nghẽn (Zero Buffer Lag), trong khi AI gửi ảnh kiểm tra theo chu kỳ ~0.35s trên background thread.
            </p>
          </div>

          {/* Module 2: Central Worker & Multi-Client Concurrency */}
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center space-x-2 text-cyan-400 font-bold mb-1.5">
              <Network className="w-4 h-4" />
              <span>2. Tối Ưu Quota API & Đồng Bộ Đa Người Xem (Multi-Client)</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              Hệ thống xử lý AI tại một đầu mối duy nhất trên server. Dù có <b>nhiều người dùng</b> cùng mở xem luồng trực tiếp, tần suất phân tích hình ảnh <b>vẫn cố định</b> (~2.8 req/s), tối ưu băng thông và tài nguyên. Sự kiện cảnh báo được đánh số tuần tự (<code className="text-cyan-300">alert_id</code>) giúp mọi thiết bị cùng nhận được tín hiệu tức thời.
            </p>
          </div>

          {/* Module 3: Dual Camera Ingestion */}
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center space-x-2 text-amber-400 font-bold mb-1.5">
              <Radio className="w-4 h-4" />
              <span>3. Bộ Giải Mã Luồng Kép (RTSP TCP + Native MJPEG Slicing)</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              - <b>RTSP Ngoài Trời:</b> Cấu hình Sub-stream qua giao thức TCP với low-delay buffer.<br />
              - <b>Camera Điện Thoại:</b> Tự xây dựng bộ bóc tách byte marker (<code className="text-amber-300">\xff\xd8</code> tới <code className="text-amber-300">\xff\xd9</code>), loại bỏ 100% lỗi boundary và triệt tiêu độ trễ mạng Wi-Fi.
            </p>
          </div>

          {/* Module 4: Cloud AI Inference */}
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center space-x-2 text-purple-400 font-bold mb-1.5">
              <Cpu className="w-4 h-4" />
              <span>4. Mô Hình Thị Giác Máy Tính Phân Tích Mũ Bảo Hộ</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              Tận dụng cụm máy chủ GPU chuyên dụng. Sử dụng <b>Persistent HTTP Session (Keep-Alive)</b> nén JPEG quality 70, giảm thời gian round-trip từ 550ms xuống chỉ còn ~100ms với thời gian tính toán compute model chỉ <b>8.3ms</b>.
            </p>
          </div>

          {/* Module 5: Database & Users */}
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center space-x-2 text-indigo-400 font-bold mb-1.5">
              <Database className="w-4 h-4" />
              <span>5. Cơ Sở Dữ Liệu Quan Hệ & Phân Quyền Người Dùng</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              Lưu trữ danh bạ Camera, lịch sử các vụ vi phạm (kèm snapshot ảnh bằng chứng), bảng tổng hợp tuân thủ theo ngày (<code className="text-indigo-300">daily_stats</code>), và bảng <code className="text-indigo-300">users</code> phân quyền vai trò: <b>Chỉ Huy Trưởng</b> và <b>Cán Bộ Giám Sát</b>.
            </p>
          </div>

          {/* Module 6: Modern SPA */}
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center space-x-2 text-blue-400 font-bold mb-1.5">
              <Layers className="w-4 h-4" />
              <span>6. Giao Diện Người Dùng Thời Gian Thực (Industrial HUD)</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              Kiến trúc SPA hiện đại theo chuẩn phong cách Industrial Bento Grid. Áp dụng cơ chế khóa âm thanh đa tab (<code className="text-blue-300">localStorage Audio Mutex</code>) để ngăn tiếng vang vọng khi mở nhiều màn hình giám sát.
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-[#0b101c]/95 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors"
          >
            Đã Hiểu
          </button>
        </div>

      </div>
    </div>
  )
}

