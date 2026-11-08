// Góp ý: app gửi nội dung tới một Google Apps Script (do bạn tự triển khai, xem tools/feedback-apps-script.gs).
// Script đó mới là nơi gửi email cho bạn, nên KHÔNG có địa chỉ email nào nằm trong app.
// Cách lấy URL: xem hướng dẫn ở đầu file tools/feedback-apps-script.gs rồi dán vào đây.
// Để trống = tính năng Góp ý sẽ báo lỗi khi bấm Gửi.
export const FEEDBACK_ENDPOINT = '';   // ví dụ: 'https://script.google.com/macros/s/AKfycb.../exec'
export const FEEDBACK_MIN = 10;          // số ký tự tối thiểu
export const FEEDBACK_MAX = 2000;        // số ký tự tối đa
export const FEEDBACK_COOLDOWN_MS = 60000;   // giãn cách giữa 2 lần gửi (chống spam)
