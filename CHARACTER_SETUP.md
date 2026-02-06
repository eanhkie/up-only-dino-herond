# Hướng dẫn thay đổi nhân vật sang khủng long

Game đã được cấu hình để sử dụng nhân vật khủng long (T-Rex). 

## Các bước để thay thế texture:

1. **Chuẩn bị texture khủng long:**
   - Bạn cần có các file ảnh khủng long cho các trạng thái:
     - `trex_idle` - Khủng long đứng yên
     - `trex_shooting` - Khủng long bắn
     - `trex_jetpack` - Khủng long với jetpack
     - `trex_spring_shoes` - Khủng long với giày nhảy
     - `trex_propeller_hat` - Khủng long với mũ cánh quạt

2. **Upload texture lên server/CDN:**
   - Upload các file ảnh lên server hoặc CDN của bạn
   - Lấy URL của từng file

3. **Cập nhật asset-pack.json:**
   - Mở file `public/assets/asset-pack.json`
   - Thay thế các URL trong phần "characters" cho các key:
     - `trex_idle` - URL của ảnh khủng long đứng yên
     - `trex_shooting` - URL của ảnh khủng long bắn
     - `trex_jetpack` - URL của ảnh khủng long với jetpack
     - `trex_spring_shoes` - URL của ảnh khủng long với giày nhảy
     - `trex_propeller_hat` - URL của ảnh khủng long với mũ cánh quạt

## Ví dụ:

```json
{
  "type": "image",
  "key": "trex_idle",
  "url": "https://your-cdn.com/images/trex_idle.png"
}
```

## Lưu ý:

- Kích thước texture nên tương tự texture cũ để game hoạt động tốt
- Các texture đã được điều chỉnh scale trong code để phù hợp với khủng long
- Collision box đã được điều chỉnh cho khủng long

## Test:

Sau khi cập nhật URL, chạy lại game để kiểm tra:
```bash
npm run dev
```
