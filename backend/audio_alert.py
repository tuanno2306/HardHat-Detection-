import os
import time
import threading
import cv2
from datetime import datetime
try:
    from . import config, database
    from .minio_storage import minio_storage
except ImportError:
    import config
    import database
    from minio_storage import minio_storage

class AudioAlertManager:
    def __init__(self):
        self.last_alert_time = 0
        self.cooldown = config.ALERT_COOLDOWN_SECONDS
        self.audio_path = config.ALERT_AUDIO_PATH
        self.lock = threading.Lock()
        
        self.alert_counter = 0  # Sequential ID cho đa client đồng bộ
        self.pending_web_alert = False
        self.last_alert_event = None
        self.alert_history = []
        self.enable_local_sound = config.ENABLE_LOCAL_SYSTEM_AUDIO
        self.is_playing_local = False
        
        # Thử khởi tạo pygame mixer nếu có sound device
        self.pygame_available = False
        try:
            import pygame
            pygame.mixer.init()
            if os.path.exists(self.audio_path):
                self.pygame_available = True
        except Exception:
            self.pygame_available = False

    def can_trigger(self) -> bool:
        return (time.time() - self.last_alert_time) >= self.cooldown

    def trigger_alert(self, frame=None, violation_details=None, camera_name="Camera Hiện Tại", camera_source=None, safe_count=0, violation_count=1, confidence=0.0) -> bool:
        """
        Kích hoạt cảnh báo vi phạm:
        - Kiểm tra thời gian giãn cách (cooldown)
        - Lưu ảnh bằng chứng vi phạm
        - Ghi log vào cơ sở dữ liệu PostgreSQL
        - Cập nhật số thứ tự alert_counter cho đa người xem
        """
        with self.lock:
            now = time.time()
            if (now - self.last_alert_time) < self.cooldown:
                return False  # Đang trong thời gian chờ cooldown
            
            self.last_alert_time = now
            self.alert_counter += 1
            self.pending_web_alert = True
            
            timestamp_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            file_timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            snapshot_filename = None
            
            # Lưu ảnh chụp vi phạm lên MinIO Object Storage (kèm đệm cục bộ)
            if frame is not None:
                snapshot_filename = f"violation_{file_timestamp}.jpg"
                try:
                    minio_storage.upload_violation_image(frame, snapshot_filename)
                except Exception as e:
                    print(f"[Alert] Lỗi lưu ảnh snapshot lên MinIO: {e}")

            # Lưu vào PostgreSQL
            db_id = None
            try:
                db_res = database.record_violation(
                    camera_name=camera_name,
                    camera_source=str(camera_source or config.DEFAULT_CAMERA_SOURCE),
                    violation_count=violation_count,
                    safe_count=safe_count,
                    confidence=confidence,
                    snapshot_path=snapshot_filename,
                    details=violation_details or "Phát hiện người không đội mũ bảo hộ"
                )
                if db_res:
                    db_id = db_res.get("id")
            except Exception as e:
                print(f"[Database Error]: Không thể ghi vi phạm vào PostgreSQL: {e}")

            event = {
                "alert_id": self.alert_counter,
                "db_id": db_id,
                "id": file_timestamp,
                "timestamp": timestamp_str,
                "message": config.ALERT_VOICE_MESSAGE,
                "snapshot": snapshot_filename,
                "camera_name": camera_name,
                "details": violation_details or "Phát hiện người không đội mũ bảo hộ"
            }
            self.last_alert_event = event
            self.alert_history.insert(0, event)
            if len(self.alert_history) > 50:
                self.alert_history.pop()

            # Chỉ phát âm thanh cục bộ trên máy chủ nếu được cấu hình bật
            if self.enable_local_sound:
                threading.Thread(target=self._play_sound_local, daemon=True).start()
            return True

    def _play_sound_local(self):
        """Phát âm thanh cục bộ qua loa phần cứng của máy tính với khóa chống trùng lặp"""
        if not self.enable_local_sound or self.is_playing_local:
            return

        self.is_playing_local = True
        try:
            if self.pygame_available:
                import pygame
                pygame.mixer.music.load(self.audio_path)
                pygame.mixer.music.play()
                while pygame.mixer.music.get_busy():
                    time.sleep(0.1)
            else:
                os.system(f"paplay {self.audio_path} 2>/dev/null || mpg123 -q {self.audio_path} 2>/dev/null || true")
        except Exception:
            pass
        finally:
            self.is_playing_local = False

    def get_latest_alert_state(self):
        """Lấy trạng thái cảnh báo tuần tự để mọi Web Client đồng bộ không bị mất sự kiện"""
        with self.lock:
            return {
                "alert_id": self.alert_counter,
                "last_alert_time": self.last_alert_time,
                "last_event": self.last_alert_event
            }

    def check_and_clear_web_alert(self):
        """Duy trì tương thích ngược cho endpoint cũ"""
        with self.lock:
            should_play = self.pending_web_alert
            self.pending_web_alert = False
            return should_play, self.last_alert_event

    def get_history(self, limit=50):
        """Lấy lịch sử vi phạm ưu tiên từ PostgreSQL"""
        try:
            rows = database.get_violations(limit=limit)
            if rows:
                formatted = []
                for r in rows:
                    formatted.append({
                        "id": r["id"],
                        "timestamp": r["timestamp"],
                        "camera_name": r["camera_name"],
                        "snapshot": r["snapshot_path"],
                        "details": r["details"],
                        "confidence_pct": float(r["confidence_pct"]) if r["confidence_pct"] else 0.0,
                        "status": r["status"]
                    })
                return formatted
        except Exception as e:
            print(f"[History DB Error]: {e}")

        # Fallback RAM
        with self.lock:
            return list(self.alert_history)

alert_manager = AudioAlertManager()
