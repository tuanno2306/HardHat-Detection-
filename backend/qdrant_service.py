"""
Dịch vụ Quản lý Cơ sở Dữ liệu Vector Qdrant cho Khuôn mặt Công nhân (worker_faces)
Sử dụng chuẩn 512D Cosine Vector kết hợp với DeepFace Facenet512
"""

import os
import logging
from typing import List, Dict, Any, Optional
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance, 
    VectorParams, 
    PointStruct, 
    Filter, 
    FieldCondition, 
    MatchValue
)

logger = logging.getLogger(__name__)

class QdrantService:
    def __init__(self):
        self.host = os.getenv("QDRANT_HOST", "127.0.0.1")
        self.port = int(os.getenv("QDRANT_PORT", "6333"))
        self.collection_name = os.getenv("QDRANT_COLLECTION", "worker_faces")
        self.vector_size = 512  # Facenet512 vector size
        self.client: Optional[QdrantClient] = None
        self._initialize()

    def _initialize(self):
        """Khởi tạo kết nối tới máy chủ Qdrant và đảm bảo collection tồn tại"""
        try:
            self.client = QdrantClient(
                host=self.host, 
                port=self.port,
                check_compatibility=False,
                timeout=10.0
            )
            self.ensure_collection()
            logger.info(f"Đã kết nối Qdrant tại {self.host}:{self.port}, collection: {self.collection_name}")
        except Exception as e:
            logger.error(f"Lỗi khởi tạo Qdrant: {e}")
            self.client = None

    def ensure_collection(self) -> bool:
        """Đảm bảo collection worker_faces tồn tại với cấu hình chuẩn Cosine 512D"""
        if not self.client:
            return False
        try:
            collections = self.client.get_collections().collections
            collection_names = [c.name for c in collections]
            if self.collection_name not in collection_names:
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=VectorParams(size=self.vector_size, distance=Distance.COSINE)
                )
                logger.info(f"Đã tạo mới collection Qdrant: {self.collection_name} (512D, Cosine)")
            return True
        except Exception as e:
            logger.error(f"Lỗi kiểm tra/tạo collection Qdrant: {e}")
            return False

    def upsert_worker(self, worker_id: int, vector: List[float], payload: Dict[str, Any]) -> bool:
        """Thêm hoặc cập nhật vector khuôn mặt công nhân vào Qdrant"""
        if not self.client:
            return False
        try:
            point = PointStruct(
                id=int(worker_id),
                vector=vector,
                payload=payload
            )
            self.client.upsert(
                collection_name=self.collection_name,
                points=[point]
            )
            logger.info(f"Đã upsert vector công nhân ID {worker_id} vào Qdrant")
            return True
        except Exception as e:
            logger.error(f"Lỗi upsert vector công nhân {worker_id}: {e}")
            return False

    def search_worker(self, vector: List[float], limit: int = 1, score_threshold: float = 0.55) -> List[Dict[str, Any]]:
        """
        Tìm kiếm công nhân có khuôn mặt tương đồng nhất với vector đầu vào
        Trả về danh sách kết quả gồm {worker_id, score, payload}
        """
        if not self.client:
            return []
        try:
            # Dùng query_points theo chuẩn Qdrant client 1.x
            res = self.client.query_points(
                collection_name=self.collection_name,
                query=vector,
                limit=limit,
                score_threshold=score_threshold
            )
            
            matches = []
            for pt in res.points:
                matches.append({
                    "worker_id": int(pt.id),
                    "score": round(float(pt.score), 4),
                    "payload": pt.payload or {}
                })
            return matches
        except Exception as e:
            logger.error(f"Lỗi tìm kiếm vector công nhân trong Qdrant: {e}")
            return []

    def delete_worker(self, worker_id: int) -> bool:
        """Xóa vector công nhân khỏi Qdrant khi công nhân nghỉ việc"""
        if not self.client:
            return False
        try:
            self.client.delete(
                collection_name=self.collection_name,
                points_selector=[int(worker_id)]
            )
            logger.info(f"Đã xóa vector công nhân ID {worker_id} khỏi Qdrant")
            return True
        except Exception as e:
            logger.error(f"Lỗi xóa vector công nhân {worker_id}: {e}")
            return False

    def count_workers(self) -> int:
        """Đếm số vector khuôn mặt đã lưu trong Qdrant"""
        if not self.client:
            return 0
        try:
            info = self.client.get_collection(collection_name=self.collection_name)
            return info.points_count or 0
        except Exception:
            return 0

    def get_status(self) -> Dict[str, Any]:
        """Lấy thông tin trạng thái kết nối Qdrant"""
        connected = False
        points = 0
        if self.client:
            try:
                self.client.get_collections()
                connected = True
                points = self.count_workers()
            except Exception:
                connected = False

        return {
            "is_connected": connected,
            "host": self.host,
            "port": self.port,
            "collection": self.collection_name,
            "vector_size": self.vector_size,
            "total_vectors": points
        }

# Singleton instance
qdrant_service = QdrantService()

