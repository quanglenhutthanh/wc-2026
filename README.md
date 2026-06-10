# World Cup 2026 — Trung tâm giải đấu

Web theo dõi World Cup 2026 theo thời gian thực: lịch thi đấu, bảng xếp hạng, đội hình, vua phá lưới, tin tức và so sánh đội hình H2H.

## Tính năng

- Lịch thi đấu 104 trận (72 vòng bảng + 32 knockout)
- Bảng xếp hạng 12 bảng tự tính từ kết quả
- Trang đội tuyển với đội hình chính thức
- Vua phá lưới & kiến tạo
- So sánh đội hình H2H
- Tin tức giải đấu
- Đếm ngược đến trận gần nhất
- Hỗ trợ dark/light mode

## Cấu trúc

```
wc-2026/
├── index.html          # File deploy (build output)
├── app.js              # Logic JavaScript (source)
├── index.template.html # HTML + CSS template (source)
├── build.js            # Script build (ghép template + data + app.js)
├── vercel.json         # Cấu hình Vercel (tắt cache cho data/)
└── data/
    ├── matches.json    # Lịch thi đấu
    ├── teams.json      # Đội tuyển & đội hình
    ├── results.json    # Kết quả + vua phá lưới
    └── news.json       # Tin tức
```

## Cập nhật dữ liệu

### Kết quả trận đấu
Sửa `data/results.json`, thêm vào mục `results`:
```json
{
  "results": {
    "M01": { "hs": 2, "as": 1 }
  }
}
```
`hs` = bàn đội nhà, `as` = bàn đội khách. Mã trận xem trong `data/matches.json`.

### Vua phá lưới & kiến tạo
Dữ liệu được cập nhật tự động qua AI search, không cần nhập tay.

### Tin tức
Thêm vào đầu mảng trong `data/news.json`:
```json
{ "date": "2026-06-12", "tag": "Trận đấu", "title": "Tiêu đề", "body": "Nội dung..." }
```

## Deploy

Dự án là web tĩnh thuần (HTML/CSS/JS), deploy lên Vercel không cần bước build:

1. Push code lên GitHub
2. Import repo vào [Vercel](https://vercel.com/new)
3. Framework Preset: **Other**, để trống Build Command và Output Directory
4. Deploy — Vercel tự deploy lại mỗi khi có commit mới

Chi tiết xem [HUONG-DAN-DEPLOY.md](HUONG-DAN-DEPLOY.md).

## Build (khi sửa source)

```bash
node build.js
```

Lệnh này ghép `index.template.html` + `data/*.json` + `app.js` thành `index.html`.
