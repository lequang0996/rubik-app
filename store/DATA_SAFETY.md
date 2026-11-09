# Data safety (Google Play Console) – Cube All In One

Khai báo tại **Play Console → Policy and programs → App content → Data safety**.
Nội dung dưới đây khớp với `docs/privacy-policy.html` và bản app hiện tại (**có quảng cáo AdMob thử nghiệm: banner, mở app, xem có thưởng**; xem mục 5, phải làm trước khi phát hành).
Nếu sau này đổi cách gửi góp ý hoặc thêm bất kỳ SDK nào, phải sửa lại cả chính sách và mẫu khai báo này.

## 1. Thu thập và bảo mật dữ liệu

| Câu hỏi trong Play Console | Trả lời |
|---|---|
| Ứng dụng có thu thập hoặc chia sẻ bất kỳ loại dữ liệu người dùng bắt buộc nào không? | **Có** (chỉ khi người dùng chủ động gửi Góp ý) |
| Toàn bộ dữ liệu thu thập có được mã hoá khi truyền đi không? | **Có** (HTTPS tới Google Apps Script) |
| Có cung cấp cách để người dùng yêu cầu xoá dữ liệu không? | **Có**: yêu cầu qua email liên hệ ghi trong chính sách quyền riêng tư (mục "Your choices and deleting data") |

## 2. Các loại dữ liệu cần khai báo

Chỉ khai báo những mục sau, các mục còn lại chọn **không thu thập**.

| Nhóm → loại dữ liệu | Thu thập | Chia sẻ | Xử lý tạm thời | Bắt buộc hay tuỳ chọn | Mục đích |
|---|---|---|---|---|---|
| **App activity → Other user-generated content** (nội dung góp ý người dùng tự gõ) | Có | **Không** | Không | **Tuỳ chọn** (người dùng tự quyết định có gửi) | App functionality |
| **App activity → App interactions** (cấp độ người chơi gửi kèm góp ý) | Có | **Không** | Không | **Tuỳ chọn** (chỉ gửi cùng góp ý) | App functionality |

Ghi chú:
- **"Chia sẻ = Không"**: dữ liệu đi qua Google Apps Script do chính bạn vận hành và chỉ chuyển tiếp về hộp thư của bạn. Theo định nghĩa của Play, chuyển cho nhà cung cấp dịch vụ xử lý thay mặt nhà phát triển không tính là "chia sẻ".
- Ngôn ngữ ứng dụng và nền tảng (Android/web) gửi kèm là thông tin cấu hình, không thuộc nhóm "ID thiết bị". Nếu muốn khai báo gọn hơn nữa, có thể bỏ `level`, `language`, `platform` khỏi nội dung gửi trong `www/js/feedbackui.js`, khi đó chỉ còn khai báo mục đầu tiên.
- Không khai báo: vị trí, thông tin cá nhân (tên, email, số điện thoại…), tài chính, sức khoẻ, tin nhắn, ảnh/video, âm thanh, tệp, lịch, danh bạ, duyệt web, ID thiết bị, nhật ký sự cố.
- **Dữ liệu chỉ lưu trên máy** (ngôn ngữ, cấp độ, kỷ lục, thống kê thời gian, vị trí đang xem, giao diện/âm thanh) không được gửi đi nên **không phải khai báo**.
- Cập nhật trong ứng dụng do Google Play xử lý, app không gửi dữ liệu nên không khai báo.

## 3. Thực hành bảo mật

| Mục | Trả lời |
|---|---|
| Dữ liệu được mã hoá khi truyền đi | Có |
| Người dùng có thể yêu cầu xoá dữ liệu | Có |
| Tuân thủ chính sách Families của Play | Không (ứng dụng không nhắm tới trẻ em) |
| Đã qua đánh giá bảo mật độc lập | Không |

## 4. Các khai báo khác liên quan (App content)

| Mục | Trả lời |
|---|---|
| Privacy policy URL | Đường dẫn GitHub Pages của `docs/privacy-policy.html` |
| Ads | **Có** quảng cáo (AdMob) – xem mục 5 |
| App access | Không cần đăng nhập; tính năng mở khoá theo cấp độ dùng app, không cần hướng dẫn truy cập đặc biệt |
| Target audience | Không nhắm tới trẻ em |

## 5. Google AdMob (đã tích hợp ở chế độ thử nghiệm – làm các mục dưới trước khi phát hành)

- Thay ID thử nghiệm bằng ID thật: đặt biến môi trường / `-P` `ADMOB_APP_ID`, `ADMOB_BANNER_ID`, `ADMOB_APPOPEN_ID`, `ADMOB_REWARDED_ID` khi build (mặc định là ID thử nghiệm của Google).
- Không bấm quảng cáo thật của chính mình (vi phạm chính sách AdMob); dùng thiết bị thử nghiệm đã đăng ký.

- Data safety: thêm **Device or other IDs** (Advertising ID) và dữ liệu mà AdMob thu thập (thường gồm vị trí gần đúng, App interactions, Diagnostics), đánh dấu **chia sẻ = Có** với mục đích **Advertising or marketing**; kiểm tra danh sách SDK của AdMob phiên bản đang dùng.
- Ads: chuyển sang **Có quảng cáo**; khai báo quyền ID quảng cáo (Advertising ID).
- Chính sách quyền riêng tư: thêm mục quảng cáo và liên kết chính sách của Google; bỏ câu "không quảng cáo" trong README/mô tả.
- Triển khai hộp thoại đồng ý Google UMP cho người dùng EEA/Anh.
