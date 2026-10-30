# ==========================================
# STAGE 1: XÂY DỰNG FRONTEND REACT SPA
# ==========================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

# Tận dụng Docker layer caching cho dependencies
COPY frontend/package*.json ./
RUN npm install

# Build mã nguồn giao diện React + Vite + Tailwind CSS
COPY frontend/ ./
RUN npm run build

# ==========================================
# STAGE 2: BACKEND RUNTIME (FASTAPI + PYTHON 3.12)
# ==========================================
FROM python:3.12-slim AS runner
WORKDIR /app

# Cài đặt thư viện hệ thống cần thiết cho OpenCV và kết nối mạng
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Cài đặt Python dependencies
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Sao chép mã nguồn backend
COPY backend/ /app/backend/
COPY static/ /app/static/

# Sao chép gói build React SPA từ Stage 1
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Đảm bảo thư mục lưu ảnh chụp bằng chứng vi phạm tồn tại
RUN mkdir -p /app/static/violations

# Biến môi trường hệ thống
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app/backend
ENV REACT_DIST_DIR=/app/frontend/dist
ENV STATIC_DIR=/app/static
ENV VIOLATIONS_DIR=/app/static/violations

# Mở port 5000
EXPOSE 5000

# Khởi chạy FastAPI Server bằng Uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5000"]

