import os
import time
import base64
from datetime import datetime
from typing import Optional, Union, Dict, Any, List
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, Response, HTTPException, status, UploadFile, File, Form
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware
from pydantic import BaseModel
import cv2

try:
    from . import config
    from . import database
    from .minio_storage import minio_storage
    from .qdrant_service import qdrant_service
    from .deepface_service import deepface_service
    from .roboflow_detector import RoboflowHardhatDetector
    from .camera_stream import VideoCameraStream
    from .audio_alert import alert_manager
except ImportError:
    import config
    import database
    from minio_storage import minio_storage
    from qdrant_service import qdrant_service
    from deepface_service import deepface_service
    from roboflow_detector import RoboflowHardhatDetector
    from camera_stream import VideoCameraStream
    from audio_alert import alert_manager

# Khởi tạo Detector và Camera Streamer
detector = RoboflowHardhatDetector(
    api_key=config.ROBOFLOW_API_KEY,
    project_id=config.ROBOFLOW_PROJECT_ID,
    version=config.ROBOFLOW_MODEL_VERSION
)
camera_streamer = VideoCameraStream(detector)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Khởi động: Khởi tạo database và bắt đầu luồng camera
    print("[FastAPI] Khởi động Hardhat Safety Detection System...")
    try:
        database.init_db()
    except Exception as e:
        print(f"[Database Error]: Không thể khởi tạo bảng PostgreSQL: {e}")

    camera_streamer.start(config.DEFAULT_CAMERA_SOURCE)
    yield
    # Dọn dẹp khi tắt
    print("[FastAPI] Đang dừng camera streamer và giải phóng tài nguyên...")
    camera_streamer.stop()

# Khởi tạo ứng dụng FastAPI với Lifespan & Swagger Documentation tự động
app = FastAPI(
    title="Hardhat Vision Safety API",
    description="Hệ thống giám sát an toàn lao động AI & CSDL PostgreSQL",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Cấu hình Session Middleware (quản lý phiên đăng nhập có chữ ký bảo mật)
app.add_middleware(
    SessionMiddleware,
    secret_key=config.SECRET_KEY,
    max_age=86400 * 7,
    same_site="lax"
)

# Cấu hình CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# PYDANTIC SCHEMAS (DATA VALIDATION)
# ==========================================

class RegisterRequest(BaseModel):
    username: str
    password: str
    full_name: str
    email: Optional[str] = None
    role: Optional[str] = "operator"

class LoginRequest(BaseModel):
    username: str
    password: str

class CameraRequest(BaseModel):
    name: str
    type: Optional[str] = "webcam"
    source_url: str
    location: Optional[str] = ""

class ToggleCameraRequest(BaseModel):
    enabled: Optional[bool] = None

class UpdateCameraRequest(BaseModel):
    source: str

class UpdateSettingsRequest(BaseModel):
    api_key: Optional[str] = None
    project_id: Optional[str] = None
    version: Optional[Union[str, int]] = None
    confidence: Optional[Union[str, int, float]] = None
    cooldown: Optional[Union[str, int]] = None

# ==========================================
# VIDEO FEED STREAMING (MJPEG)
# ==========================================

def generate_frames():
    """Generator sinh luồng MJPEG ổn định đạt 30-60 FPS cho trình duyệt"""
    while True:
        frame_bytes = camera_streamer.get_jpeg_frame()
        if frame_bytes is not None:
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
            time.sleep(0.01)
        else:
            time.sleep(0.03)

@app.get("/video_feed")
def video_feed():
    return StreamingResponse(
        generate_frames(), 
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

# ==========================================
# AUTHENTICATION APIS (ĐĂNG NHẬP / ĐĂNG XUẤT / ĐĂNG KÝ)
# ==========================================

@app.post("/api/auth/register")
def api_register(req: RegisterRequest, request: Request):
    username = req.username.strip()
    password = req.password
    full_name = req.full_name.strip()
    email = (req.email or "").strip()
    role = req.role if req.role in ["admin", "operator", "supervisor"] else "operator"

    new_user, err = database.create_user(username, password, full_name, email, role)
    if err:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": err}
        )

    # Tự động đăng nhập luôn sau khi tạo tài khoản thành công
    request.session["user_id"] = new_user["id"]
    request.session["user_role"] = new_user["role"]
    request.session["user_name"] = new_user["full_name"]

    return {
        "success": True,
        "user": new_user,
        "message": f"Tạo tài khoản {new_user['full_name']} thành công!"
    }

@app.post("/api/auth/login")
def api_login(req: LoginRequest, request: Request):
    username = req.username.strip()
    password = req.password
    if not username or not password:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu"}
        )

    user = database.authenticate_user(username, password)
    if user:
        request.session["user_id"] = user["id"]
        request.session["user_role"] = user["role"]
        request.session["user_name"] = user["full_name"]
        return {
            "success": True,
            "user": user,
            "message": f"Xin chào {user['full_name']}! Đăng nhập thành công."
        }

    return JSONResponse(
        status_code=status.HTTP_401_UNAUTHORIZED,
        content={"success": False, "message": "Tên đăng nhập hoặc mật khẩu không chính xác!"}
    )

@app.post("/api/auth/logout")
def api_logout(request: Request):
    request.session.clear()
    return {"success": True, "message": "Đã đăng xuất khỏi hệ thống!"}

@app.get("/api/auth/me")
def api_me(request: Request):
    user_id = request.session.get("user_id")
    if user_id:
        user = database.get_user_by_id(user_id)
        if user:
            return {
                "authenticated": True,
                "user": {
                    "id": user["id"],
                    "username": user["username"],
                    "email": user["email"],
                    "full_name": user["full_name"],
                    "role": user["role"]
                }
            }
    return {"authenticated": False, "user": None}

@app.get("/api/auth/users")
def api_users_list():
    users = database.get_users_list()
    safe_users = []
    for u in users:
        safe_users.append({
            "id": u["id"],
            "username": u["username"],
            "email": u["email"],
            "full_name": u["full_name"],
            "role": u["role"],
            "is_active": u["is_active"],
            "last_login": u["last_login"],
            "created_at": u["created_at"]
        })
    return safe_users

# ==========================================
# SYSTEM & STATUS APIS
# ==========================================

@app.get("/api/status")
def api_status():
    status_info = camera_streamer.get_current_status()
    status_info["roboflow_project_id"] = detector.project_id
    status_info["roboflow_version"] = detector.version
    status_info["confidence_threshold"] = detector.confidence_threshold
    status_info["cooldown_seconds"] = alert_manager.cooldown
    return status_info

@app.get("/api/history")
def api_history(limit: int = 50):
    history = alert_manager.get_history(limit=limit)
    for item in history:
        if item.get("snapshot"):
            item["image_url"] = minio_storage.get_public_url(item["snapshot"])
    return history

@app.get("/api/stats")
def api_stats():
    return database.get_today_stats()

@app.get("/api/cameras")
def api_get_cameras():
    return database.get_cameras()

@app.post("/api/cameras")
def api_add_camera(req: CameraRequest, request: Request):
    name = req.name.strip()
    cam_type = (req.type or "webcam").strip()
    source_url = req.source_url.strip()
    location = (req.location or "").strip()
    user_id = request.session.get("user_id")

    if not name or not source_url:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "Tên và Nguồn camera không được để trống"}
        )

    created = database.add_camera(name, cam_type, source_url, location, user_id=user_id)
    return {"success": True, "camera": created, "message": "Đã thêm camera mới vào hệ thống!"}

@app.delete("/api/cameras/{cam_id}")
def api_delete_camera(cam_id: int):
    deleted = database.delete_camera(cam_id)
    if deleted:
        return {"success": True, "message": f"Đã xóa camera #{cam_id}"}
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={"success": False, "message": "Không tìm thấy camera"}
    )

@app.post("/api/toggle_camera")
def api_toggle_camera(req: ToggleCameraRequest):
    new_state = camera_streamer.toggle_camera_power(req.enabled)
    msg = "Đã bật camera và tiếp tục giám sát" if new_state else "Đã tắt camera và tạm dừng giám sát"
    return {"success": True, "camera_enabled": new_state, "message": msg}

@app.post("/api/update_camera")
def api_update_camera(req: UpdateCameraRequest):
    source = req.source.strip()
    normalized_source = camera_streamer.parse_source(source)
    camera_streamer.start(str(normalized_source))
    return {
        "success": True, 
        "source": str(normalized_source), 
        "message": f"Đã chuyển nguồn camera sang: {normalized_source}"
    }

@app.post("/api/manual_snapshot")
def api_manual_snapshot(request: Request):
    """Chụp ảnh bằng chứng thủ công ngay lập tức và lưu lên MinIO Object Storage"""
    with camera_streamer.lock:
        frame = camera_streamer.current_raw_frame
        if frame is None:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"success": False, "message": "Camera hiện không có tín hiệu hình ảnh"}
            )
        frame_copy = frame.copy()

    file_timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"manual_{file_timestamp}.jpg"

    # Tải lên MinIO Object Storage (kèm lưu bản sao đệm cục bộ)
    try:
        minio_storage.upload_violation_image(frame_copy, filename)
    except Exception as e:
        print(f"[MinIO Snapshot Error]: {e}")

    # Ghi nhận sự kiện vào CSDL
    database.record_violation(
        camera_name="Chụp Thủ Công",
        camera_source=str(camera_streamer.camera_source),
        violation_count=1,
        safe_count=0,
        confidence=1.0,
        snapshot_path=filename,
        details="Ảnh chụp bằng chứng thủ công từ Web Dashboard (MinIO Storage)",
        user_id=request.session.get("user_id")
    )

    image_url = minio_storage.get_public_url(filename)
    return {
        "success": True, 
        "filename": filename, 
        "image_url": image_url,
        "message": "Đã lưu ảnh snapshot bằng chứng thành công lên MinIO Storage!"
    }

# ==========================================
# MINIO OBJECT STORAGE & DAILY AUDIT APIS
# ==========================================

@app.get("/api/violations/image/{filename}")
def api_get_violation_image(filename: str):
    """Phục vụ ảnh vi phạm: Kéo trực tiếp từ MinIO Object Storage (kèm đệm cục bộ)"""
    data, mime = minio_storage.get_image_bytes(filename)
    if not data:
        raise HTTPException(status_code=404, detail="Không tìm thấy ảnh vi phạm")
    return Response(
        content=data, 
        media_type=mime,
        headers={"Cache-Control": "public, max-age=86400"}
    )

@app.get("/api/storage/status")
def api_storage_status():
    """Kiểm tra tình trạng kết nối MinIO Object Storage"""
    return minio_storage.get_status()

@app.get("/api/violations/dates")
def api_get_violation_dates():
    """Lấy danh sách các ngày có dữ liệu vi phạm để người dùng lọc theo ngày"""
    return database.get_violation_dates_summary()

@app.get("/api/violations/by-date")
def api_get_violations_by_date(
    date: str, 
    limit: int = 100, 
    offset: int = 0, 
    camera_id: Optional[int] = None
):
    """Lấy danh sách vi phạm và chỉ số an toàn của một ngày cụ thể (YYYY-MM-DD)"""
    kpi = database.get_date_kpi(date)
    violations = database.get_violations_by_date(date, limit=limit, offset=offset, camera_id=camera_id)
    
    # Bổ sung link MinIO cho từng vi phạm
    for v in violations:
        if v.get("snapshot_path"):
            v["image_url"] = minio_storage.get_public_url(v["snapshot_path"])
        else:
            v["image_url"] = None

    return {
        "success": True,
        "date": date,
        "kpi": kpi,
        "violations": violations,
        "storage": minio_storage.get_status()
    }

@app.get("/api/violations/export-by-date")
def api_export_violations_by_date(date: str):
    """Tải báo cáo CSV kiểm toán của một ngày cụ thể"""
    csv_content = database.export_violations_by_date_csv(date)
    filename = f"bao_cao_vi_pham_{date}.csv"
    return Response(
        content=csv_content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@app.get("/api/export_csv")
def api_export_csv():
    """Tải báo cáo vi phạm an toàn dạng CSV tương thích Excel"""
    csv_content = database.export_violations_csv()
    filename = f"bao_cao_vi_pham_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=csv_content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@app.post("/api/update_settings")
def api_update_settings(req: UpdateSettingsRequest):
    api_key = req.api_key.strip() if req.api_key is not None else None
    project_id = req.project_id.strip() if req.project_id is not None else None
    version = str(req.version).strip() if req.version is not None else None
    confidence = int(req.confidence) if req.confidence is not None else None
    cooldown = int(req.cooldown) if req.cooldown is not None else None

    detector.update_config(
        api_key=api_key,
        project_id=project_id,
        version=version,
        confidence=confidence
    )

    if cooldown is not None:
        alert_manager.cooldown = cooldown

    return {"success": True, "message": "Đã cập nhật cấu hình thành công!"}

@app.post("/api/test_alert")
def api_test_alert():
    triggered = alert_manager.trigger_alert(
        frame=None,
        violation_details="Thử nghiệm âm thanh cảnh báo từ Web Dashboard",
        camera_name="Test Mode",
        camera_source="Web Client",
        safe_count=0,
        violation_count=1,
        confidence=0.99
    )
    return {"success": True, "triggered": triggered, "message": "Đã kích hoạt thử nghiệm âm thanh!"}

# ==========================================
# PHỤC VỤ STATIC ASSETS & REACT SPA
# ==========================================

# 1. Mount thư mục ảnh vi phạm và âm thanh
if os.path.exists(config.VIOLATIONS_DIR):
    app.mount("/static/violations", StaticFiles(directory=config.VIOLATIONS_DIR), name="violations")

audio_dir = os.path.dirname(config.ALERT_AUDIO_PATH)
if os.path.exists(audio_dir):
    app.mount("/static/audio", StaticFiles(directory=audio_dir), name="audio")

# 2. Phục vụ React SPA (Vite Production Build)
dist_path = Path(config.REACT_DIST_DIR)
assets_path = dist_path / "assets"

if assets_path.exists():
    app.mount("/assets", StaticFiles(directory=str(assets_path)), name="frontend_assets")

@app.get("/")
def serve_index():
    index_file = dist_path / "index.html"
    if index_file.exists():
        return FileResponse(str(index_file))
    return {"message": "Hardhat Vision API is running. Please build the frontend React app."}

@app.get("/{full_path:path}")
def serve_spa(full_path: str):
    """Catch-all fallback route để hỗ trợ client-side routing của React SPA"""
    target = dist_path / full_path
    if target.exists() and target.is_file():
        return FileResponse(str(target))
    index_file = dist_path / "index.html"
    if index_file.exists():
        return FileResponse(str(index_file))
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={"detail": "Not found"}
    )

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "5000"))
    print("\n" + "="*60)
    print(" HỆ THỐNG GIÁM SÁT MŨ BẢO HỘ CÔNG TRƯỜNG (FASTAPI 2.0)")
    print(" CƠ SỞ DỮ LIỆU: POSTGRESQL 16 | CLOUD AI: ROBOFLOW")
    print("="*60)
    print(f" * Swagger API Docs:             http://localhost:{port}/docs")
    print(f" * Web Dashboard (React SPA):   http://localhost:{port}")
    print("="*60 + "\n")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)

