-- ====================================================================
-- HỆ THỐNG GIÁM SÁT MŨ BẢO HỘ CÔNG TRƯỜNG (HARDHAT SAFETY DETECTION)
-- SCRIPT KHỞI TẠO CƠ SỞ DỮ LIỆU POSTGRESQL CHUẨN ERD (1 ĐƯỜNG NỐI DUY NHẤT)
-- ====================================================================

-- Xóa các bảng cũ để làm mới quan hệ
DROP TABLE IF EXISTS violations CASCADE;
DROP TABLE IF EXISTS daily_stats CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;
DROP TABLE IF EXISTS cameras CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. BẢNG NGƯỜI DÙNG & TÀI KHOẢN (ĐĂNG NHẬP / ĐĂNG XUẤT / ĐĂNG KÝ)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) DEFAULT 'operator', -- 'admin', 'operator', 'supervisor'
    avatar_url VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. BẢNG QUẢN LÝ DANH MỤC CAMERA (Quan hệ 1-N với users: Người quản lý camera)
CREATE TABLE cameras (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(30) NOT NULL,            -- 'rtsp', 'ip_phone', 'webcam'
    source_url VARCHAR(255) NOT NULL,
    location VARCHAR(150),
    is_active BOOLEAN DEFAULT TRUE,
    created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- KHÓA NGOẠI tới USERS
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. BẢNG HỒ SƠ CÔNG NHÂN (HỖ TRỢ NHẬN DIỆN KHUÔN MẶT DEEPFACE + QDRANT)
CREATE TABLE IF NOT EXISTS workers (
    id SERIAL PRIMARY KEY,
    employee_code VARCHAR(50) UNIQUE NOT NULL, -- Mã công nhân: CN01, NV02
    full_name VARCHAR(100) NOT NULL,           -- Họ và tên
    department VARCHAR(100),                   -- Đội thi công / Phân xưởng
    phone VARCHAR(20),
    avatar_path VARCHAR(255),                  -- Đường dẫn ảnh đại diện
    qdrant_point_id VARCHAR(64),               -- ID vector trên Qdrant
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. BẢNG NHẬT KÝ VI PHẠM (CHỈ 1 ĐƯỜNG NỐI TỚI USERS QUA user_id)
CREATE TABLE violations (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    camera_id INTEGER REFERENCES cameras(id) ON DELETE SET NULL, -- KHÓA NGOẠI tới CAMERAS (1 đường)
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,     -- KHÓA NGOẠI DUY NHẤT tới USERS (1 đường)
    camera_name VARCHAR(100),
    camera_source VARCHAR(255),
    violation_count INTEGER DEFAULT 1,
    safe_count INTEGER DEFAULT 0,
    confidence FLOAT DEFAULT 0.0,
    snapshot_path VARCHAR(255),
    details TEXT,
    status VARCHAR(50) DEFAULT 'unresolved', -- 'unresolved', 'resolved', 'dismissed'
    matched_worker_id INTEGER REFERENCES workers(id) ON DELETE SET NULL,
    matched_worker_name VARCHAR(100),
    match_similarity FLOAT DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. BẢNG THỐNG KÊ AN TOÀN THEO NGÀY (DAILY SAFETY AUDIT)
CREATE TABLE daily_stats (
    date DATE PRIMARY KEY,
    total_inspections INTEGER DEFAULT 0,
    total_safe INTEGER DEFAULT 0,
    total_violations INTEGER DEFAULT 0,
    compliance_rate FLOAT DEFAULT 100.0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. BẢNG CẤU HÌNH HỆ THỐNG (Khóa ngoại tới users: Người cấu hình)
CREATE TABLE system_settings (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT,
    description TEXT,
    updated_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- KHÓA NGOẠI tới USERS
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ====================================================================
-- DỮ LIỆU KHỞI TẠO MẪU (SEED DATA)
-- ====================================================================

-- 1. Tạo sẵn tài khoản mẫu
INSERT INTO users (username, email, password_hash, full_name, role, is_active)
VALUES 
    ('admin', 'admin@cong-truong.vn', 'scrypt:32768:8:1$m7vcWmRZMkhuKFnf$c3e19c30b9880a042cb2a7c9ac6c16a039815e858c70e4542dfae4f7a0e81f373cc2d8ea5580d2ae75dad45b7d71cd0c5fccea17b09707de04781b839e98b2a9', 'Chỉ Huy Trưởng (Admin)', 'admin', TRUE),
    ('guard', 'guard@cong-truong.vn', 'scrypt:32768:8:1$VQPTnykkM1epdzvc$43400c065982561c35d61082ea48a4f28fc9ad81493eefc25fcd4a3c1bbbad088037da48a33082849c195b89ac0dfecde30a573e4db85a1bc1453cb0900c39ad', 'Cán Bộ Giám Sát Cổng', 'operator', TRUE);

-- 2. Danh mục Camera ban đầu
INSERT INTO cameras (name, type, source_url, location, is_active, created_by_user_id)
VALUES 
    ('Webcam Laptop (Camera 0)', 'webcam', '0', 'Bàn làm việc / Phỏng vấn', TRUE, 1),
    ('Camera Điện Thoại (IP Webcam)', 'ip_phone', 'http://192.168.1.233:8080/video', 'Cổng phụ / Cơ động', TRUE, 1),
    ('Camera An Ninh Ngoài Trời (RTSP)', 'rtsp', 'rtsp://wowzaec2demo.streamlock.net/vod/mp4:BigBuckBunny_115k.mp4', 'Cổng chính công trường', TRUE, 1);

-- 3. Cấu hình mặc định
INSERT INTO system_settings (key, value, description, updated_by_user_id)
VALUES 
    ('roboflow_project_id', 'hardhat3-dptal', 'Roboflow Project ID', 1),
    ('roboflow_model_version', '1', 'Model Version', 1),
    ('confidence_threshold', '40', 'Ngưỡng Confidence (%)', 1),
    ('alert_cooldown', '15', 'Thời gian giãn cách còi cảnh báo (giây)', 1);

-- 4. Vi phạm mẫu ban đầu liên kết Camera #2 và Cán bộ trực #2 (guard)
INSERT INTO violations (camera_id, user_id, camera_name, camera_source, violation_count, safe_count, confidence, details, status)
VALUES 
    (2, 2, 'Camera Điện Thoại (IP Webcam)', 'http://192.168.1.233:8080/video', 1, 0, 0.88, 'Phát hiện 1 người không đội mũ bảo hộ khi vào cổng', 'unresolved');
