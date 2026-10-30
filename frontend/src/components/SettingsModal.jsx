import React, { useState } from 'react'
import { X, Sliders, Save } from 'lucide-react'

export default function SettingsModal({ isOpen, onClose, status, onSaveSettings }) {
  const [apiKey, setApiKey] = useState('')
  const [projectId, setProjectId] = useState(status.roboflow_project_id || 'hardhat3-dptal')
  const [version, setVersion] = useState(status.roboflow_version || '1')
  const [confidence, setConfidence] = useState(status.confidence_threshold || 40)
  const [cooldown, setCooldown] = useState(status.cooldown_seconds || 15)
  const [isSaving, setIsSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSaving(true)
    const success = await onSaveSettings({
      api_key: apiKey,
      project_id: projectId,
      version: version,
      confidence: confidence,
      cooldown: cooldown
    })
    setIsSaving(false)
    if (success) {
      setMsg("Đã lưu cấu hình thành công!")
      setTimeout(() => {
        setMsg(null)
        onClose()
      }, 1500)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-[#0b101c] border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl relative text-slate-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Sliders className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-white">
              Cấu Hình Hệ Thống & Mô Hình AI (Admin)
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          
          {msg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-semibold text-center">
              {msg}
            </div>
          )}

          {/* API Key */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Khóa API Mô Hình AI (API Key)
            </label>
            <input
              type="password"
              placeholder="Để trống nếu không muốn thay đổi key hiện tại"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Khóa xác thực dịch vụ phân tích thị giác máy tính trên máy chủ AI.
            </p>
          </div>

          {/* Project ID & Version */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Mã Mô Hình (Model ID)
              </label>
              <input
                type="text"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Phiên Bản Mô Hình
              </label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Confidence Slider */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-slate-300">
                Ngưỡng Tin Cậy (Confidence Threshold)
              </label>
              <span className="text-amber-400 font-bold font-mono text-sm">
                {confidence}%
              </span>
            </div>
            <input
              type="range"
              min="10"
              max="90"
              step="5"
              value={confidence}
              onChange={(e) => setConfidence(e.target.value)}
              className="w-full accent-amber-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Nếu nhận diện nhầm mũ lưỡi trai thành nón bảo hộ, hãy tăng ngưỡng lên 85-90%.
            </p>
          </div>

          {/* Cooldown Slider */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-slate-300">
                Khoảng Thời Gian Giãn Cách Còi (Cooldown)
              </label>
              <span className="text-cyan-400 font-bold font-mono text-sm">
                {cooldown} giây
              </span>
            </div>
            <input
              type="range"
              min="3"
              max="30"
              step="1"
              value={cooldown}
              onChange={(e) => setCooldown(e.target.value)}
              className="w-full accent-cyan-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Thời gian nghỉ giữa 2 lần phát cảnh báo âm thanh để tránh bị lặp lại dồn dập.
            </p>
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-slate-800 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs shadow-lg shadow-cyan-600/20 transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Đang lưu...' : 'Lưu Cấu Hình'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  )
}

