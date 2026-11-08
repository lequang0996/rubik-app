/**
 * Cube All In One – nhận góp ý từ app và gửi email cho CHỦ TÀI KHOẢN GOOGLE triển khai script này.
 * Người nhận = tài khoản đã Deploy, nên không có địa chỉ email nào nằm trong app hay trong mã nguồn.
 *
 * CÁCH TRIỂN KHAI (làm một lần, bằng đúng tài khoản Gmail muốn nhận góp ý):
 *  1. Mở https://script.google.com  →  Dự án mới  →  xoá mã mẫu, dán toàn bộ file này vào  →  Lưu.
 *  2. Triển khai (Deploy)  →  Tạo bản triển khai mới  →  loại "Ứng dụng web" (Web app):
 *       - Thực thi dưới tên: Tôi (Execute as: Me)
 *       - Ai có quyền truy cập: Bất kỳ ai (Anyone)
 *     Bấm Triển khai và cấp quyền gửi email khi được hỏi.
 *  3. Sao chép "URL ứng dụng web" (dạng https://script.google.com/macros/s/.../exec)
 *     và dán vào FEEDBACK_ENDPOINT trong www/js/config.js, rồi build lại app.
 *  4. Sau này sửa script: Triển khai → Quản lý bản triển khai → Chỉnh sửa → Phiên bản mới.
 *
 * Giới hạn: Gmail miễn phí gửi tối đa khoảng 100 email/ngày qua MailApp; script này còn tự giới hạn PER_HOUR thư/giờ.
 */
const MIN_LEN = 10;
const MAX_LEN = 2000;
const PER_HOUR = 30;   // tối đa số góp ý nhận mỗi giờ (chống spam)

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d._honey) return out({ ok: true });                       // bot điền ô ẩn → làm ngơ
    const msg = String(d.message || '').trim();
    if (msg.length < MIN_LEN || msg.length > MAX_LEN) return out({ ok: false, error: 'length' });

    const cache = CacheService.getScriptCache();
    const key = 'fb_' + Math.floor(Date.now() / 3600000);
    const n = Number(cache.get(key) || 0);
    if (n >= PER_HOUR) return out({ ok: false, error: 'rate' });
    cache.put(key, String(n + 1), 3700);

    const lang = clean(d.language, 12), level = Number(d.level) || 0, platform = clean(d.platform, 12);
    MailApp.sendEmail({
      to: Session.getEffectiveUser().getEmail(),
      name: 'Cube All In One',
      subject: '[Cube All In One] Feedback – Lv ' + level + ' · ' + lang,
      body: msg + '\n\n—\nLanguage: ' + lang + '\nLevel: ' + level + '\nPlatform: ' + platform + '\nTime: ' + new Date().toISOString(),
    });
    return out({ ok: true });
  } catch (err) {
    return out({ ok: false, error: 'server' });
  }
}

function doGet() { return out({ ok: true, service: 'cube-all-in-one-feedback' }); }   // mở URL trên trình duyệt để kiểm tra

function clean(x, n) { return String(x || '').replace(/[^\w\-.]/g, '').slice(0, n); }
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
