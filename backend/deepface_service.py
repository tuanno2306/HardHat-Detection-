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

    def _prepare_image(self, image_input: Union[str, bytes, np.ndarray]) -> Optional[np.ndarray]:
        """Chuẩn hóa mọi dạng đầu vào thành BGR numpy array chuẩn của OpenCV"""
        try:
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

    def probe_face_alignment(self, image_input: Union[str, bytes, np.ndarray]) -> Dict[str, Any]:
        """
        Kiểm tra nhanh chất lượng khuôn mặt theo thời gian thực (phục vụ buồng quét mặt)
        Trả về vị trí bounding box, chất lượng mặt và lời khuyên căn chỉnh.
        """
        img = self._prepare_image(image_input)
        if img is None:
            return {"detected": False, "message": "Không nhận được tín hiệu hình ảnh"}

        h, w, _ = img.shape

        try:
            # Dùng opencv haar cascade để phản hồi siêu tốc (<15ms)
            results = DeepFace.represent(
                img_path=img,
                model_name=self.model_name,
                detector_backend="opencv",
                enforce_detection=True,
                align=False
            )
            if results and len(results) > 0:
                area = results[0].get("facial_area", {})
                fx, fy, fw, fh = area.get("x", 0), area.get("y", 0), area.get("w", 0), area.get("h", 0)
                
                # Tính tâm mặt
                center_x = (fx + fw / 2) / w
                center_y = (fy + fh / 2) / h
                size_ratio = (fw * fh) / (w * h)

                is_centered = 0.35 <= center_x <= 0.65 and 0.25 <= center_y <= 0.70
                is_good_size = 0.03 <= size_ratio <= 0.60

                status = "optimal" if (is_centered and is_good_size) else "adjust"
                advice = "Khuôn mặt chuẩn xác! Giữ nguyên để chụp." if status == "optimal" else "Vui lòng đưa mặt vào giữa khung tròn."

                return {
                    "detected": True,
                    "status": status,
                    "advice": advice,
                    "box": {"x": fx, "y": fy, "w": fw, "h": fh},
                    "center": {"x": center_x, "y": center_y}
                }
        except Exception:
            pass

        return {
            "detected": False,
            "status": "not_found",
            "advice": "Chưa phát hiện khuôn mặt. Hãy nhìn thẳng vào camera!"
        }

# Singleton instance
deepface_service = DeepFaceService()
