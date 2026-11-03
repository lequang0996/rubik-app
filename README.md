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
| Phím tắt bàn phím, Ctrl+Z / Ctrl+Y, Space, cuộn chuột để zoom | ✅ (khi có bàn phím/chuột) |

Thích ứng cho điện thoại: thanh chọn puzzle phía trên, thanh điều hướng 3 chế độ phía dưới, **chụm hai ngón để zoom**,
chạm phím để xem gợi ý thay cho tooltip chuột, nút Back của Android, bố cục dọc/ngang/máy tính bảng, tự chọn ngôn ngữ theo máy
ở lần mở đầu tiên. Megaminx và Square-1 **không** có trong bản này vì bản gốc cũng chưa đăng ký chúng trong `registry.py`.

## Cấu trúc

```
www/                  # toàn bộ app web (index.html, css/, js/, data/algs/*.json, locales/*.json)
  js/                 # geometry, puzzle, cubes, pyraminx, skewb, scramble (engine)
                      # render3d, viewport, diagrams (vẽ), guide/practice/play/components/main (giao diện)
android/              # dự án Android Studio do Capacitor sinh (đã cấu hình ký + icon + splash)
tools/                # gen_golden.py, test_engine.mjs, set_app_id.py, make_assets.py
store/                # icon 512, feature graphic 1024x500, ảnh chụp màn hình cho Play Console
docs/privacy-policy.html
.github/workflows/android.yml
```

## Chạy thử trên máy tính

```bash
cd www && python3 -m http.server 8000     # mở http://localhost:8000 (nên bật chế độ giả lập điện thoại trong DevTools)
npm ci && npm test                         # kiểm thử engine
```

## Bước 1 – Đổi ID gói (làm TRƯỚC khi đăng, không đổi được về sau)

Mặc định là `com.rubikstudio.app`. Hãy đổi sang ID riêng của bạn (ví dụ `com.tenban.rubikstudio`):

```bash
python3 tools/set_app_id.py com.tenban.rubikstudio
```

## Bước 2 – Tạo khoá ký (upload key), chỉ làm một lần

```bash
keytool -genkeypair -v -storetype PKCS12 -keystore upload.jks -alias upload \
        -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 upload.jks > upload.jks.b64        # macOS: base64 -i upload.jks
```

**Giữ file `upload.jks` và mật khẩu ở nơi an toàn, KHÔNG commit lên GitHub** (`.gitignore` đã chặn `*.jks`).
Khi đăng, hãy dùng Play App Signing (mặc định) – Google giữ khoá ký chính, bạn chỉ giữ khoá upload.

## Bước 3 – Đẩy lên GitHub và cấu hình bí mật

```bash
git init && git add . && git commit -m "Rubik Studio Android"
git branch -M main && git remote add origin https://github.com/<ban>/<repo>.git && git push -u origin main
```

Vào **Settings → Secrets and variables → Actions → New repository secret**, thêm 4 secret:

| Secret | Giá trị |
|---|---|
| `KEYSTORE_BASE64` | nội dung file `upload.jks.b64` |
| `KEYSTORE_PASSWORD` | mật khẩu keystore |
| `KEY_ALIAS` | `upload` |
| `KEY_PASSWORD` | mật khẩu khoá |

(tuỳ chọn) **Variables → `VERSION_NAME`** = `1.0` – tên phiên bản hiển thị. `versionCode` tự lấy từ số lần chạy workflow
(`github.run_number`) nên luôn tăng dần, đúng yêu cầu của Google Play.

## Bước 4 – Build

Mỗi lần push lên `main` (hoặc **Actions → Android → Run workflow**) sẽ:
1. chạy `npm test` (đối chiếu engine JS với dữ liệu sinh từ Python),
2. build **APK debug** → artifact `rubik-studio-debug-apk` (cài thử lên điện thoại),
3. nếu đã có secret keystore: build **AAB release đã ký** → artifact `rubik-studio-release-aab` (file này tải lên Play).

> Workflow chưa được chạy thử trong môi trường soạn thảo (không có Android SDK/Gradle ở đó). Nếu lần chạy đầu báo lỗi,
> hãy gửi log cho người hỗ trợ bạn; các lỗi thường gặp chỉ là phiên bản Gradle/SDK.

Build cục bộ (cần JDK 21 + Android SDK): `npm run build:debug` hoặc `npm run build:release`
(đặt các biến môi trường `KEYSTORE_FILE`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`).

## Bước 5 – Đăng lên Google Play (kiểm tra lại các yêu cầu mới nhất trên Play Console)

1. Tài khoản nhà phát triển Google Play (phí đăng ký một lần 25 USD, cần xác minh danh tính).
2. **Tạo ứng dụng** → tải AAB lên **Kiểm thử nội bộ** để thử trước.
3. **Target API**: app đã nhắm API 36 (Android 16) – đáp ứng yêu cầu bắt buộc từ 31/8/2026.
4. **Tài khoản cá nhân tạo mới**: phải chạy *closed testing* với tối thiểu **12 người thử, liên tục 14 ngày** rồi mới xin được bản Production.
5. **Nội dung ứng dụng (App content)**:
   - *Chính sách quyền riêng tư*: điền ngày + email vào `docs/privacy-policy.html`, bật **Settings → Pages** (nguồn: thư mục `/docs`) trên GitHub
     rồi dán đường dẫn `https://<ban>.github.io/<repo>/privacy-policy.html`.
   - *Data safety*: chọn “không thu thập / không chia sẻ dữ liệu”. App không có quảng cáo, không SDK thu thập dữ liệu.
   - *Xếp hạng nội dung*, *đối tượng mục tiêu* (khuyên chọn 13+ hoặc mọi lứa tuổi – đọc kỹ chính sách Families nếu có trẻ em), *Ads*: chọn “Không có quảng cáo”.
6. **Store listing**: dùng `store/icon-512.png`, `store/feature-graphic-1024x500.png` và ảnh trong `store/screenshots/`
   (ảnh điện thoại 1082×2048 đạt tỷ lệ ≤ 2:1; `tablet-vi.png` dùng cho mục máy tính bảng).

## Cập nhật phiên bản sau này

Sửa mã trong `www/`, commit, push → tải AAB mới từ artifact → tạo bản phát hành mới trên Play Console.
Sau khi sửa dữ liệu/engine Python gốc, chạy lại `python3 tools/gen_golden.py <thư_mục_rubik_tool> tools/golden.json`
rồi `npm test` để đảm bảo bản JS vẫn khớp.

## Kiểm thử

* `npm test`: 6101 kiểm tra – hình học (số mảnh/đỉnh/mặt/sticker, tọa độ, màu) và trạng thái sau **mọi** công thức trong dữ liệu
  (3x3: 5749, 2x2: 150, 4x4: 59, 5x5: 80, Pyraminx: 21, Skewb: 30), `invertAlg`, trạng thái đã giải, trộn + hoàn tác.
* Ảnh 3D được so với bản Qt: sai lệch trung bình < 0,2/255 mỗi pixel.
* Giao diện: kiểm thử tự động bằng Chromium (chọn ca → phát → khối về trạng thái đã giải, luyện tập, chơi + kéo xoay lớp, đổi ngôn ngữ…).
