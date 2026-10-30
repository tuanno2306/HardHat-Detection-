import os
import io
import json
import logging
from typing import Optional, Tuple, Union
import cv2
import numpy as np
from minio import Minio
from minio.error import S3Error

try:
    from . import config
except ImportError:
    import config

logger = logging.getLogger("MinIOStorage")

class MinIOStorageService:
    def __init__(self):
        self.endpoint = config.MINIO_ENDPOINT
        self.access_key = config.MINIO_ACCESS_KEY
        self.secret_key = config.MINIO_SECRET_KEY
        self.secure = config.MINIO_SECURE
        self.bucket = config.MINIO_BUCKET
        self.public_url = config.MINIO_PUBLIC_URL.rstrip("/")
        
        self.client: Optional[Minio] = None
        self.is_connected = False
        self._init_client()

    def _init_client(self):
        """Khởi tạo kết nối tới MinIO Server và tự động tạo Bucket nếu chưa có"""
        try:
            self.client = Minio(
                endpoint=self.endpoint,
                access_key=self.access_key,
                secret_key=self.secret_key,
                secure=self.secure
            )
            # Kiểm tra hoặc tạo bucket lưu trữ ảnh vi phạm
            if not self.client.bucket_exists(self.bucket):
                self.client.make_bucket(self.bucket)
                logger.info(f"[MinIO] Đã tự động tạo bucket mới: {self.bucket}")
                
                # Cấu hình Anonymous Read Policy để ảnh có thể hiển thị trực tiếp trên trình duyệt
                policy = {
                    "Version": "2012-10-17",
                    "Statement": [
                        {
                            "Effect": "Allow",
                            "Principal": {"AWS": ["*"]},
                            "Action": ["s3:GetObject"],
                            "Resource": [f"arn:aws:s3:::{self.bucket}/*"]
                        }
                    ]
                }
                self.client.set_bucket_policy(self.bucket, json.dumps(policy))
                logger.info(f"[MinIO] Đã cấp quyền đọc công khai cho bucket: {self.bucket}")
            else:
                logger.info(f"[MinIO] Bucket '{self.bucket}' đã sẵn sàng.")

            self.is_connected = True
        except Exception as e:
            logger.warning(f"[MinIO] Không thể kết nối tới MinIO ({self.endpoint}): {e}. Chuyển sang lưu trữ đệm cục bộ.")
            self.is_connected = False

    def upload_violation_image(self, image_data: Union[np.ndarray, bytes], filename: str) -> Tuple[bool, str]:
        """
        Tải ảnh vi phạm lên MinIO Object Storage kèm cơ chế sao lưu cục bộ (Local Fallback)
        :param image_data: Frame ảnh OpenCV (numpy array) hoặc bytes
        :param filename: Tên file ảnh (ví dụ: violation_20261029_145020.jpg)
        :return: (thành_công_bool, đường_dẫn_hoặc_tên_file)
        """
        # 1. Chuyển đổi dữ liệu sang JPEG bytes
        if isinstance(image_data, np.ndarray):
            success, encoded_buf = cv2.imencode(".jpg", image_data, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
            if not success:
                logger.error(f"[MinIO] Lỗi mã hóa frame JPEG cho file {filename}")
                return False, filename
            img_bytes = encoded_buf.tobytes()
        elif isinstance(image_data, bytes):
            img_bytes = image_data
        else:
            logger.error("[MinIO] Dữ liệu ảnh không hợp lệ!")
            return False, filename

        # 2. Luôn lưu một bản sao lưu cục bộ vào static/violations để đảm bảo dữ liệu không bao giờ bị mất
        try:
            local_path = os.path.join(config.VIOLATIONS_DIR, filename)
            with open(local_path, "wb") as f:
                f.write(img_bytes)
        except Exception as e:
            logger.warning(f"[MinIO] Không thể lưu bản sao cục bộ: {e}")

        # 3. Tải lên MinIO Object Storage
        if not self.is_connected or self.client is None:
            self._init_client()

        if self.is_connected and self.client is not None:
            try:
                data_stream = io.BytesIO(img_bytes)
                self.client.put_object(
                    bucket_name=self.bucket,
                    object_name=filename,
                    data=data_stream,
                    length=len(img_bytes),
                    content_type="image/jpeg"
                )
                logger.info(f"[MinIO] Tải lên thành công: {self.bucket}/{filename} ({len(img_bytes)} bytes)")
                return True, filename
            except Exception as e:
                logger.error(f"[MinIO] Lỗi khi tải ảnh {filename} lên MinIO: {e}")
                self.is_connected = False
                return False, filename

        return False, filename

    def get_image_bytes(self, filename: str) -> Tuple[Optional[bytes], str]:
        """
        Lấy nội dung nhị phân của ảnh: Ưu tiên kéo từ MinIO Object Storage, nếu MinIO offline thì đọc từ đệm cục bộ
        """
        # Thử lấy từ MinIO
        if self.is_connected and self.client is not None:
            try:
                response = self.client.get_object(self.bucket, filename)
                data = response.read()
                response.close()
                response.release_conn()
                return data, "image/jpeg"
            except Exception:
                pass

        # Fallback đọc từ đĩa cứng cục bộ
        local_path = os.path.join(config.VIOLATIONS_DIR, filename)
        if os.path.exists(local_path):
            try:
                with open(local_path, "rb") as f:
                    return f.read(), "image/jpeg"
            except Exception as e:
                logger.error(f"[MinIO] Lỗi đọc ảnh cục bộ: {e}")

        return None, "image/jpeg"

    def get_public_url(self, filename: str) -> str:
        """Trả về URL truy cập ảnh"""
        if self.is_connected:
            return f"{self.public_url}/{self.bucket}/{filename}"
        return f"/api/violations/image/{filename}"

    def get_status(self) -> dict:
        """Kiểm tra tình trạng sức khỏe kết nối MinIO"""
        if not self.is_connected:
            self._init_client()
        return {
            "is_connected": self.is_connected,
            "endpoint": self.endpoint,
            "bucket": self.bucket,
            "public_url": self.public_url
        }

# Khởi tạo thể hiện Singleton dùng chung toàn hệ thống
minio_storage = MinIOStorageService()

