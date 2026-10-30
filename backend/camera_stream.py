import time
import threading
import cv2
import numpy as np
try:
    from . import config
    from .roboflow_detector import RoboflowHardhatDetector
    from .audio_alert import alert_manager
except ImportError:
    import config
    from roboflow_detector import RoboflowHardhatDetector
    from audio_alert import alert_manager

class VideoCameraStream:
    def __init__(self, detector: RoboflowHardhatDetector):
        self.detector = detector
        self.camera_source = config.DEFAULT_CAMERA_SOURCE
        self.cap = None
        self.http_stream = None
        self.is_running = False
        self.is_camera_enabled = True  # Cờ bật/tắt camera
        self.worker_id = 0  # Định danh phiên chạy để triệt tiêu việc chạy song song 2 camera
        self.lock = threading.Lock()
        
        self.current_raw_frame = None
        self.current_annotated_frame = None
        self.last_analysis = {
            "has_violation": False,
            "violations": [],
            "safe": [],
            "others": [],
            "total_violations": 0,
            "total_safe": 0
        }
        
        self.fps = 0.0
        self.status_message = "Chưa kết nối"
        self.is_connected = False
        
        # Thread điều khiển
        self.capture_thread = None
        self.inference_thread = None
        self.inference_interval = 0.35  # Gửi API mỗi 0.35s (khoảng 3 lần/giây) để vừa mượt mà vừa tiết kiệm băng thông
        self.last_infer_call = 0

    def parse_source(self, src):
        """
        Chuyển đổi input nguồn camera thông minh:
        - Nếu là số: chuyển thành int (webcam 0, 1...)
        - Nếu là IP từ app IP Webcam (chứa :8080): tự động chuẩn hoá và thêm /video
        - Nếu người dùng quên gõ http://: tự động bổ sung
        """
        src = str(src).strip()
        if src.isdigit():
            return int(src)
        
        # Tự động thêm http:// nếu người dùng chỉ nhập 192.168.x.x:8080
        if not src.startswith(("http://", "https://", "rtsp://")) and ":" in src:
            src = "http://" + src
            
        # Tự động thêm /video nếu người dùng chỉ nhập link gốc http://192.168.x.x:8080
        if (":8080" in src or ":4747" in src) and not src.endswith(("/video", ".mjpg", "/mjpeg")):
            src = src.rstrip("/") + "/video"

        return src

    def toggle_camera_power(self, enabled=None):
        """Bật hoặc tắt camera theo yêu cầu (ngắt kết nối phần cứng và tạm dừng AI)"""
        with self.lock:
            if enabled is None:
                self.is_camera_enabled = not self.is_camera_enabled
            else:
                self.is_camera_enabled = bool(enabled)
            
            if not self.is_camera_enabled:
                # Giải phóng phần cứng camera để tắt đèn webcam / ngắt luồng
                if self.cap is not None:
                    try:
                        self.cap.release()
                    except Exception:
                        pass
                    self.cap = None
                if self.http_stream is not None:
                    try:
                        self.http_stream.close()
                    except Exception:
                        pass
                    self.http_stream = None
                self.is_connected = False
                self.fps = 0.0
                self.status_message = "Camera đang tắt"
                self.current_raw_frame = None
                self.current_annotated_frame = None
                self.last_analysis = {
                    "has_violation": False,
                    "violations": [],
                    "safe": [],
                    "others": [],
                    "total_violations": 0,
                    "total_safe": 0
                }
            else:
                self.status_message = "Đang bật lại camera..."

            return self.is_camera_enabled

    def start(self, source=None):
        with self.lock:
            if source is not None:
                self.camera_source = str(source).strip()
            self.worker_id += 1
            current_worker_id = self.worker_id

        self.stop()
        self.is_running = True
        self.is_camera_enabled = True
        
        self.capture_thread = threading.Thread(target=self._capture_worker, args=(current_worker_id,), daemon=True)
        self.capture_thread.start()

        self.inference_thread = threading.Thread(target=self._inference_worker, args=(current_worker_id,), daemon=True)
        self.inference_thread.start()

    def stop(self):
        self.is_running = False
        if self.cap is not None:
            try:
                self.cap.release()
            except Exception:
                pass
            self.cap = None
        if self.http_stream is not None:
            try:
                self.http_stream.close()
            except Exception:
                pass
            self.http_stream = None
        self.is_connected = False

    def _capture_worker(self, worker_id):
        """Luồng điều hướng nhận dữ liệu camera: Tự động phân loại giữa HTTP stream và Webcam máy tính"""
        if self.worker_id != worker_id:
            return

        parsed_src = self.parse_source(self.camera_source)
        print(f"[Camera] Bắt đầu mở nguồn #{worker_id}: {parsed_src}")
        
        # Nếu là luồng HTTP (camera điện thoại IP Webcam / DroidCam qua Wi-Fi)
        if isinstance(parsed_src, str) and parsed_src.startswith(("http://", "https://")):
            self._capture_http_mjpeg(parsed_src, worker_id)
        else:
            self._capture_opencv(parsed_src, worker_id)

    def _capture_http_mjpeg(self, url, worker_id):
        """
        Bộ thu hình ảnh Native MJPEG trực tiếp cho camera điện thoại:
        - Triệt tiêu 100% cảnh báo 'Expected boundary -- not found' của FFmpeg
        - Đạt tốc độ tối đa ~30 FPS thực tế với độ trễ gần như bằng 0
        - Tự động bỏ frame cũ khi mạng Wi-Fi bị nghẽn (Zero Buffer Lag)
        """
        import urllib.request

        while self.is_running and self.worker_id == worker_id:
            if not self.is_camera_enabled:
                time.sleep(0.2)
                continue

            self.status_message = "Đang kết nối camera điện thoại..."
            try:
                self.http_stream = urllib.request.urlopen(url, timeout=4)
                stream = self.http_stream
                if self.worker_id != worker_id:
                    break

                self.is_connected = True
                self.status_message = "Đang kết nối ổn định (High-Speed Native MJPEG)"
                print(f"[Camera] Đã kết nối camera điện thoại thành công (Native Stream #{worker_id})")
                
                bytes_buf = b""
                frame_count = 0
                start_time = time.time()

                while self.is_running and self.is_camera_enabled and self.worker_id == worker_id:
                    chunk = stream.read(8192)
                    if not chunk:
                        break
                    bytes_buf += chunk

                    # Quét tìm điểm đầu (\xff\xd8) và điểm cuối (\xff\xd9) của ảnh JPEG
                    a = bytes_buf.find(b"\xff\xd8")
                    b = bytes_buf.find(b"\xff\xd9")

                    if a != -1 and b != -1 and b > a:
                        jpg = bytes_buf[a:b+2]
                        bytes_buf = bytes_buf[b+2:]

                        # Nếu buffer đọng quá 64KB do mạng gián đoạn, xả bỏ dữ liệu cũ để luôn xem thời gian thực
                        if len(bytes_buf) > 65536:
                            last_a = bytes_buf.rfind(b"\xff\xd8")
                            if last_a != -1:
                                bytes_buf = bytes_buf[last_a:]
                            else:
                                bytes_buf = b""

                        frame = cv2.imdecode(np.frombuffer(jpg, dtype=np.uint8), cv2.IMREAD_COLOR)
                        if frame is not None and self.worker_id == worker_id:
                            with self.lock:
                                self.current_raw_frame = frame
                                annotated = self.detector.draw_annotations(frame, self.last_analysis, fps=self.fps)
                                self.current_annotated_frame = annotated

                            frame_count += 1
                            now = time.time()
                            elapsed = now - start_time
                            if elapsed >= 1.0:
                                self.fps = frame_count / elapsed
                                frame_count = 0
                                start_time = now

            except Exception as e:
                if self.worker_id != worker_id:
                    break
                self.is_connected = False
                self.status_message = "Mất kết nối camera điện thoại (Wi-Fi), đang thử lại..."
                time.sleep(1.0)

    def _capture_opencv(self, parsed_src, worker_id):
        """Bộ thu hình ảnh OpenCV chuẩn cho Webcam máy tính hoặc RTSP"""
        if self.worker_id != worker_id:
            return

        self.status_message = "Đang mở nguồn camera..."
        try:
            self.cap = cv2.VideoCapture(parsed_src)
            self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
        except Exception as e:
            self.status_message = "Không thể mở nguồn camera"
            self.is_connected = False
            return

        frame_count = 0
        start_time = time.time()

        while self.is_running and self.worker_id == worker_id:
            if not self.is_camera_enabled:
                time.sleep(0.2)
                continue

            if self.cap is None or not self.cap.isOpened():
                try:
                    self.cap = cv2.VideoCapture(parsed_src)
                    self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                except Exception:
                    pass

                if self.cap is None or not self.cap.isOpened():
                    self.is_connected = False
                    self.status_message = "Không thể kết nối đến nguồn camera"
                    time.sleep(1.0)
                    continue

            success, frame = self.cap.read()
            if not success or frame is None:
                self.is_connected = False
                self.status_message = "Mất tín hiệu camera hoặc đã hết video..."
                time.sleep(0.3)
                continue

            if self.worker_id != worker_id:
                break

            self.is_connected = True
            self.status_message = "Đang hoạt động ổn định"
            
            with self.lock:
                self.current_raw_frame = frame
                annotated = self.detector.draw_annotations(frame, self.last_analysis, fps=self.fps)
                self.current_annotated_frame = annotated

            frame_count += 1
            now = time.time()
            elapsed = now - start_time
            if elapsed >= 1.0:
                self.fps = frame_count / elapsed
                frame_count = 0
                start_time = now

    def _inference_worker(self, worker_id):
        """Luồng gọi AI Roboflow chạy nền độc lập với luồng camera"""
        while self.is_running and self.worker_id == worker_id:
            if not self.is_camera_enabled:
                time.sleep(0.2)
                continue

            now = time.time()
            if (now - self.last_infer_call) >= self.inference_interval and not self.detector.is_inferring:
                frame_to_process = None
                with self.lock:
                    if self.current_raw_frame is not None and self.is_connected and self.worker_id == worker_id:
                        frame_to_process = self.current_raw_frame.copy()

                if frame_to_process is not None and self.worker_id == worker_id:
                    self.last_infer_call = now
                    self.detector.is_inferring = True
                    try:
                        # Gọi Roboflow Inference
                        predictions = self.detector.infer_frame(frame_to_process)
                        analysis = self.detector.analyze_predictions(predictions)
                        
                        if self.worker_id == worker_id:
                            with self.lock:
                                self.last_analysis = analysis

                            # Nếu phát hiện vi phạm: kích hoạt cảnh báo âm thanh
                            if analysis["has_violation"]:
                                details = f"Phát hiện {analysis['total_violations']} người không đội mũ bảo hộ!"
                                alert_manager.trigger_alert(
                                    frame=frame_to_process,
                                    violation_details=details,
                                    camera_name="Camera Giám Sát" if not str(self.camera_source).startswith("http") else "Camera Điện Thoại",
                                    camera_source=str(self.camera_source),
                                    safe_count=analysis.get("total_safe", 0),
                                    violation_count=analysis.get("total_violations", 1),
                                    confidence=analysis.get("max_confidence", 0.0)
                                )
                    except Exception as e:
                        print(f"[Inference Error]: {e}")
                    finally:
                        self.detector.is_inferring = False

            time.sleep(0.04)

    def get_jpeg_frame(self):
        """Lấy frame định dạng JPEG để stream qua Flask HTTP"""
        with self.lock:
            if not self.is_camera_enabled:
                # Màn hình hiển thị khi người dùng tắt camera
                frame = np.zeros((480, 640, 3), dtype=np.uint8)
                cv2.rectangle(frame, (15, 15), (625, 465), (45, 52, 70), 2)
                cv2.putText(frame, "CAMERA DANG TAT", (180, 200), cv2.FONT_HERSHEY_DUPLEX, 0.9, (80, 80, 240), 2)
                cv2.putText(frame, "He thong dang tam dung ghi hinh va phan tich.", (120, 250), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (170, 170, 170), 1)
                cv2.putText(frame, "Nhan 'Bat Camera' tren giao dien de tiep tuc.", (130, 290), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 220, 0), 1)
            elif self.current_annotated_frame is not None:
                frame = self.current_annotated_frame
            else:
                # Tạo màn hình chờ mẫu nếu chưa có camera
                frame = np.zeros((480, 640, 3), dtype=np.uint8)
                msg1 = "HE THONG GIAM SAT AN TOAN LAO DONG"
                msg2 = self.status_message
                msg3 = "Ket noi Webcam (0) hoac Camera Dien thoai (IP Webcam URL)"
                cv2.putText(frame, msg1, (30, 180), cv2.FONT_HERSHEY_DUPLEX, 0.7, (0, 200, 255), 2)
                cv2.putText(frame, msg2, (30, 230), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 1)
                cv2.putText(frame, msg3, (30, 280), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (150, 150, 150), 1)

        # Mã hoá JPEG tốc độ cao (chất lượng 70 giúp nén siêu nhanh, đạt 30+ FPS)
        ret, buffer = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 70])
        return buffer.tobytes() if ret else None

    def get_current_status(self):
        with self.lock:
            should_play, alert_event = alert_manager.check_and_clear_web_alert()
            return {
                "camera_enabled": self.is_camera_enabled,
                "is_connected": self.is_connected,
                "status_message": self.status_message,
                "fps": round(self.fps, 1),
                "camera_source": self.camera_source,
                "has_violation": self.last_analysis["has_violation"],
                "total_safe": self.last_analysis["total_safe"],
                "total_violations": self.last_analysis["total_violations"],
                "api_latency_ms": int(self.detector.last_inference_time * 1000),
                "api_error": self.detector.last_api_error,
                "is_configured": self.detector.is_configured(),
                "should_play_alert": should_play,
                "alert_event": alert_event,
                "latest_alert_id": alert_manager.alert_counter,
                "voice_message": config.ALERT_VOICE_MESSAGE
            }

