import os
from pathlib import Path
from dotenv import load_dotenv

# Tìm và nạp file .env từ thư mục gốc hoặc thư mục backend
BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent

dotenv_path_root = PROJECT_ROOT / ".env"
dotenv_path_local = BASE_DIR / ".env"

if dotenv_path_root.exists():
    load_dotenv(dotenv_path_root)
elif dotenv_path_local.exists():
    load_dotenv(dotenv_path_local)
else:
    load_dotenv()

# ==========================================
# CẤU HÌNH BẢO MẬT & PHIÊN LÀM VIỆC (SESSION)
# ==========================================
SECRET_KEY = os.getenv("SECRET_KEY", "hardhat_vision_production_secret_key_2026")

# ==========================================
# CẤU HÌNH ROBOFLOW CLOUD INFERENCE
# ==========================================
ROBOFLOW_API_KEY = os.getenv("ROBOFLOW_API_KEY", "")
ROBOFLOW_PROJECT_ID = os.getenv("ROBOFLOW_PROJECT_ID", "hardhat3-dptal")
ROBOFLOW_MODEL_VERSION = os.getenv("ROBOFLOW_MODEL_VERSION", "1")
CONFIDENCE_THRESHOLD = int(os.getenv("CONFIDENCE_THRESHOLD", "40"))

# ==========================================
# CẤU HÌNH PHÂN LOẠI (CLASSES)
# ==========================================
SAFE_CLASSES = [
    "helmet", "hard-hat", "hardhat", "safe", "with_helmet", 
    "yellow-helmet", "blue-helmet", "white-helmet", "red-helmet"
]

VIOLATION_CLASSES = [
    "head", "no-helmet", "no_helmet", "without_helmet", 
    "no-hardhat", "unsafe", "human_head"
]

# ==========================================
# CẤU HÌNH NGUỒN CAMERA
# ==========================================
DEFAULT_CAMERA_SOURCE = os.getenv("CAMERA_SOURCE", "0")

# ==========================================
# CẤU HÌNH CẢNH BÁO
# ==========================================
ALERT_COOLDOWN_SECONDS = int(os.getenv("ALERT_COOLDOWN_SECONDS", "15"))
ENABLE_LOCAL_SYSTEM_AUDIO = os.getenv("ENABLE_LOCAL_SYSTEM_AUDIO", "false").lower() == "true"
ALERT_VOICE_MESSAGE = "Vui lòng đội mũ bảo hộ trước khi vào công trường"

# ==========================================
# CẤU HÌNH LƯU TRỮ MINIO OBJECT STORAGE (S3)
# ==========================================
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "127.0.0.1:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")
MINIO_SECURE = os.getenv("MINIO_SECURE", "false").lower() == "true"
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "hardhat-violations")
MINIO_PUBLIC_URL = os.getenv("MINIO_PUBLIC_URL", "http://127.0.0.1:9000")

# ==========================================
# ĐƯỜNG DẪN THƯ MỤC & TÀI NGUYÊN TĨNH
# ==========================================
VIOLATIONS_DIR = os.getenv("VIOLATIONS_DIR", str(PROJECT_ROOT / "static" / "violations"))
ALERT_AUDIO_PATH = os.getenv("ALERT_AUDIO_PATH", str(PROJECT_ROOT / "static" / "audio" / "alert.mp3"))
STATIC_DIR = os.getenv("STATIC_DIR", str(PROJECT_ROOT / "static"))
REACT_DIST_DIR = os.getenv("REACT_DIST_DIR", str(PROJECT_ROOT / "frontend" / "dist"))

# Tạo sẵn thư mục lưu ảnh vi phạm nếu chưa tồn tại
os.makedirs(VIOLATIONS_DIR, exist_ok=True)

