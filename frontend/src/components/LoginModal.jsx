import React, { useState } from 'react'
import { 
  Lock, 
  User, 
  LogIn, 
  UserPlus, 
  Mail, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2,
  Sparkles
} from 'lucide-react'

export default function LoginModal({ isOpen, onLoginSuccess }) {
  const [mode, setMode] = useState('login') // 'login' | 'register'
  
  // Login State
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  
  // Register State
  const [regUsername, setRegUsername] = useState('')
  const [regFullName, setRegFullName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regRole, setRegRole] = useState('operator')

  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  if (!isOpen) return null

  // Xử lý Đăng Nhập
  const handleLoginSubmit = async (e) => {
    if (e) e.preventDefault()
    if (!loginUsername || !loginPassword) {
      setErrorMsg("Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu")
      return
    }

    setIsLoading(true)
    setErrorMsg(null)
    setSuccessMsg(null)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      })
      const data = await res.json()
      if (data.success && data.user) {
        onLoginSuccess(data.user)
      } else {
        setErrorMsg(data.message || "Tài khoản hoặc mật khẩu không đúng")
      }
    } catch (e) {
      setErrorMsg("Lỗi kết nối máy chủ: " + e.message)
    } finally {
      setIsLoading(false)
    }
  }

  // Xử lý Tạo Tài Khoản Mới (Đăng Ký)
  const handleRegisterSubmit = async (e) => {
    e.preventDefault()
    if (!regUsername || !regFullName || !regPassword) {
      setErrorMsg("Vui lòng điền đầy đủ Tên đăng nhập, Họ tên và Mật khẩu")
      return
    }

    setIsLoading(true)
    setErrorMsg(null)
    setSuccessMsg(null)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: regUsername,
          full_name: regFullName,
          email: regEmail,
          password: regPassword,
          role: regRole
        })
      })
      const data = await res.json()
      if (data.success && data.user) {
        setSuccessMsg(`Tạo tài khoản thành công! Đang chuyển vào hệ thống...`)
        setTimeout(() => {
          onLoginSuccess(data.user)
        }, 1200)
      } else {
        setErrorMsg(data.message || "Không thể tạo tài khoản")
      }
    } catch (e) {
      setErrorMsg("Lỗi kết nối máy chủ: " + e.message)
    } finally {
      setIsLoading(false)
    }
  }

  // Tiện ích 1-Click Điền mẫu cho Nhà tuyển dụng
  const quickFill = (u, p) => {
    setMode('login')
    setLoginUsername(u)
    setLoginPassword(p)
    setErrorMsg(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
      <div className="bg-[#0b101c] border border-slate-700/80 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden text-slate-200">
        
        {/* Header */}
        <div className="p-5 text-center border-b border-slate-800/80 bg-gradient-to-b from-slate-900 to-[#0b101c]">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-xl shadow-amber-500/20 text-slate-950 font-black text-2xl mx-auto mb-2">
            🪖
          </div>
          <h2 className="text-base font-extrabold text-white tracking-tight">
            HARDHAT VISION PORTAL
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Cổng Giám Sát An Toàn Mũ Bảo Hộ Công Trường
          </p>

          {/* Mode Switcher Tabs (Đăng Nhập vs Tạo Tài Khoản) */}
          <div className="flex bg-slate-950/80 p-1 rounded-xl mt-4 border border-slate-800">
            <button
              type="button"
              onClick={() => { setMode('login'); setErrorMsg(null); setSuccessMsg(null); }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
                mode === 'login'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Đăng Nhập</span>
            </button>

            <button
              type="button"
              onClick={() => { setMode('register'); setErrorMsg(null); setSuccessMsg(null); }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
                mode === 'register'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Tạo Tài Khoản</span>
            </button>
          </div>
        </div>

        {/* Thông báo lỗi / thành công */}
        <div className="px-6 pt-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        {/* TAB 1: FORM ĐĂNG NHẬP */}
        {mode === 'login' ? (
          <form onSubmit={handleLoginSubmit} className="p-6 pt-3 space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Tên Đăng Nhập
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Nhập username (ví dụ: admin hoặc guard)"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Mật Khẩu
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  placeholder="Nhập mật khẩu"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center space-x-2"
            >
              <LogIn className="w-4 h-4" />
              <span>{isLoading ? 'Đang xác thực...' : 'Đăng Nhập'}</span>
            </button>

            {/* Quick Demo Credentials Box (Cho Nhà tuyển dụng) */}
            <div className="pt-3 border-t border-slate-800/80">
              <p className="text-[11px] text-slate-400 text-center mb-2 font-medium">
                ⚡ Tài Khoản Mẫu Cho Nhà Tuyển Dụng Thử Nghiệm:
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => quickFill('admin', 'admin123')}
                  className="p-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-left transition-colors"
                >
                  <div className="text-[11px] font-bold text-purple-300">👑 Admin</div>
                  <div className="text-[10px] text-slate-400 font-mono">admin / admin123</div>
                </button>

                <button
                  type="button"
                  onClick={() => quickFill('guard', 'guard123')}
                  className="p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-left transition-colors"
                >
                  <div className="text-[11px] font-bold text-emerald-300">🛡️ Cán Bộ Cổng</div>
                  <div className="text-[10px] text-slate-400 font-mono">guard / guard123</div>
                </button>
              </div>
            </div>
          </form>
        ) : (
          /* TAB 2: FORM TẠO TÀI KHOẢN MỚI (ĐĂNG KÝ) */
          <form onSubmit={handleRegisterSubmit} className="p-6 pt-3 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Tên Đăng Nhập <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Ví dụ: tuan_safety, engineer01"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Họ và Tên Hiển Thị <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                placeholder="Ví dụ: Nguyễn Văn Tuấn (Kỹ Sư An Toàn)"
                value={regFullName}
                onChange={(e) => setRegFullName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Mật Khẩu <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    placeholder="Tối thiểu 4 ký tự"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Vai Trò (Role)
                </label>
                <select
                  value={regRole}
                  onChange={(e) => setRegRole(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/50"
                >
                  <option value="operator">🛡️ Cán Bộ Cổng (Operator)</option>
                  <option value="admin">👑 Quản Trị Viên (Admin)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Email Liên Hệ (Tùy chọn)
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  placeholder="email@cong-truong.vn"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center space-x-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>{isLoading ? 'Đang khởi tạo tài khoản...' : 'Hoàn Tất Tạo Tài Khoản'}</span>
            </button>
          </form>
        )}

      </div>
    </div>
  )
}
