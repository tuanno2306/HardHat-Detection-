import base64
import time
import requests
import cv2
import numpy as np
try:
    from . import config
except ImportError:
    import config

class RoboflowHardhatDetector:
    def __init__(self, api_key=None, project_id=None, version=None):
        self.api_key = api_key or config.ROBOFLOW_API_KEY
        self.project_id = project_id or config.ROBOFLOW_PROJECT_ID
        self.version = str(version or config.ROBOFLOW_MODEL_VERSION)
        self.confidence_threshold = config.CONFIDENCE_THRESHOLD
        
        self.safe_classes = [c.lower() for c in config.SAFE_CLASSES]
        self.violation_classes = [c.lower() for c in config.VIOLATION_CLASSES]
        
        self.last_predictions = []
        self.last_inference_time = 0
        self.last_api_error = None
        self.is_inferring = False
        
        # Tái sử dụng HTTP Session để giữ kết nối Keep-Alive (giảm độ trễ từ 500ms xuống <100ms)
        self.session = requests.Session()

    def update_config(self, api_key=None, project_id=None, version=None, confidence=None):
        if api_key is not None:
            self.api_key = api_key.strip()
        if project_id is not None:
            self.project_id = project_id.strip()
        if version is not None:
            self.version = str(version).strip()
        if confidence is not None:
            self.confidence_threshold = int(confidence)

    def is_configured(self) -> bool:
        return bool(self.api_key and self.project_id and self.version)

    def infer_frame(self, frame):
        """
        Gửi frame sang Roboflow Hosted Inference API và nhận về danh sách predictions
        """
        if not self.is_configured():
            self.last_api_error = "Chưa cấu hình Roboflow API Key! Vui lòng nhập API Key trong phần Cài đặt."
            return []

        try:
            # Thu nhỏ nhẹ ảnh trước khi gửi để tối ưu tốc độ mạng và giảm độ trễ
            h, w = frame.shape[:2]
            max_dim = 640
            if max(h, w) > max_dim:
                scale = max_dim / float(max(h, w))
                send_frame = cv2.resize(frame, (int(w * scale), int(h * scale)))
            else:
                send_frame = frame

            # Mã hoá ảnh sang định dạng JPEG base64 (chất lượng 70 để gửi siêu nhanh)
            success, encoded_img = cv2.imencode(".jpg", send_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 70])
            if not success:
                return []
            
            img_b64 = base64.b64encode(encoded_img).decode("ascii")

            # Endpoint Roboflow
            # Hỗ trợ cả 2 dạng: project_id/version hoặc model_id trực tiếp
            if "/" in self.project_id:
                endpoint = f"https://detect.roboflow.com/{self.project_id}?api_key={self.api_key}&confidence={self.confidence_threshold}"
            else:
                endpoint = f"https://detect.roboflow.com/{self.project_id}/{self.version}?api_key={self.api_key}&confidence={self.confidence_threshold}"

            start_t = time.time()
            response = self.session.post(
                endpoint,
                data=img_b64,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=3.0
            )
            elapsed = time.time() - start_t

            if response.status_code == 200:
                data = response.json()
                predictions = data.get("predictions", [])
                
                # Nếu ảnh gửi đi bị scale, quy đổi toạ độ về kích thước frame gốc
                if max(h, w) > max_dim:
                    scale_inv = 1.0 / scale
                    for p in predictions:
                        p["x"] = p["x"] * scale_inv
                        p["y"] = p["y"] * scale_inv
                        p["width"] = p["width"] * scale_inv
                        p["height"] = p["height"] * scale_inv

                self.last_predictions = predictions
                self.last_inference_time = elapsed
                self.last_api_error = None
                return predictions
            else:
                err_text = response.text[:200]
                self.last_api_error = f"Roboflow API Lỗi ({response.status_code}): {err_text}"
                return self.last_predictions

        except requests.exceptions.Timeout:
            self.last_api_error = "Roboflow API timeout (>3.5s)"
            return self.last_predictions
        except Exception as e:
            self.last_api_error = f"Lỗi gọi Roboflow: {str(e)}"
            return self.last_predictions

    def analyze_predictions(self, predictions):
        """
        Phân tích kết quả dự đoán:
        - Đếm số mũ bảo hộ (safe)
        - Đếm số vi phạm không đội mũ (violation)
        - Trả về chi tiết phân loại
        """
        safe_items = []
        violation_items = []
        other_items = []

        for p in predictions:
            class_name = str(p.get("class", "")).lower().strip()
            conf = float(p.get("confidence", 0.0))

            # Kiểm tra xem nhãn thuộc nhóm an toàn hay vi phạm
            is_safe = any(s in class_name for s in self.safe_classes)
            is_violation = any(v in class_name for v in self.violation_classes)

            item = {
                "class": class_name,
                "confidence": conf,
                "box": (
                    int(p["x"] - p["width"] / 2),
                    int(p["y"] - p["height"] / 2),
                    int(p["x"] + p["width"] / 2),
                    int(p["y"] + p["height"] / 2)
                )
            }

            if is_violation:
                violation_items.append(item)
            elif is_safe:
                safe_items.append(item)
            else:
                other_items.append(item)

        has_violation = len(violation_items) > 0
        return {
            "has_violation": has_violation,
            "violations": violation_items,
            "safe": safe_items,
            "others": other_items,
            "total_violations": len(violation_items),
            "total_safe": len(safe_items)
        }

    def draw_annotations(self, frame, analysis, fps=0):
        """
        Vẽ bounding boxes, nhãn cảnh báo và thanh thông báo trạng thái lên frame
        """
        annotated = frame.copy()
        h, w = annotated.shape[:2]

        # 1. Vẽ các đối tượng AN TOÀN (Có đội mũ) - MÀU XANH LÁ
        for item in analysis["safe"]:
            x1, y1, x2, y2 = item["box"]
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(w, x2), min(h, y2)
            conf_pct = int(item["confidence"] * 100)
            label = f"AN TOAN ({item['class']}: {conf_pct}%)"
            
            # Khung xanh lá
            cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 220, 0), 2)
            
            # Nền chữ
            (lw, lh), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 1)
            cv2.rectangle(annotated, (x1, max(0, y1 - 22)), (x1 + lw + 8, y1), (0, 180, 0), -1)
            cv2.putText(annotated, label, (x1 + 4, y1 - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1, cv2.LINE_AA)

        # 2. Vẽ các đối tượng VI PHẠM (Không đội mũ) - MÀU ĐỎ CẢNH BÁO
        for item in analysis["violations"]:
            x1, y1, x2, y2 = item["box"]
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(w, x2), min(h, y2)
            conf_pct = int(item["confidence"] * 100)
            label = f"VI PHAM: KHONG DOI MU ({conf_pct}%)"
            
            # Khung đỏ dày nhấp nháy
            cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 0, 255), 3)
            
            # Góc bo cảnh báo
            line_len = min(20, (x2 - x1) // 3)
            cv2.line(annotated, (x1, y1), (x1 + line_len, y1), (0, 0, 255), 5)
            cv2.line(annotated, (x1, y1), (x1, y1 + line_len), (0, 0, 255), 5)
            
            (lw, lh), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
            cv2.rectangle(annotated, (x1, max(0, y1 - 26)), (x1 + lw + 10, y1), (0, 0, 220), -1)
            cv2.putText(annotated, label, (x1 + 5, y1 - 7), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2, cv2.LINE_AA)

        # 3. Vẽ các đối tượng khác (nếu có, ví dụ person) - MÀU VÀNG
        for item in analysis["others"]:
            x1, y1, x2, y2 = item["box"]
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(w, x2), min(h, y2)
            label = f"{item['class']} ({int(item['confidence']*100)}%)"
            cv2.rectangle(annotated, (x1, y1), (x2, y2), (255, 200, 0), 1)
            cv2.putText(annotated, label, (x1, y1 - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 200, 0), 1)

        # 4. Thanh trạng thái trên đầu màn hình (Top Banner)
        banner_h = 45
        if analysis["has_violation"]:
            # Banner đỏ rực báo động
            cv2.rectangle(annotated, (0, 0), (w, banner_h), (0, 0, 200), -1)
            cv2.putText(annotated, "CANH BAO: VUI LONG DOI MU BAO HO TRUOC KHI VAO CONG TRUONG!", 
                        (15, 30), cv2.FONT_HERSHEY_DUPLEX, 0.7, (255, 255, 255), 2, cv2.LINE_AA)
        else:
            # Banner xanh an toàn
            cv2.rectangle(annotated, (0, 0), (w, banner_h), (25, 120, 25), -1)
            cv2.putText(annotated, "TRANG THAI: AN TOAN - CONG TRUONG HOP LE", 
                        (15, 30), cv2.FONT_HERSHEY_DUPLEX, 0.7, (255, 255, 255), 2, cv2.LINE_AA)

        # 5. Thông số thống kê ở góc dưới
        stat_text = f"Mũ bảo hộ: {analysis['total_safe']} | Vi phạm: {analysis['total_violations']}"
        if fps > 0:
            stat_text += f" | FPS: {fps:.1f}"
        if self.last_inference_time > 0:
            stat_text += f" | API: {int(self.last_inference_time * 1000)}ms"

        cv2.rectangle(annotated, (0, h - 30), (w, h), (0, 0, 0), -1)
        cv2.putText(annotated, stat_text, (15, h - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (200, 200, 200), 1, cv2.LINE_AA)

        return annotated

