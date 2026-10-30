// Biến toàn cục
let isAudioUnlocked = false;
let isCameraOn = true;
const alertAudio = document.getElementById("alertAudio");
const alarmIndicator = document.getElementById("alarmIndicator");
const audioStatusBadge = document.getElementById("audioStatusBadge");

// Câu cảnh báo mặc định
const ALERT_TEXT = "Vui lòng đội mũ bảo hộ trước khi vào công trường";

// Kích hoạt âm thanh trình duyệt sau lần tương tác đầu tiên
function enableAudio() {
    if (alertAudio) {
        alertAudio.play().then(() => {
            alertAudio.pause();
            alertAudio.currentTime = 0;
            isAudioUnlocked = true;
            updateAudioBadge(true);
        }).catch(err => {
            console.warn("Lỗi mở khoá âm thanh:", err);
            // Dù vậy vẫn thử bật cờ SpeechSynthesis
            isAudioUnlocked = true;
            updateAudioBadge(true);
        });
    }
}

// Cho phép click bất kỳ chỗ nào trên trang để tự động mở khoá âm thanh
document.addEventListener("click", () => {
    if (!isAudioUnlocked) {
        enableAudio();
    }
}, { once: true });

function updateAudioBadge(unlocked) {
    if (unlocked) {
        audioStatusBadge.className = "badge bg-success";
        audioStatusBadge.innerHTML = '<i class="fa-solid fa-volume-high me-1"></i> Loa cảnh báo: ĐÃ SẴN SÀNG';
    } else {
        audioStatusBadge.className = "badge bg-warning text-dark";
        audioStatusBadge.innerHTML = '<i class="fa-solid fa-volume-xmark me-1"></i> Bấm để bật âm thanh loa';
    }
}

// Khóa âm thanh toàn cục giữa các Tab trình duyệt trên cùng máy tính
function canPlayAudioGlobally() {
    const now = Date.now();
    const lastGlobalPlay = parseInt(localStorage.getItem("last_alert_played_time") || "0", 10);
    // Nếu bất kỳ tab nào đã phát trong vòng 5 giây qua -> KHÔNG phát thêm nữa
    if (now - lastGlobalPlay < 5000) {
        return false;
    }
    localStorage.setItem("last_alert_played_time", now.toString());
    return true;
}

// Hàm phát cảnh báo âm thanh duy nhất (Single Audio Player)
function playWarningSound() {
    // 1. Kiểm tra khóa chống trùng lặp giữa các Tab
    if (!canPlayAudioGlobally()) {
        console.log("[Audio] Bỏ qua vì âm thanh vừa mới phát trong vòng 5 giây qua.");
        return;
    }

    // 2. Nếu thẻ audio đang phát, tuyệt đối không được phát đè
    if (alertAudio && !alertAudio.paused) {
        console.log("[Audio] Audio đang phát dở, không phát đè.");
        return;
    }

    // 3. Chỉ phát DUY NHẤT 1 file MP3 tiếng Việt chuẩn
    if (alertAudio) {
        alertAudio.currentTime = 0;
        alertAudio.play().catch(err => {
            console.warn("[Audio] Trình duyệt chưa mở khóa âm thanh:", err);
        });
    }
}

// Hiển thị hiệu ứng báo động thị giác
function triggerAlarmVisuals() {
    if (alarmIndicator) {
        alarmIndicator.style.display = "block";
        setTimeout(() => {
            alarmIndicator.style.display = "none";
        }, 3500);
    }
}

// Cập nhật nhanh ô input nguồn camera
function setCamInput(val) {
    document.getElementById("cameraSourceInput").value = val;
}

// Bật hoặc tắt camera
async function toggleCameraPower() {
    try {
        const res = await fetch("/api/toggle_camera", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ enabled: !isCameraOn })
        });
        const data = await res.json();
        if (data.success) {
            updateCameraBtnUI(data.camera_enabled);
            // Làm mới luồng video feed để nhận ngay frame chờ tắt camera
            const videoElem = document.getElementById("videoFeed");
            videoElem.src = "/video_feed?t=" + new Date().getTime();
        }
    } catch (e) {
        alert("Lỗi thao tác Camera: " + e.message);
    }
}

function updateCameraBtnUI(enabled) {
    isCameraOn = enabled;
    const btn = document.getElementById("cameraToggleBtn");
    if (!btn) return;
    if (enabled) {
        btn.className = "btn btn-sm btn-outline-danger";
        btn.innerHTML = '<i class="fa-solid fa-video-slash me-1"></i> Tắt Camera';
        btn.title = "Tắt Camera khi không dùng để tiết kiệm tài nguyên và bảo mật";
    } else {
        btn.className = "btn btn-sm btn-success";
        btn.innerHTML = '<i class="fa-solid fa-video me-1"></i> Bật Camera';
        btn.title = "Bật Camera để tiếp tục giám sát an toàn lao động";
    }
}

// Chuyển đổi nguồn camera
async function updateCameraSource() {
    const inputVal = document.getElementById("cameraSourceInput").value.trim();
    if (!inputVal) return;

    try {
        const res = await fetch("/api/update_camera", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ source: inputVal })
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById("cameraSourceInput").value = data.source;
            document.getElementById("currentCameraSourceBadge").innerText = "Nguồn: " + data.source;
            // Làm mới luồng video feed
            const videoElem = document.getElementById("videoFeed");
            videoElem.src = "/video_feed?t=" + new Date().getTime();
        }
    } catch (e) {
        alert("Lỗi kết nối camera: " + e.message);
    }
}

// Lưu cài đặt Roboflow
async function saveSettings() {
    const apiKey = document.getElementById("modalApiKey").value.trim();
    const projectId = document.getElementById("modalProjectId").value.trim();
    const version = document.getElementById("modalVersion").value.trim();
    const confidence = document.getElementById("modalConfidence").value;
    const cooldown = document.getElementById("modalCooldown").value;

    try {
        const res = await fetch("/api/update_settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                api_key: apiKey,
                project_id: projectId,
                version: version,
                confidence: confidence,
                cooldown: cooldown
            })
        });
        const data = await res.json();
        if (data.success) {
            const modalEl = document.getElementById("settingsModal");
            const modalInstance = bootstrap.Modal.getInstance(modalEl);
            if (modalInstance) modalInstance.hide();
            alert("Đã cập nhật cài đặt thành công!");
        }
    } catch (e) {
        alert("Lỗi lưu cấu hình: " + e.message);
    }
}

// Thử chuông cảnh báo thủ công
async function triggerTestAlert() {
    enableAudio();
    playWarningSound();
    triggerAlarmVisuals();
    try {
        await fetch("/api/test_alert", { method: "POST" });
        loadHistory();
    } catch (e) {
        console.error(e);
    }
}

// Tải lịch sử vi phạm gần đây
async function loadHistory() {
    try {
        const res = await fetch("/api/history");
        const list = await res.json();
        const historyContainer = document.getElementById("historyList");
        const countBadge = document.getElementById("logCountBadge");

        if (countBadge) countBadge.innerText = list.length;

        if (list.length === 0) {
            historyContainer.innerHTML = `
                <div class="text-center text-secondary py-4 small" id="noHistoryText">
                    <i class="fa-solid fa-circle-check text-success fs-3 d-block mb-2"></i>
                    Chưa ghi nhận vi phạm nào. Mọi người đều chấp hành tốt!
                </div>
            `;
            return;
        }

        let html = "";
        list.slice(0, 20).forEach(item => {
            html += `
                <div class="history-item">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="badge bg-danger small"><i class="fa-solid fa-triangle-exclamation me-1"></i> VI PHẠM</span>
                        <span class="text-secondary small">${item.timestamp}</span>
                    </div>
                    <div class="text-white small fw-bold">${item.details}</div>
                    ${item.snapshot ? `
                        <div class="mt-2">
                            <a href="/static/violations/${item.snapshot}" target="_blank">
                                <img src="/static/violations/${item.snapshot}" style="height: 50px; border-radius: 4px; border: 1px solid #444;" alt="Evidence">
                            </a>
                        </div>
                    ` : ''}
                </div>
            `;
        });
        historyContainer.innerHTML = html;
    } catch (e) {
        console.error("Lỗi load history:", e);
    }
}

// Chu kỳ cập nhật trạng thái hệ thống (Polling mỗi 400ms)
async function pollStatus() {
    try {
        const res = await fetch("/api/status");
        if (!res.ok) return;
        const data = await res.json();

        // 1. Cập nhật các thẻ số liệu
        document.getElementById("statSafeCount").innerText = data.total_safe;
        document.getElementById("statViolationCount").innerText = data.total_violations;
        document.getElementById("statFps").innerText = data.fps.toFixed(1);
        document.getElementById("statLatency").innerText = data.api_latency_ms + " ms";

        // Đồng bộ trạng thái nút Bật/Tắt camera
        if (data.camera_enabled !== undefined && data.camera_enabled !== isCameraOn) {
            updateCameraBtnUI(data.camera_enabled);
        }

        // 2. Cập nhật Badge Trạng Thái
        const statusBadge = document.getElementById("systemStatusBadge");
        if (!data.camera_enabled) {
            statusBadge.className = "badge bg-secondary";
            statusBadge.innerHTML = '<i class="fa-solid fa-power-off me-1"></i> Camera đang TẮT';
        } else if (!data.is_configured) {
            statusBadge.className = "badge bg-warning text-dark";
            statusBadge.innerHTML = '<i class="fa-solid fa-key me-1"></i> Cần nhập Roboflow API Key';
        } else if (data.has_violation) {
            statusBadge.className = "badge bg-danger";
            statusBadge.innerHTML = '<i class="fa-solid fa-bell fa-shake me-1"></i> ĐANG CÓ VI PHẠM!';
        } else if (data.is_connected) {
            statusBadge.className = "badge bg-success";
            statusBadge.innerHTML = '<i class="fa-solid fa-circle-check me-1"></i> An toàn - Đang giám sát';
        } else {
            statusBadge.className = "badge bg-secondary";
            statusBadge.innerHTML = '<i class="fa-solid fa-video-slash me-1"></i> ' + data.status_message;
        }

        // 3. Thông báo lỗi API (nếu có)
        const errorBanner = document.getElementById("apiErrorBanner");
        if (data.api_error) {
            errorBanner.classList.remove("d-none");
            document.getElementById("apiErrorText").innerText = data.api_error;
        } else {
            errorBanner.classList.add("d-none");
        }

        // 4. Kiểm tra xem Server có yêu cầu phát âm thanh cảnh báo không
        if (data.should_play_alert) {
            playWarningSound();
            triggerAlarmVisuals();
            loadHistory();
        }

    } catch (e) {
        console.warn("Polling error:", e);
    }
}

// Bắt đầu chu kỳ polling
setInterval(pollStatus, 400);
loadHistory();

