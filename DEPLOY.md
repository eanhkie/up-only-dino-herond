# Hướng dẫn Deploy lên Vercel

## Tự động Deploy với Vercel

### Bước 1: Kết nối Repository với Vercel

1. Đăng nhập vào [Vercel](https://vercel.com)
2. Click **"Add New Project"**
3. Import Git repository của bạn (GitHub, GitLab, hoặc Bitbucket)
4. Vercel sẽ tự động detect project là Vite project

### Bước 2: Cấu hình Build Settings

Vercel sẽ tự động detect các settings sau từ `vercel.json`:
- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### Bước 3: Deploy

1. Click **"Deploy"**
2. Vercel sẽ tự động:
   - Install dependencies
   - Build project
   - Deploy lên production
3. Sau khi deploy xong, bạn sẽ nhận được URL production

### Bước 4: Auto Deploy

Sau khi kết nối repository, Vercel sẽ tự động:
- ✅ Deploy mỗi khi push code lên branch `main` hoặc `master`
- ✅ Tạo Preview Deployment cho mỗi Pull Request
- ✅ Tự động rebuild khi có thay đổi

## Cấu hình đã được thiết lập

File `vercel.json` đã được tạo với các cấu hình:
- ✅ Build command: `npm run build`
- ✅ Output directory: `dist`
- ✅ SPA routing: Tất cả routes đều redirect về `/index.html`
- ✅ Cache headers cho assets: Tối ưu performance

## Lưu ý

- Đảm bảo file `vercel.json` đã được commit và push lên repository
- Nếu có environment variables, thêm vào Vercel Dashboard > Settings > Environment Variables
- Production URL sẽ được tạo tự động sau lần deploy đầu tiên

## Troubleshooting

Nếu gặp lỗi build:
1. Kiểm tra logs trong Vercel Dashboard
2. Đảm bảo `package.json` có script `build`
3. Kiểm tra Node.js version (Vercel mặc định dùng Node 18.x)
