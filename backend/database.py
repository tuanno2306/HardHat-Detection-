import os
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
try:
    from . import config
except ImportError:
    import config

def get_db_connection():
    """Tạo kết nối tới PostgreSQL theo cấu hình từ environment / config"""
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        return psycopg2.connect(database_url, cursor_factory=RealDictCursor)

    host = os.getenv("PG_HOST", "127.0.0.1")
    port = int(os.getenv("PG_PORT", "5432"))
    user = os.getenv("PG_USER", "postgres")
    password = os.getenv("PG_PASSWORD", "")
    dbname = os.getenv("PG_DB", "hardhat_detection")

    return psycopg2.connect(
        host=host,
        port=port,
        user=user,
        password=password,
        dbname=dbname,
        cursor_factory=RealDictCursor
    )

def init_db():
    """Khởi tạo cấu trúc bảng cho PostgreSQL với 1 đường nối duy nhất users -> violations"""
    conn = get_db_connection()
    conn.autocommit = True
    cur = conn.cursor()

    try:
        # 1. BẢNG NGƯỜI DÙNG & TÀI KHOẢN (Tạo trước tiên)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                full_name VARCHAR(100) NOT NULL,
                role VARCHAR(20) DEFAULT 'operator',
                avatar_url VARCHAR(255),
                is_active BOOLEAN DEFAULT TRUE,
                last_login TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # 2. BẢNG QUẢN LÝ DANH MỤC CAMERA (Khóa ngoại tới users: Người tạo camera)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS cameras (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                type VARCHAR(30) NOT NULL,
                source_url VARCHAR(255) NOT NULL,
                location VARCHAR(150),
                is_active BOOLEAN DEFAULT TRUE,
                created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # 3. BẢNG NHẬT KÝ VI PHẠM (CHỈ 1 ĐƯỜNG NỐI DUY NHẤT TỚI USERS QUA user_id)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS violations (
                id SERIAL PRIMARY KEY,
                timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                camera_id INTEGER REFERENCES cameras(id) ON DELETE SET NULL,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                camera_name VARCHAR(100),
                camera_source VARCHAR(255),
                violation_count INTEGER DEFAULT 1,
                safe_count INTEGER DEFAULT 0,
                confidence FLOAT DEFAULT 0.0,
                snapshot_path VARCHAR(255),
                details TEXT,
                status VARCHAR(30) DEFAULT 'pending',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # 4. BẢNG THỐNG KÊ THEO NGÀY (AUDIT LOG & KPI)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS daily_stats (
                date DATE PRIMARY KEY,
                total_inspections INTEGER DEFAULT 0,
                total_safe INTEGER DEFAULT 0,
                total_violations INTEGER DEFAULT 0,
                compliance_rate FLOAT DEFAULT 100.0,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # 5. BẢNG LƯU TRỮ CẤU HÌNH HỆ THỐNG
        cur.execute("""
            CREATE TABLE IF NOT EXISTS system_settings (
                key VARCHAR(50) PRIMARY KEY,
                value TEXT,
                description TEXT,
                updated_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # Tạo sẵn tài khoản mẫu (admin / guard) nếu bảng users còn trống
        cur.execute("SELECT COUNT(*) as cnt FROM users;")
        if cur.fetchone()["cnt"] == 0:
            admin_pwd = generate_password_hash("admin123")
            guard_pwd = generate_password_hash("guard123")
            cur.execute("""
                INSERT INTO users (username, email, password_hash, full_name, role, is_active)
                VALUES 
                ('admin', 'admin@cong-truong.vn', %s, 'Chỉ Huy Trưởng (Admin)', 'admin', TRUE),
                ('guard', 'guard@cong-truong.vn', %s, 'Cán Bộ Giám Sát Cổng', 'operator', TRUE);
            """, (admin_pwd, guard_pwd))

        # Tạo sẵn dữ liệu mẫu cho danh mục camera nếu bảng còn trống
        cur.execute("SELECT COUNT(*) as cnt FROM cameras;")
        if cur.fetchone()["cnt"] == 0:
            cur.execute("""
                INSERT INTO cameras (name, type, source_url, location, is_active, created_by_user_id)
                VALUES 
                ('Webcam Laptop (Camera 0)', 'webcam', '0', 'Bàn làm việc / Phỏng vấn', TRUE, 1),
                ('Camera Điện Thoại (IP Webcam)', 'ip_phone', %s, 'Cổng phụ / Cơ động', TRUE, 1),
                ('Camera An Ninh Ngoài Trời (RTSP)', 'rtsp', 'rtsp://wowzaec2demo.streamlock.net/vod/mp4:BigBuckBunny_115k.mp4', 'Cổng chính công trường', TRUE, 1);
            """, (config.DEFAULT_CAMERA_SOURCE,))

        # Tạo sẵn cấu hình mặc định nếu bảng settings còn trống
        cur.execute("SELECT COUNT(*) as cnt FROM system_settings;")
        if cur.fetchone()["cnt"] == 0:
            cur.execute("""
                INSERT INTO system_settings (key, value, description, updated_by_user_id)
                VALUES 
                ('roboflow_project_id', %s, 'Roboflow Project ID', 1),
                ('roboflow_model_version', %s, 'Model Version', 1),
                ('confidence_threshold', %s, 'Ngưỡng Confidence (%%)', 1),
                ('alert_cooldown', %s, 'Thời gian giãn cách còi cảnh báo (giây)', 1);
            """, (
                config.ROBOFLOW_PROJECT_ID,
                str(config.ROBOFLOW_MODEL_VERSION),
                str(config.CONFIDENCE_THRESHOLD),
                str(config.ALERT_COOLDOWN_SECONDS)
            ))

        print("[Database] Đã khởi tạo các bảng PostgreSQL thành công với quan hệ 1 đường nối users -> violations!")
    finally:
        cur.close()
        conn.close()

# --- CÁC HÀM XÁC THỰC & TẠO TÀI KHOẢN (AUTH & USERS) ---

def create_user(username, password, full_name, email=None, role="operator"):
    """Tạo tài khoản người dùng mới vào PostgreSQL (Đăng Ký)"""
    username = username.strip().lower()
    full_name = full_name.strip()
    email = email.strip().lower() if email else f"{username}@cong-truong.vn"
    
    if len(username) < 3:
        return None, "Tên đăng nhập phải có ít nhất 3 ký tự!"
    if len(password) < 4:
        return None, "Mật khẩu phải có ít nhất 4 ký tự!"
    if not full_name:
        return None, "Vui lòng nhập Họ và Tên!"

    conn = get_db_connection()
    conn.autocommit = True
    cur = conn.cursor()
    try:
        # Kiểm tra trùng username
        cur.execute("SELECT id FROM users WHERE username = %s;", (username,))
        if cur.fetchone():
            return None, "Tên đăng nhập này đã được sử dụng! Vui lòng chọn tên khác."
        
        # Kiểm tra trùng email
        if email:
            cur.execute("SELECT id FROM users WHERE email = %s;", (email,))
            if cur.fetchone():
                return None, "Email này đã được sử dụng!"

        pwd_hash = generate_password_hash(password)
        cur.execute("""
            INSERT INTO users (username, email, password_hash, full_name, role, is_active)
            VALUES (%s, %s, %s, %s, %s, TRUE)
            RETURNING id, username, email, full_name, role;
        """, (username, email, pwd_hash, full_name, role))
        new_user = cur.fetchone()
        return new_user, None
    finally:
        cur.close()
        conn.close()

def authenticate_user(username, password):
    """Xác thực đăng nhập người dùng từ PostgreSQL"""
    conn = get_db_connection()
    conn.autocommit = True
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT id, username, email, password_hash, full_name, role, is_active 
            FROM users 
            WHERE username = %s;
        """, (username.strip().lower(),))
        user = cur.fetchone()
        if not user:
            return None
        
        if not user["is_active"]:
            return None

        if check_password_hash(user["password_hash"], password):
            cur.execute("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = %s;", (user["id"],))
            return {
                "id": user["id"],
                "username": user["username"],
                "email": user["email"],
                "full_name": user["full_name"],
                "role": user["role"]
            }
        return None
    finally:
        cur.close()
        conn.close()

def get_user_by_id(user_id):
    """Lấy thông tin người dùng theo ID"""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT id, username, email, full_name, role, is_active, 
                   to_char(last_login, 'YYYY-MM-DD HH24:MI:SS') as last_login
            FROM users 
            WHERE id = %s;
        """, (user_id,))
        return cur.fetchone()
    finally:
        cur.close()
        conn.close()

def get_users_list():
    """Lấy danh sách tất cả tài khoản người dùng"""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT id, username, email, full_name, role, is_active, 
                   to_char(last_login, 'YYYY-MM-DD HH24:MI:SS') as last_login,
                   to_char(created_at, 'YYYY-MM-DD') as created_at
            FROM users 
            ORDER BY id ASC;
        """)
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()

# --- CÁC HÀM TRUY XUẤT VI PHẠM ---

def record_violation(camera_name, camera_source, violation_count, safe_count, confidence, snapshot_path, details, camera_id=None, user_id=None):
    """Ghi nhận sự kiện vi phạm vào PostgreSQL có gán mã Camera và Người Trực"""
    conn = get_db_connection()
    conn.autocommit = True
    cur = conn.cursor()
    try:
        # Nếu chưa truyền camera_id, thử tìm camera_id từ source_url
        if not camera_id and camera_source:
            cur.execute("SELECT id FROM cameras WHERE source_url = %s LIMIT 1;", (str(camera_source),))
            found = cur.fetchone()
            if found:
                camera_id = found["id"]

        cur.execute("""
            INSERT INTO violations (
                camera_id, user_id, camera_name, camera_source, 
                violation_count, safe_count, confidence, snapshot_path, details
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, timestamp, snapshot_path;
        """, (camera_id, user_id, camera_name, camera_source, violation_count, safe_count, confidence, snapshot_path, details))
        res = cur.fetchone()

        # Cập nhật thống kê ngày hôm nay
        today = datetime.now().date()
        cur.execute("""
            INSERT INTO daily_stats (date, total_inspections, total_safe, total_violations, compliance_rate)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (date) DO UPDATE SET
                total_inspections = daily_stats.total_inspections + EXCLUDED.total_inspections,
                total_safe = daily_stats.total_safe + EXCLUDED.total_safe,
                total_violations = daily_stats.total_violations + EXCLUDED.total_violations,
                compliance_rate = CASE 
                    WHEN (daily_stats.total_inspections + EXCLUDED.total_inspections) > 0 
                    THEN ROUND(((daily_stats.total_safe + EXCLUDED.total_safe)::numeric / (daily_stats.total_inspections + EXCLUDED.total_inspections)::numeric) * 100, 1)
                    ELSE 100.0 
                END,
                updated_at = CURRENT_TIMESTAMP;
        """, (today, violation_count + safe_count, safe_count, violation_count, 0.0))

        return res
    finally:
        cur.close()
        conn.close()

def get_violations(limit=50, offset=0):
    """Lấy danh sách các vi phạm mới nhất có JOIN tên người trực và tên camera"""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT v.id, 
                   to_char(v.timestamp, 'YYYY-MM-DD HH24:MI:SS') as timestamp, 
                   v.camera_id,
                   COALESCE(c.name, v.camera_name, 'Camera Giám Sát') as camera_name,
                   v.camera_source, 
                   v.violation_count, 
                   v.safe_count, 
                   ROUND((v.confidence * 100)::numeric, 1) as confidence_pct, 
                   v.snapshot_path, 
                   v.details, 
                   v.status,
                   u.full_name as detected_by_name,
                   u.role as detected_by_role
            FROM violations v
            LEFT JOIN cameras c ON v.camera_id = c.id
            LEFT JOIN users u ON v.user_id = u.id
            ORDER BY v.id DESC 
            LIMIT %s OFFSET %s;
        """, (limit, offset))
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()

def get_today_stats():
    """Lấy số liệu thống kê an toàn của ngày hôm nay"""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        today = datetime.now().date()
        cur.execute("SELECT * FROM daily_stats WHERE date = %s;", (today,))
        stats = cur.fetchone()
        if not stats:
            return {
                "date": str(today),
                "total_inspections": 0,
                "total_safe": 0,
                "total_violations": 0,
                "compliance_rate": 100.0
            }
        return {
            "date": str(stats["date"]),
            "total_inspections": stats["total_inspections"],
            "total_safe": stats["total_safe"],
            "total_violations": stats["total_violations"],
            "compliance_rate": float(stats["compliance_rate"])
        }
    finally:
        cur.close()
        conn.close()

# --- CÁC HÀM QUẢN LÝ CAMERA ---

def get_cameras():
    """Lấy danh mục các camera đang hoạt động có JOIN người tạo"""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT c.id, c.name, c.type, c.source_url, c.location, c.is_active,
                   u.full_name as created_by_name
            FROM cameras c
            LEFT JOIN users u ON c.created_by_user_id = u.id
            ORDER BY c.id ASC;
        """)
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()

def add_camera(name, cam_type, source_url, location="", user_id=None):
    """Thêm một camera mới vào hệ thống gán với người dùng tạo"""
    conn = get_db_connection()
    conn.autocommit = True
    cur = conn.cursor()
    try:
        cur.execute("""
            INSERT INTO cameras (name, type, source_url, location, is_active, created_by_user_id)
            VALUES (%s, %s, %s, %s, TRUE, %s)
            RETURNING id, name, type, source_url, location;
        """, (name, cam_type, source_url, location, user_id))
        return cur.fetchone()
    finally:
        cur.close()
        conn.close()

def delete_camera(camera_id):
    """Xóa một camera khỏi danh mục"""
    conn = get_db_connection()
    conn.autocommit = True
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM cameras WHERE id = %s RETURNING id;", (camera_id,))
        return cur.fetchone()
    finally:
        cur.close()
        conn.close()

# --- XUẤT BÁO CÁO CSV ---

def export_violations_csv():
    """Tạo chuỗi dữ liệu CSV đầy đủ cho báo cáo kiểm toán an toàn có tên người trực"""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT v.id, 
                   to_char(v.timestamp, 'YYYY-MM-DD HH24:MI:SS') as time_str, 
                   COALESCE(c.name, v.camera_name, 'Camera Giám Sát') as camera_name, 
                   v.camera_source, 
                   COALESCE(u.full_name, 'Hệ Thống Tự Động') as detected_by,
                   v.violation_count, 
                   v.safe_count, 
                   v.details, 
                   v.status, 
                   v.snapshot_path 
            FROM violations v
            LEFT JOIN cameras c ON v.camera_id = c.id
            LEFT JOIN users u ON v.user_id = u.id
            ORDER BY v.id DESC;
        """)
        rows = cur.fetchall()
        
        # Tạo chuỗi CSV có BOM UTF-8 để mở tiếng Việt trên Microsoft Excel không bị lỗi font
        csv_lines = ["\ufeffSTT,Thời Gian,Tên Camera,Nguồn Camera,Cán Bộ Trực Ca,Số Người Vi Phạm,Số Người Hợp Lệ,Mô Tả Chi Tiết,Trạng Thái,Tên File Ảnh"]
        for r in rows:
            line = f'{r["id"]},"{r["time_str"]}","{r["camera_name"]}","{r["camera_source"]}","{r["detected_by"]}",{r["violation_count"]},{r["safe_count"]},"{r["details"]}","{r["status"]}","{r["snapshot_path"] or ""}"'
            csv_lines.append(line)
        return "\n".join(csv_lines)
    finally:
        cur.close()
        conn.close()

# --- CÁC HÀM TRUY XUẤT VI PHẠM THEO TỪNG NGÀY (DAILY AUDIT) ---

def get_violations_by_date(target_date, limit=100, offset=0, camera_id=None):
    """Lấy danh sách các vi phạm của một ngày cụ thể (YYYY-MM-DD) kèm thông tin công nhân đã định danh"""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        query = """
            SELECT v.id, 
                   to_char(v.timestamp, 'YYYY-MM-DD HH24:MI:SS') as timestamp, 
                   to_char(v.timestamp, 'HH24:MI:SS') as time_only,
                   v.camera_id,
                   COALESCE(c.name, v.camera_name, 'Camera Giám Sát') as camera_name,
                   v.camera_source, 
                   v.violation_count, 
                   v.safe_count, 
                   ROUND((v.confidence * 100)::numeric, 1) as confidence_pct, 
                   v.snapshot_path, 
                   v.details, 
                   v.status,
                   COALESCE(u.full_name, 'Hệ Thống Tự Động') as detected_by_name,
                   COALESCE(u.role, 'system') as detected_by_role,
                   v.matched_worker_id,
                   v.matched_worker_name,
                   ROUND((COALESCE(v.match_similarity, 0) * 100)::numeric, 1) as match_similarity_pct,
                   w.employee_code as matched_worker_code,
                   w.department as matched_worker_dept,
                   w.avatar_path as matched_worker_avatar
            FROM violations v
            LEFT JOIN cameras c ON v.camera_id = c.id
            LEFT JOIN users u ON v.user_id = u.id
            LEFT JOIN workers w ON v.matched_worker_id = w.id
            WHERE DATE(v.timestamp) = %s
        """
        params = [target_date]
        if camera_id:
            query += " AND v.camera_id = %s"
            params.append(camera_id)
        
        query += " ORDER BY v.id DESC LIMIT %s OFFSET %s;"
        params.extend([limit, offset])

        cur.execute(query, tuple(params))
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()

def get_violation_dates_summary():
    """Lấy danh sách các ngày có dữ liệu vi phạm kèm số lượng tổng hợp"""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT 
                to_char(DATE(v.timestamp), 'YYYY-MM-DD') as date_str,
                COUNT(v.id) as total_incidents,
                COALESCE(SUM(v.violation_count), 0) as total_violators,
                COALESCE(SUM(v.safe_count), 0) as total_safes,
                CASE 
                    WHEN (SUM(v.violation_count) + SUM(v.safe_count)) > 0 
                    THEN ROUND((SUM(v.safe_count)::numeric / (SUM(v.violation_count) + SUM(v.safe_count))::numeric) * 100, 1)
                    ELSE 100.0 
                END as compliance_rate
            FROM violations v
            GROUP BY DATE(v.timestamp)
            ORDER BY DATE(v.timestamp) DESC;
        """)
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()

def get_date_kpi(target_date):
    """Lấy số liệu thống kê tổng quan của một ngày cụ thể"""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT 
                COUNT(id) as total_incidents,
                COALESCE(SUM(violation_count), 0) as total_violators,
                COALESCE(SUM(safe_count), 0) as total_safes
            FROM violations 
            WHERE DATE(timestamp) = %s;
        """, (target_date,))
        row = cur.fetchone()
        
        # Thử lấy từ bảng daily_stats nếu có
        cur.execute("SELECT * FROM daily_stats WHERE date = %s;", (target_date,))
        daily = cur.fetchone()

        total_violations = row["total_violators"] if row else 0
        total_safe = (daily["total_safe"] if daily else 0) or (row["total_safes"] if row else 0)
        total_inspections = total_violations + total_safe
        compliance_rate = round((total_safe / total_inspections * 100), 1) if total_inspections > 0 else 100.0

        return {
            "date": target_date,
            "total_incidents": row["total_incidents"] if row else 0,
            "total_inspections": total_inspections,
            "total_safe": total_safe,
            "total_violations": total_violations,
            "compliance_rate": compliance_rate
        }
    finally:
        cur.close()
        conn.close()

def export_violations_by_date_csv(target_date):
    """Xuất báo cáo CSV vi phạm của riêng một ngày chọn trước"""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT v.id, 
                   to_char(v.timestamp, 'YYYY-MM-DD HH24:MI:SS') as time_str, 
                   COALESCE(c.name, v.camera_name, 'Camera Giám Sát') as camera_name, 
                   v.camera_source, 
                   COALESCE(u.full_name, 'Hệ Thống Tự Động') as detected_by,
                   v.violation_count, 
                   v.safe_count, 
                   v.details, 
                   v.status, 
                   v.snapshot_path 
            FROM violations v
            LEFT JOIN cameras c ON v.camera_id = c.id
            LEFT JOIN users u ON v.user_id = u.id
            WHERE DATE(v.timestamp) = %s
            ORDER BY v.id DESC;
        """, (target_date,))
        rows = cur.fetchall()
        
        csv_lines = [f"\ufeffBÁO CÁO VI PHẠM AN TOÀN NGÀY {target_date}"]
        csv_lines.append("STT,Thời Gian,Tên Camera,Nguồn Camera,Cán Bộ Trực Ca,Số Người Vi Phạm,Số Người Hợp Lệ,Mô Tả Chi Tiết,Trạng Thái,Tên File Ảnh")
        for r in rows:
            line = f'{r["id"]},"{r["time_str"]}","{r["camera_name"]}","{r["camera_source"]}","{r["detected_by"]}",{r["violation_count"]},{r["safe_count"]},"{r["details"]}","{r["status"]}","{r["snapshot_path"] or ""}"'
            csv_lines.append(line)
        return "\n".join(csv_lines)
    finally:
        cur.close()
        conn.close()

# ==============================================================================
# QUẢN LÝ CÔNG NHÂN & ĐỐI SOÁT VI PHẠM (DEEPFACE + QDRANT)
# ==============================================================================

def create_worker(employee_code, full_name, department, phone=None, avatar_path=None, qdrant_point_id=None):
    """Tạo mới hồ sơ công nhân trong PostgreSQL"""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            INSERT INTO workers (employee_code, full_name, department, phone, avatar_path, qdrant_point_id, is_active)
            VALUES (%s, %s, %s, %s, %s, %s, TRUE)
            RETURNING id, employee_code, full_name, department, phone, avatar_path, created_at;
        """, (employee_code, full_name, department, phone, avatar_path, qdrant_point_id))
        worker = cur.fetchone()
        conn.commit()
        return worker
    finally:
        cur.close()
        conn.close()

def get_workers(active_only=True):
    """Lấy danh sách toàn bộ công nhân trong hệ thống"""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        sql = """
            SELECT id, employee_code, full_name, department, phone, avatar_path, qdrant_point_id, is_active,
                   to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at_str
            FROM workers
        """
        if active_only:
            sql += " WHERE is_active = TRUE"
        sql += " ORDER BY id DESC;"
        cur.execute(sql)
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()

def get_worker_by_id(worker_id):
    """Lấy chi tiết công nhân theo ID"""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT id, employee_code, full_name, department, phone, avatar_path, qdrant_point_id, is_active,
                   to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at_str
            FROM workers WHERE id = %s;
        """, (worker_id,))
        return cur.fetchone()
    finally:
        cur.close()
        conn.close()

def get_worker_by_code(employee_code):
    """Kiểm tra mã công nhân đã tồn tại hay chưa"""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT id, employee_code, full_name FROM workers WHERE employee_code = %s;", (employee_code,))
        return cur.fetchone()
    finally:
        cur.close()
        conn.close()

def delete_worker(worker_id):
    """Xóa công nhân khỏi hệ thống (hoặc vô hiệu hóa)"""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM workers WHERE id = %s RETURNING id, full_name;", (worker_id,))
        deleted = cur.fetchone()
        conn.commit()
        return deleted
    finally:
        cur.close()
        conn.close()

def update_violation_matched_worker(violation_id, worker_id, worker_name, similarity):
    """Cập nhật thông tin công nhân được nhận diện cho một vụ vi phạm"""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            UPDATE violations
            SET matched_worker_id = %s,
                matched_worker_name = %s,
                match_similarity = %s
            WHERE id = %s;
        """, (worker_id, worker_name, similarity, violation_id))
        conn.commit()
        return True
    finally:
        cur.close()
        conn.close()

def get_daily_worker_violation_summary(target_date):
    """
    Tổng hợp danh sách các công nhân đã vi phạm trong ngày:
    Xếp hạng theo số lần vi phạm từ nhiều nhất đến ít nhất, kèm danh sách ảnh và khung giờ.
    """
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        # 1. Thống kê theo công nhân đã định danh
        cur.execute("""
            SELECT 
                w.id as worker_id,
                w.employee_code,
                w.full_name,
                w.department,
                w.avatar_path,
                COUNT(v.id) as violation_count,
                MAX(v.match_similarity) as highest_similarity,
                to_char(MAX(v.timestamp), 'HH24:MI:SS') as latest_time,
                array_agg(v.id ORDER BY v.timestamp DESC) as violation_ids,
                array_agg(to_char(v.timestamp, 'HH24:MI:SS') ORDER BY v.timestamp DESC) as time_list,
                array_agg(v.snapshot_path ORDER BY v.timestamp DESC) as snapshot_list
            FROM violations v
            INNER JOIN workers w ON v.matched_worker_id = w.id
            WHERE DATE(v.timestamp) = %s
            GROUP BY w.id, w.employee_code, w.full_name, w.department, w.avatar_path
            ORDER BY violation_count DESC, highest_similarity DESC;
        """, (target_date,))
        identified_workers = cur.fetchall()

        # 2. Thống kê các vụ vi phạm chưa định danh được (Khách / Người ngoài)
        cur.execute("""
            SELECT 
                COUNT(v.id) as unknown_count,
                array_agg(v.id ORDER BY v.timestamp DESC) as unknown_ids,
                array_agg(to_char(v.timestamp, 'HH24:MI:SS') ORDER BY v.timestamp DESC) as unknown_times,
                array_agg(v.snapshot_path ORDER BY v.timestamp DESC) as unknown_snapshots
            FROM violations v
            WHERE DATE(v.timestamp) = %s AND (v.matched_worker_id IS NULL OR v.matched_worker_id = 0);
        """, (target_date,))
        unknown_summary = cur.fetchone()

        # 3. Tổng số vi phạm trong ngày
        cur.execute("""
            SELECT COUNT(id) as total FROM violations WHERE DATE(timestamp) = %s;
        """, (target_date,))
        total_violations = cur.fetchone()["total"]

        return {
            "date": target_date,
            "total_violations": total_violations,
            "identified_count": sum(r["violation_count"] for r in identified_workers),
            "unknown_count": unknown_summary["unknown_count"] if unknown_summary else 0,
            "workers": identified_workers,
            "unknown_details": unknown_summary
        }
    finally:
        cur.close()
        conn.close()

def export_worker_violation_summary_csv(target_date):
    """Xuất file CSV báo cáo kỷ luật danh sách công nhân vi phạm theo ngày"""
    summary = get_daily_worker_violation_summary(target_date)
    
    csv_lines = [f"\ufeffBÁO CÁO KỶ LUẬT VI PHẠM AN TOÀN THEO CÔNG NHÂN - NGÀY {target_date}"]
    csv_lines.append(f"Tổng số vụ vi phạm: {summary['total_violations']}, Đã xác định: {summary['identified_count']}, Chưa xác định: {summary['unknown_count']}")
    csv_lines.append("")
    csv_lines.append("Hạng,Mã Công Nhân,Họ Và Tên,Tổ Đội / Phân Xưởng,Số Lần Vi Phạm,Lần Vi Phạm Gần Nhất,Độ Khớp AI (%),Các Khung Giờ Vi Phạm")
    
    rank = 1
    for w in summary["workers"]:
        sim_pct = round((w["highest_similarity"] or 0) * 100, 1)
        times_str = " | ".join(w["time_list"] or [])
        line = f'{rank},"{w["employee_code"]}","{w["full_name"]}","{w["department"] or ""}",{w["violation_count"]},"{w["latest_time"]}",{sim_pct}%,"{times_str}"'
        csv_lines.append(line)
        rank += 1
        
    if summary["unknown_count"] > 0:
        times_str = " | ".join(summary["unknown_details"]["unknown_times"] or [])
        csv_lines.append(f'-,"CHUA_DINH_DANH","Khách / Người Chưa Đăng Ký","-",{summary["unknown_count"]},"-","-","{times_str}"')
        
    return "\n".join(csv_lines)


