# Hardhat Vision System (Giám Sát Mũ Bảo Hộ Công Trường)

Ứng dụng trí tuệ nhân tạo giám sát an toàn lao động thời gian thực sử dụng mô hình học sâu **Roboflow RF-DETR** đám mây. Hệ thống phát hiện vi phạm không đội mũ bảo hộ, phát còi cảnh báo tiếng Việt, lưu trữ ảnh chụp bằng chứng vào **PostgreSQL 16**, và cung cấp Web Dashboard chuẩn Bento Grid xây dựng bằng **React 18** và **FastAPI**.

> **Khẩu hiệu cảnh báo:** *"Vui lòng đội mũ bảo hộ trước khi vào công trường"*

---

## 🌟 Kiến Trúc Kỹ Thuật (Architecture)

- **AI Engine**: Roboflow Cloud Hosted Inference (**RF-DETR**), tốc độ phản hồi ~8.3ms compute, không cần card GPU cục bộ.
- **Backend**: **FastAPI** (Python 3.12) hiệu năng cao, RESTful APIs, Swagger Interactive Docs (`/docs`), phân quyền và xác thực Session an toàn với Scrypt Hash.
- **Frontend**: **React 18 + Vite + Tailwind CSS + Lucide Icons**, phong cách Industrial Bento Grid OLED Dark Mode.
- **Cơ sở dữ liệu**: **PostgreSQL 16** với quan hệ chuẩn 1-1, 1-N (1 đường nối duy nhất giữa `users` và `violations` chuẩn hóa cho pgAdmin 4 ERD).
- **Containerization**: **Docker & Docker Compose** (Multi-stage build Node 20 + Python 3.12).

---

## 📁 Cấu Trúc Dự Án Mới

```text
hardhat_detection/
├── backend/                    # ĐÓNG GÓI BACKEND FASTAPI
│   ├── main.py                 # FastAPI application, REST endpoints, MJPEG video feed
│   ├── database.py             # PostgreSQL data access layer & Scrypt authentication
│   ├── config.py               # Quản lý cấu hình tập trung từ biến môi trường
│   ├── camera_stream.py        # Quản lý luồng đa luồng camera RTSP / IP Webcam
│   ├── roboflow_detector.py    # Cloud AI RF-DETR client
│   ├── audio_alert.py          # Quản lý sự kiện cảnh báo âm thanh và ghi nhật ký
│   └── requirements.txt        # Danh sách thư viện Python (FastAPI, uvicorn, psycopg2...)
│
├── frontend/                   # FRONTEND REACT SPA
│   ├── src/                    # Mã nguồn React (Header, HUD Player, Bento Grid Cards...)
│   ├── dist/                   # Bản build tĩnh phục vụ trực tiếp qua FastAPI
│   └── package.json
│
├── static/                     # TÀI NGUYÊN TĨNH DÙNG CHUNG
│   ├── audio/alert.mp3         # Giọng nói cảnh báo tiếng Việt chuẩn
│   └── violations/             # Thư mục lưu ảnh chụp bằng chứng vi phạm
│
├── Dockerfile                  # Multi-stage production build (Node 20 + Python 3.12)
├── docker-compose.yml          # Cấu hình cụm dịch vụ (PostgreSQL 16 + FastAPI App)
├── schema.sql                  # Schema PostgreSQL chuẩn (users, cameras, violations, stats)
├── .env                        # File biến môi trường (Roboflow Key, PostgreSQL...)
├── .dockerignore               # Tối ưu dung lượng Docker build context
└── run_app.sh                  # Phím tắt 1-click khởi chạy Docker Compose
```

---

## 🐳 Khởi Chạy Bằng Docker (Khuyến Nghị)

### 1. Khởi động toàn bộ cụm dịch vụ (PostgreSQL + FastAPI + React)
Tại thư mục dự án, chạy lệnh:

```bash
docker compose up --build
```
*(Hoặc dùng phím tắt: `./run_app.sh`)*

### 2. Mở trình duyệt trải nghiệm
- 🌐 **Web Dashboard (React SPA)**: [http://localhost:5000](http://localhost:5000)
- 📚 **Swagger API Documentation**: [http://localhost:5000/docs](http://localhost:5000/docs)
- 📱 **Xem từ điện thoại (cùng mạng WiFi)**: `http://<IP_MAY_TINH>:5000`

---

## ⚡ Tài Khoản Mẫu Thử Nghiệm Nhanh

Trên màn hình Đăng Nhập, bạn có thể click nút 1-Click hoặc nhập:
- 👑 **Quản Trị Viên (Admin)**: `admin` / `admin123` (Toàn quyền quản trị, chỉnh sửa cấu hình Roboflow & ngưỡng AI)
- 🛡️ **Cán Bộ Cổng (Operator)**: `guard` / `guard123` (Chế độ trực ca giám sát, còi báo động, kiểm tra vi phạm)
- Hoặc bấm tab **"Tạo Tài Khoản"** để tự đăng ký tài khoản mới theo ý muốn.
