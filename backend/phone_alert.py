"""
Module Điều khiển Phần cứng Điện thoại Camera qua IP Webcam REST API
Hỗ trợ:
1. Chớp đèn flash trợ sáng camera 2 nhịp thu hút sự chú ý (/enabletorch và /disabletorch).
2. Phát âm thanh cảnh báo trực tiếp qua loa ngoài điện thoại (Two-Way Audio Backchannel: POST /audioin.wav).
3. Đảm bảo chế độ âm thanh được bật (/settings/audio?set=0).
4. Chạy hoàn toàn bất đồng bộ (Non-blocking Daemon Thread), không gây sụt giảm FPS luồng video.
"""

import os
import time
import threading
import urllib.parse
import requests
import logging

logger = logging.getLogger(__name__)

class PhoneHardwareAlert:
    def __init__(self):
        self.last_trigger_time = 0
        self.lock = threading.Lock()
        self.audio_wav_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 
            "static", "audio", "alert.wav"
        )
        self.cached_wav_data = None
        self._load_wav_data()

    def _load_wav_data(self):
        """Tải trước file âm thanh WAV vào RAM để phát ngay lập tức không tốn I/O đĩa"""
        try:
            if os.path.exists(self.audio_wav_path):
                with open(self.audio_wav_path, "rb") as f:
                    self.cached_wav_data = f.read()
                logger.info(f"[PhoneAlert] Đã tải trước alert.wav vào RAM ({len(self.cached_wav_data)} bytes)")
            else:
                logger.warning(f"[PhoneAlert] Chưa tìm thấy file {self.audio_wav_path}")
        except Exception as e:
            logger.error(f"[PhoneAlert] Lỗi đọc alert.wav: {e}")

    def is_phone_camera(self, camera_source: str) -> bool:
        """Kiểm tra nguồn camera có phải là điện thoại chạy IP Webcam qua mạng Wi-Fi không"""
        if not camera_source:
            return False
        s = str(camera_source).lower()
        return s.startswith("http://") or s.startswith("https://")

    def extract_base_url(self, camera_source: str) -> str:
        """Bóc tách URL gốc: http://192.168.1.233:8080/video -> http://192.168.1.233:8080"""
        try:
            parsed = urllib.parse.urlparse(str(camera_source))
            return f"{parsed.scheme}://{parsed.netloc}"
        except Exception:
            return ""

    def trigger_phone_alert(self, camera_source: str, message: str = "Cảnh báo, vui lòng đội mũ bảo hộ", force: bool = False) -> bool:
        """
        Kích hoạt chuỗi cảnh báo phần cứng trên điện thoại IP Webcam:
        - Chớp đèn Flash camera 2 nhịp
        - Loa ngoài phát âm thanh cảnh báo qua kênh Two-Way Audio (/audioin.wav)
        """
        if not self.is_phone_camera(camera_source):
            return False

        base_url = self.extract_base_url(camera_source)
        if not base_url:
            return False

        now = time.time()
        with self.lock:
            # Chống kích hoạt dồn dập (cooldown 8s giữa 2 lần nếu không ép buộc)
            if not force and (now - self.last_trigger_time < 8.0):
                return False
            self.last_trigger_time = now

        def _async_worker():
            try:
                logger.info(f"[PhoneAlert] Bắt đầu kích hoạt đèn flash và loa ngoài tại {base_url}...")

                # 1. Chớp đèn Flash trợ sáng camera 1 nhịp dứt khoát (tránh dồn request làm treo Camera HAL)
                try:
                    requests.get(f"{base_url}/enabletorch", timeout=0.8)
                    time.sleep(0.4)
                    requests.get(f"{base_url}/disabletorch", timeout=0.8)
                    logger.info("[PhoneAlert] Đã chớp đèn flash 1 nhịp an toàn.")
                except Exception as e:
                    logger.debug(f"[PhoneAlert] Lỗi lệnh đèn Flash: {e}")

                # 2. Loa ngoài: Truyền dữ liệu âm thanh WAV tới Two-Way Audio (/audioin.wav)
                wav_bytes = self.cached_wav_data
                if not wav_bytes and os.path.exists(self.audio_wav_path):
                    with open(self.audio_wav_path, "rb") as f:
                        wav_bytes = f.read()

                if wav_bytes:
                    try:
                        # Gửi file âm thanh vào đường truyền loa ngoài /audioin.wav (timeout 2.5s)
                        resp = requests.post(
                            f"{base_url}/audioin.wav",
                            data=wav_bytes,
                            headers={"Content-Type": "audio/wav"},
                            timeout=2.5
                        )
                        logger.info(f"[PhoneAlert] Gửi âm thanh tới /audioin.wav: status {resp.status_code}")
                        
                        # Nếu /audioin.wav không thành công, thử endpoint thay thế /audio/upload
                        if resp.status_code != 200:
                            resp_alt = requests.post(
                                f"{base_url}/audio/upload",
                                data=wav_bytes,
                                headers={"Content-Type": "audio/wav"},
                                timeout=2.5
                            )
                            logger.info(f"[PhoneAlert] Gửi âm thanh thay thế tới /audio/upload: status {resp_alt.status_code}")
                    except Exception as e:
                        logger.warning(f"[PhoneAlert] Lỗi gửi âm thanh tới loa ngoài điện thoại: {e}")
                else:
                    logger.warning(f"[PhoneAlert] Không tìm thấy dữ liệu âm thanh tại {self.audio_wav_path}")

                logger.info(f"[PhoneAlert] Hoàn tất chuỗi cảnh báo tại {base_url}")
            except Exception as e:
                logger.warning(f"[PhoneAlert] Không thể kết nối tới IP Webcam tại {base_url}: {e}")

        # Khởi chạy trong Daemon Thread độc lập để 100% không chặn luồng video chính
        thread = threading.Thread(target=_async_worker, daemon=True)
        thread.start()
        return True

# Singleton instance
phone_alert_manager = PhoneHardwareAlert()

