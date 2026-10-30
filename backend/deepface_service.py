"""
Dịch vụ Nhận diện Khuôn mặt Công nhân sử dụng Thư viện DeepFace (Facenet512 + RetinaFace)
Hỗ trợ:
1. Trích xuất vector 512D khi đăng ký công nhân (từ file hoặc camera quét mặt).
2. Phát hiện và trích xuất vector tất cả khuôn mặt trong ảnh vi phạm để đối soát với Qdrant.
3. Hỗ trợ kiểm tra nhanh chất lượng ảnh quét khuôn mặt (Face Scan Probe).
"""

import os
import io
import logging
from typing import List, Dict, Any, Optional, Union
import cv2
import numpy as np
from PIL import Image
from deepface import DeepFace

logger = logging.getLogger(__name__)

class DeepFaceService:
    def __init__(self):
        self.model_name = "Facenet512"
        self.primary_detector = "retinaface"
        self.fallback_detector = "opencv"
        self.vector_size = 512
        logger.info(f"Khởi tạo DeepFaceService với model: {self.model_name}, detector: {self.primary_detector}")

        # Tải sẵn bộ phân loại Haar Cascade cho Live Face Scan Probe (<15ms)
        self.face_cascade = None
        for cp in [
            "/root/.deepface/weights/haarcascade_frontalface_default.xml",
            os.path.expanduser("~/.deepface/weights/haarcascade_frontalface_default.xml")
        ]:
            if os.path.exists(cp):
                try:
                    self.face_cascade = cv2.CascadeClassifier(cp)
                    logger.info(f"Loaded Haar Cascade preloader from {cp}")
                    break
                except Exception as e:
                    logger.warning(f"Không thể nạp cascade từ {cp}: {e}")

    def _prepare_image(self, image_input: Union[str, bytes, np.ndarray, tuple]) -> Optional[np.ndarray]:
        """Chuẩn hóa mọi dạng đầu vào thành BGR numpy array chuẩn của OpenCV"""
        try:
            if isinstance(image_input, (tuple, list)):
                image_input = image_input[0]
            if image_input is None:
                return None
            if isinstance(image_input, str):
                if not os.path.exists(image_input):
                    logger.warning(f"File ảnh không tồn tại: {image_input}")
                    return None
                img = cv2.imread(image_input)
                return img
            elif isinstance(image_input, bytes):
                nparr = np.frombuffer(image_input, np.uint8)
                img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                return img
            elif isinstance(image_input, np.ndarray):
                return image_input
            else:
                logger.error(f"Định dạng ảnh không được hỗ trợ: {type(image_input)}")
                return None
        except Exception as e:
            logger.error(f"Lỗi chuẩn hóa ảnh: {e}")
            return None

    def extract_face_embedding(self, image_input: Union[str, bytes, np.ndarray]) -> Dict[str, Any]:
        """
        Trích xuất vector 512D từ một ảnh chân dung công nhân (khi đăng ký).
        Ưu tiên khuôn mặt rõ nhất trong ảnh.
        """
        img = self._prepare_image(image_input)
        if img is None:
            return {"success": False, "message": "Không thể đọc dữ liệu ảnh"}

        # 1. Thử nhận diện bằng RetinaFace
        for detector in [self.primary_detector, self.fallback_detector]:
            try:
                results = DeepFace.represent(
                    img_path=img,
                    model_name=self.model_name,
                    detector_backend=detector,
                    enforce_detection=True,
                    align=True
                )
                if results and len(results) > 0:
                    face = results[0]
                    return {
                        "success": True,
                        "embedding": face.get("embedding"),
                        "facial_area": face.get("facial_area"),
                        "confidence": face.get("face_confidence", 1.0),
                        "detector": detector
                    }
            except Exception as e:
                logger.debug(f"Detector {detector} không phát hiện được mặt (enforce_detection=True): {e}")

        # 2. Thử lần cuối không ép buộc (enforce_detection=False)
        try:
            results = DeepFace.represent(
                img_path=img,
                model_name=self.model_name,
                detector_backend=self.fallback_detector,
                enforce_detection=False,
                align=False
            )
            if results and len(results) > 0:
                face = results[0]
                return {
                    "success": True,
                    "embedding": face.get("embedding"),
                    "facial_area": face.get("facial_area"),
                    "confidence": face.get("face_confidence", 0.5),
                    "detector": f"{self.fallback_detector}_relaxed"
                }
        except Exception as e:
            logger.error(f"DeepFace represent thất bại: {e}")

        return {"success": False, "message": "Không tìm thấy khuôn mặt rõ nét trong ảnh. Vui lòng căn chỉnh lại góc mặt!"}

    def detect_all_faces_in_violation(self, image_input: Union[str, bytes, np.ndarray]) -> List[Dict[str, Any]]:
        """
        Phát hiện và trích xuất vector tất cả khuôn mặt trong ảnh vi phạm góc rộng
        Dùng để đối soát hàng loạt với Qdrant.
        """
        img = self._prepare_image(image_input)
        if img is None:
            return []

        h, w, _ = img.shape
        detected_faces = []

        try:
            results = DeepFace.represent(
                img_path=img,
                model_name=self.model_name,
                detector_backend=self.primary_detector,
                enforce_detection=False,
                align=True
            )

            for item in results:
                area = item.get("facial_area", {})
                fw = area.get("w", 0)
                fh = area.get("h", 0)

                # Bỏ qua trường hợp DeepFace fallback trả về toàn bộ bức ảnh khi không thấy mặt
                if fw >= w * 0.95 and fh >= h * 0.95:
                    continue

                # Chỉ giữ các khuôn mặt có kích thước tối thiểu từ 20x20 pixel
                if fw >= 20 and fh >= 20:
                    detected_faces.append({
                        "embedding": item.get("embedding"),
                        "facial_area": area,
                        "confidence": item.get("face_confidence", 0.0)
                    })

        except Exception as e:
            logger.warning(f"Lỗi bóc tách khuôn mặt ảnh vi phạm bằng DeepFace: {e}")

        return detected_faces

    def probe_face_alignment(self, image_input: Union[str, bytes, np.ndarray, tuple]) -> Dict[str, Any]:
        """
        Kiểm tra nhanh chất lượng khuôn mặt theo thời gian thực (phục vụ buồng quét mặt)
        Trả về vị trí bounding box, chất lượng mặt và lời khuyên căn chỉnh chi tiết theo từng hướng.
        """
        img = self._prepare_image(image_input)
        if img is None:
            return {
                "detected": False, 
                "status": "not_found", 
                "direction": "none",
                "advice": "Không nhận được tín hiệu hình ảnh từ camera",
                "auto_capture_ready": False
            }

        h, w, _ = img.shape
        fx, fy, fw, fh = 0, 0, 0, 0
        detected = False

        # Thử detector opencv haar cascade trước (siêu tốc <15ms)
        if self.face_cascade is not None:
            try:
                gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                # Tăng tương phản nhẹ bằng equalizeHist để bắt mặt nhạy hơn trong môi trường webcam
                gray_eq = cv2.equalizeHist(gray)
                faces = self.face_cascade.detectMultiScale(
                    gray_eq, 
                    scaleFactor=1.08, 
                    minNeighbors=3, 
                    minSize=(30, 30)
                )
                if len(faces) == 0:
                    faces = self.face_cascade.detectMultiScale(
                        gray, 
                        scaleFactor=1.08, 
                        minNeighbors=3, 
                        minSize=(30, 30)
                    )
                if len(faces) > 0:
                    faces = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)
                    fx, fy, fw, fh = [int(v) for v in faces[0]]
                    detected = True
            except Exception as e:
                logger.debug(f"Haar cascade detection error: {e}")

        # Nếu cascade chưa thấy, dùng DeepFace.extract_faces với retinaface (độ chính xác cao)
        if not detected:
            try:
                extracted = DeepFace.extract_faces(
                    img_path=img,
                    detector_backend="retinaface",
                    enforce_detection=True,
                    align=False
                )
                if extracted and len(extracted) > 0:
                    area = extracted[0].get("facial_area", {})
                    fx, fy, fw, fh = area.get("x", 0), area.get("y", 0), area.get("w", 0), area.get("h", 0)
                    if fw > 20 and fh > 20:
                        detected = True
            except Exception:
                pass

        if not detected:
            return {
                "detected": False,
                "status": "not_found",
                "direction": "none",
                "advice": "Chưa thấy khuôn mặt. Hãy nhìn thẳng vào camera!",
                "box": None,
                "center": None,
                "auto_capture_ready": False
            }

        # Tọa độ tâm chuẩn hóa [0.0, 1.0]
        center_x = (fx + fw / 2.0) / w
        center_y = (fy + fh / 2.0) / h
        width_ratio = fw / float(w)
        height_ratio = fh / float(h)

        # Vì màn hình hiển thị camera ở chế độ gương (-scale-x-100):
        # Tọa độ X trên màn hình mắt người nhìn thấy là (1.0 - center_x)
        screen_x = 1.0 - center_x

        # Đánh giá vùng tâm lý tưởng:
        # X từ 0.35 đến 0.65, Y từ 0.25 đến 0.65, kích thước khuôn mặt rộng từ 10% đến 58% khung hình
        is_horizontally_centered = 0.35 <= center_x <= 0.65
        is_vertically_centered = 0.25 <= center_y <= 0.65
        is_good_distance = 0.10 <= width_ratio <= 0.58

        # Sinh lời khuyên và hướng di chuyển cụ thể:
        direction_code = "centered"
        advice = ""

        if width_ratio < 0.10:
            direction_code = "closer"
            advice = "🔍 Hãy tiến lại gần camera hơn một chút"
        elif width_ratio > 0.58:
            direction_code = "further"
            advice = "🔙 Hãy lùi ra xa camera một chút"
        elif screen_x < 0.35:
            # Mặt đang nằm lệch bên trái màn hình người nhìn -> cần nhích sang phải màn hình
            direction_code = "screen_right"
            advice = "➡️ Nhích sang bên PHẢI màn hình"
        elif screen_x > 0.65:
            # Mặt đang nằm lệch bên phải màn hình người nhìn -> cần nhích sang trái màn hình
            direction_code = "screen_left"
            advice = "⬅️ Nhích sang bên TRÁI màn hình"
        elif center_y < 0.25:
            direction_code = "down"
            advice = "⬇️ Hãy hạ thấp cằm / ngồi xuống một chút"
        elif center_y > 0.65:
            direction_code = "up"
            advice = "⬆️ Hãy nâng cằm / ngồi thẳng người lên"
        else:
            direction_code = "centered"
            advice = "🎯 Khuôn mặt chuẩn xác! Giữ nguyên 3s để tự động chụp..."

        is_optimal = (
            is_horizontally_centered and 
            is_vertically_centered and 
            is_good_distance
        )

        return {
            "detected": True,
            "status": "optimal" if is_optimal else "adjust",
            "direction": direction_code,
            "advice": advice,
            "box": {"x": int(fx), "y": int(fy), "w": int(fw), "h": int(fh)},
            "center": {"x": round(center_x, 3), "y": round(center_y, 3)},
            "screen_x": round(screen_x, 3),
            "width_ratio": round(width_ratio, 3),
            "height_ratio": round(height_ratio, 3),
            "auto_capture_ready": is_optimal
        }

# Singleton instance
deepface_service = DeepFaceService()
