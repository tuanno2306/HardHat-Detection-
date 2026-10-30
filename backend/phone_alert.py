"""
Module Điều khiển Phần cứng Điện thoại Camera qua IP Webcam REST & WebSocket API
Hỗ trợ:
1. Chớp đèn flash trợ sáng camera 1 nhịp dứt khoát thu hút sự chú ý (/enabletorch và /disabletorch).
2. Phát âm thanh cảnh báo trực tiếp qua loa ngoài điện thoại (Two-Way Audio WebSocket: ws://.../audioin.wav).
3. Tương thích chuẩn âm thanh 16-bit PCM Mono WAV của IP Webcam Server.
4. Chạy hoàn toàn bất đồng bộ (Non-blocking Daemon Thread), không làm trễ khung hình camera.
"""

import os
import time
import wave
import struct
import asyncio
import threading
import urllib.parse
import requests
import logging

logger = logging.getLogger(__name__)

class PhoneHardwareAlert:
    def __init__(self):
        self.last_trigger_time = 0
        self.lock = threading.Lock()
        
        # Đường dẫn ưu tiên: Trong backend/ (được Docker bind-mount) hoặc static/audio/
        self.audio_wav_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "alert.wav")
        if not os.path.exists(self.audio_wav_path):
            self.audio_wav_path = os.path.join(
                os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 
                "static", "audio", "alert.wav"
            )

        self.sample_rate = 16000
        self.nchannels = 1
        self.sampwidth = 2
        self.raw_pcm_frames = None
        self.streaming_wav_header = None
        self.raw_wav_bytes = None
        
        self._load_and_prepare_audio()

    def _load_and_prepare_audio(self):
        """Tải trước file âm thanh và khởi tạo header streaming WAV chuẩn IP Webcam"""
        try:
            if os.path.exists(self.audio_wav_path):
                with open(self.audio_wav_path, "rb") as f:
                    self.raw_wav_bytes = f.read()

                with wave.open(self.audio_wav_path, "rb") as wf:
                    self.sample_rate = wf.getframerate()
                    self.nchannels = wf.getnchannels()
                    self.sampwidth = wf.getsampwidth()
                    self.raw_pcm_frames = wf.readframes(wf.getnframes())

                # Tạo 44-byte WAV header với cờ streaming infinite 0xffffffff (chuẩn ipwebcam.js)
                header = bytearray(44)
                header[0:4] = b"RIFF"
                struct.pack_into("<I", header, 4, 0xffffffff)
                header[8:12] = b"WAVE"
                header[12:16] = b"fmt "
                struct.pack_into("<I", header, 16, 16)
                struct.pack_into("<H", header, 20, 1)  # PCM
                struct.pack_into("<H", header, 22, self.nchannels)
                struct.pack_into("<I", header, 24, self.sample_rate)
                struct.pack_into("<I", header, 28, self.sample_rate * self.nchannels * self.sampwidth)
                struct.pack_into("<H", header, 32, self.nchannels * self.sampwidth)
                struct.pack_into("<H", header, 34, self.sampwidth * 8)
                header[36:40] = b"data"
                struct.pack_into("<I", header, 40, 0xffffffff)
                self.streaming_wav_header = bytes(header)

                logger.info(
                    f"[PhoneAlert] Sẵn sàng dữ liệu âm thanh: {self.audio_wav_path} "
                    f"({self.sample_rate}Hz, {self.nchannels}ch, {len(self.raw_pcm_frames)} bytes PCM)"
                )
            else:
                logger.warning(f"[PhoneAlert] Chưa tìm thấy file âm thanh tại {self.audio_wav_path}")
        except Exception as e:
            logger.error(f"[PhoneAlert] Lỗi đọc và phân tích alert.wav: {e}")

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

    def _stream_audio_websocket(self, base_url: str):
        """Phát âm thanh cảnh báo tới loa ngoài điện thoại qua kênh WebSocket /audioin.wav"""
        import websockets

        ws_url = base_url.replace("https://", "wss://").replace("http://", "ws://") + "/audioin.wav"

        async def _async_ws_send():
            async with websockets.connect(ws_url, open_timeout=2.0) as ws:
                # 1. Gửi header WAV streaming chuẩn IP Webcam
                await ws.send(self.streaming_wav_header)

                # 2. Đẩy các khung PCM theo nhịp thời gian thực
                chunk_size = 4096
                frames = self.raw_pcm_frames
                bytes_per_sec = self.sample_rate * self.nchannels * self.sampwidth
                
                for i in range(0, len(frames), chunk_size):
                    chunk = frames[i:i + chunk_size]
                    await ws.send(chunk)
                    chunk_duration = len(chunk) / bytes_per_sec
                    await asyncio.sleep(chunk_duration * 0.85)

                await asyncio.sleep(0.3)
                logger.info(f"[PhoneAlert] Đã stream xong âm thanh qua WebSocket tới loa điện thoại ({ws_url})")

        asyncio.run(_async_ws_send())

    def trigger_phone_alert(self, camera_source: str, message: str = "Cảnh báo, vui lòng đội mũ bảo hộ", force: bool = False) -> bool:
        """
        Kích hoạt cảnh báo loa ngoài trên điện thoại IP Webcam:
        - Phát câu cảnh báo tiếng Việt qua giao thức WebSocket Two-Way Audio (/audioin.wav).
        - Đã loại bỏ hoàn toàn việc bật/tắt đèn Flash để bảo toàn 100% cảm biến camera, không gây drop frame hay đứng hình.
        """
        if not self.is_phone_camera(camera_source):
            return False

        base_url = self.extract_base_url(camera_source)
        if not base_url:
            return False

        now = time.time()
        with self.lock:
            # Chống kích hoạt dồn dập (cooldown 6s giữa 2 lần nếu không ép buộc)
            if not force and (now - self.last_trigger_time < 6.0):
                return False
            self.last_trigger_time = now

        def _async_worker():
            try:
                logger.info(f"[PhoneAlert] Bắt đầu phát âm thanh cảnh báo tới loa điện thoại tại {base_url}...")

                if not self.raw_pcm_frames:
                    self._load_and_prepare_audio()

                # Loa ngoài: Truyền dữ liệu âm thanh tới Two-Way Audio qua WebSocket
                if self.raw_pcm_frames and self.streaming_wav_header:
                    try:
                        self._stream_audio_websocket(base_url)
                    except Exception as ws_err:
                        logger.warning(f"[PhoneAlert] WebSocket lỗi ({ws_err}), thử fallback HTTP POST...")
                        if self.raw_wav_bytes:
                            try:
                                requests.post(
                                    f"{base_url}/audioin.wav",
                                    data=self.raw_wav_bytes,
                                    headers={"Content-Type": "audio/wav"},
                                    timeout=2.0
                                )
                            except Exception as http_err:
                                logger.debug(f"[PhoneAlert] Fallback HTTP thất bại: {http_err}")
                else:
                    logger.warning("[PhoneAlert] Không có dữ liệu âm thanh PCM để phát!")

                logger.info(f"[PhoneAlert] Hoàn tất phát cảnh báo loa tại {base_url}")
            except Exception as e:
                logger.warning(f"[PhoneAlert] Lỗi trong chuỗi cảnh báo điện thoại tại {base_url}: {e}")

        # Khởi chạy trong Daemon Thread độc lập để 100% không chặn luồng video chính
        thread = threading.Thread(target=_async_worker, daemon=True)
        thread.start()
        return True

# Singleton instance
phone_alert_manager = PhoneHardwareAlert()

