import React from 'react'
import { X, Download, ZoomIn } from 'lucide-react'

export default function LightboxModal({ imageUrl, onClose }) {
  if (!imageUrl) return null

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="relative max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-950/80 border-b border-slate-800 text-xs text-slate-300">
          <span className="font-semibold text-white flex items-center space-x-1.5">
            <ZoomIn className="w-4 h-4 text-emerald-400" />
            <span>Ảnh Bằng Chứng Vi Phạm (High-Resolution)</span>
          </span>
          <div className="flex items-center space-x-2">
            <a 
              href={imageUrl} 
              download 
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Tải ảnh về máy"
            >
              <Download className="w-4 h-4" />
            </a>
            <button 
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Image */}
        <div className="p-2 flex items-center justify-center bg-black/50">
          <img 
            src={imageUrl} 
            alt="Evidence Full" 
            className="max-h-[80vh] w-auto object-contain rounded-lg shadow-lg"
          />
        </div>

      </div>
    </div>
  )
}

