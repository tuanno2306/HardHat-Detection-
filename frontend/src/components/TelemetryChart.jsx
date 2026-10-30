import React, { useEffect, useRef } from 'react'
import { Activity } from 'lucide-react'

export default function TelemetryChart({ latencyHistory = [], currentLatency = 0 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const width = canvas.width
    const height = canvas.height

    // Clear
    ctx.clearRect(0, 0, width, height)

    const data = latencyHistory.length > 0 ? latencyHistory : [100, 105, 98, 110, 115, 108, 102]
    const maxVal = Math.max(300, ...data)
    const minVal = 0

    // Draw subtle grid lines
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.25)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, height * 0.33)
    ctx.lineTo(width, height * 0.33)
    ctx.moveTo(0, height * 0.66)
    ctx.lineTo(width, height * 0.66)
    ctx.stroke()

    // Draw area fill
    ctx.beginPath()
    const step = width / (data.length - 1 || 1)
    
    data.forEach((val, i) => {
      const x = i * step
      const y = height - ((val - minVal) / (maxVal - minVal)) * (height - 15) - 5
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })

    // Gradient fill
    const grad = ctx.createLinearGradient(0, 0, 0, height)
    grad.addColorStop(0, 'rgba(6, 182, 212, 0.35)')
    grad.addColorStop(1, 'rgba(6, 182, 212, 0.0)')

    ctx.lineTo(width, height)
    ctx.lineTo(0, height)
    ctx.closePath()
    ctx.fillStyle = grad
    ctx.fill()

    // Draw telemetry line
    ctx.beginPath()
    data.forEach((val, i) => {
      const x = i * step
      const y = height - ((val - minVal) / (maxVal - minVal)) * (height - 15) - 5
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.strokeStyle = '#06b6d4'
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    ctx.stroke()

    // Draw glowing pulsing head point
    const lastX = (data.length - 1) * step
    const lastY = height - ((data[data.length - 1] - minVal) / (maxVal - minVal)) * (height - 15) - 5
    
    ctx.beginPath()
    ctx.arc(lastX, lastY, 4, 0, Math.PI * 2)
    ctx.fillStyle = '#22d3ee'
    ctx.shadowColor = '#06b6d4'
    ctx.shadowBlur = 8
    ctx.fill()
    ctx.shadowBlur = 0

  }, [latencyHistory])

  return (
    <div className="glass-panel p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 mb-4 shadow-sm transition-colors duration-200">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-1.5">
          <Activity className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
          <span className="text-xs font-bold text-slate-800 dark:text-slate-300">
            Real-time AI Telemetry
          </span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-cyan-500 animate-ping"></span>
          <span className="text-xs font-mono text-cyan-700 dark:text-cyan-300 font-bold">
            {currentLatency} ms
          </span>
        </div>
      </div>

      <div className="w-full h-20 bg-slate-50 dark:bg-slate-950/60 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800/80 p-1">
        <canvas 
          ref={canvasRef} 
          width={320} 
          height={75}
          className="w-full h-full block"
        />
      </div>
      
      <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1.5 font-mono">
        <span>30 giây trước</span>
        <span>Hệ Thống Phân Tích AI</span>
        <span>Hiện tại</span>
      </div>
    </div>
  )
}

