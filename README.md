# Rubik Studio – bản Android

Bản chuyển từ công cụ Python/PySide6 (`rubik_tool`) sang ứng dụng Android để đăng lên Google Play.
Giao diện + engine được viết lại bằng JavaScript thuần (Canvas 2D, không cần bundler), đóng gói bằng
[Capacitor 8](https://capacitorjs.com/). App chạy **hoàn toàn ngoại tuyến**.

## Đã chuyển những gì

| Tính năng bản gốc | Bản Android |
|---|---|
| 6 puzzle: 3x3, 2x2, 4x4, 5x5, Pyraminx, Skewb | ✅ giống hệt (engine được đối chiếu với Python, xem “Kiểm thử”) |
| Render 3D (painter, đổ bóng, bo góc sticker), animation xoay lớp | ✅ trùng pixel với bản Qt |
| Tab **Hướng dẫn**: cấp độ → danh mục → ca công thức, mô tả, tìm kiếm, phân trang 20 ca/trang, ảnh 3D & sơ đồ nhìn từ trên | ✅ |
| Phát công thức: ▶/⏸, từng bước tới/lui, về đầu, tốc độ, đánh dấu token hiện tại | ✅ |
| Tab **Luyện tập**: xáo bộ bài (không lặp tới khi hết vòng), ca trước/sau, ẩn công thức, đồng bộ với tab Hướng dẫn | ✅ |
| Tab **Chơi**: xáo trộn, bấm giờ, kỷ lục từng puzzle, hoàn tác/làm lại, phím ảo theo từng puzzle, kéo trên sticker để xoay lớp, kéo nền để xoay camera | ✅ |
| Chú giải màu (nút `?`), 8 ngôn ngữ (en, zh, es, pt, ru, ja, ko, vi) | ✅ |
| Cấp độ người chơi Lv 0–30 mở khoá Luyện tập/Chơi và các cấp nâng cao | ➕ tính năng mới của bản Android |
| Phím tắt bàn phím, Ctrl+Z / Ctrl+Y, Space, cuộn chuột để zoom | ✅ (khi có bàn phím/chuột) |

Thích ứng cho điện thoại: thanh chọn puzzle phía trên, thanh điều hướng 3 chế độ phía dưới, **chụm hai ngón để zoom**,
chạm phím để xem gợi ý thay cho tooltip chuột, nút Back của Android, bố cục dọc/ngang/máy tính bảng, tự chọn ngôn ngữ theo máy
ở lần mở đầu tiên. Megaminx và Square-1 **không** có trong bản này vì bản gốc cũng chưa đăng ký chúng trong `registry.py`.

## Hệ thống cấp độ người chơi (Lv 0–30)

* Mỗi giây **app đang mở (màn hình hiển thị)** được **+1 exp**. Đạt **Lv n** khi tổng exp ≥ 2^(n−1) (Lv 1 = 2⁰ = 1 exp … Lv 30 = 2²⁹).
* **Lv 10** (≈ 8 phút 32 giây): mở **Luyện tập** và **Chơi**.
* **Lv 15** (≈ 4 giờ 33 phút): mở cấp **Nâng cao** của mọi puzzle; riêng 3x3 là **Tối ưu** và **Nhánh Roux**.
* **Lv 20** (≈ 6 ngày 1 giờ): mở 3x3 **Thi đấu**.