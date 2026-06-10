# Hướng dẫn deploy & cập nhật — World Cup 2026

Cách làm: đẩy code lên **GitHub** → nối với **Vercel** → mỗi lần sửa file trên github.com là Vercel **tự động deploy lại**. Không cần cài gì trên máy.

---

## PHẦN 1 — Setup một lần (~10 phút)

### Bước 1: Tạo tài khoản (nếu chưa có)
- GitHub: https://github.com/signup
- Vercel: https://vercel.com/signup → chọn **"Continue with GitHub"** (đăng nhập bằng chính tài khoản GitHub cho tiện)

### Bước 2: Tạo repository và upload code
1. Vào https://github.com/new
2. Đặt **Repository name**: `world-cup-2026` (hoặc tên bạn thích)
3. Chọn **Public** (Vercel free deploy được cả Private, nhưng Public đơn giản hơn)
4. Bấm **Create repository**
5. Ở trang repo vừa tạo, bấm dòng chữ **"uploading an existing file"**
6. Kéo-thả **toàn bộ nội dung** thư mục `wc2026` vào (gồm `index.html`, `vercel.json`, thư mục `data/`, thư mục `src/`)
   - Lưu ý: kéo các **file và thư mục bên trong**, không phải kéo cả folder `wc2026` (để index.html nằm ở gốc repo)
7. Bấm **Commit changes**

### Bước 3: Nối Vercel với repo
1. Vào https://vercel.com/new
2. Mục **Import Git Repository** → chọn repo `world-cup-2026` vừa tạo → bấm **Import**
3. Màn hình cấu hình:
   - **Framework Preset**: chọn **Other**
   - **Build Command**: để TRỐNG
   - **Output Directory**: để TRỐNG (hoặc gõ dấu chấm `.`)
   - **Install Command**: để TRỐNG
4. Bấm **Deploy**
5. Đợi ~30 giây → Vercel cho bạn URL dạng `world-cup-2026.vercel.app`. Xong!

> Quan trọng: app là web tĩnh thuần (chỉ HTML), KHÔNG có bước build. Nếu Vercel cố nhận diện là dự án Node, cứ để trống hết các ô build là được.

---

## PHẦN 2 — Cập nhật về sau (mỗi khi có kết quả/tin tức)

Tất cả làm ngay trên **github.com**, không cần máy tính cài gì. Sau khi Commit, Vercel **tự deploy lại sau ~30 giây**.

### A) Cập nhật KẾT QUẢ trận đấu

1. Trên GitHub, vào repo → mở `data/` → bấm vào file **`results.json`**
2. Bấm biểu tượng **bút chì** (Edit this file) ở góc phải
3. Điền tỉ số vào mục `results` theo mã trận (xem **bảng tra mã trận** bên dưới):
   ```json
   {
     "results": {
       "M01": { "hs": 2, "as": 1 },
       "M07": { "hs": 0, "as": 0 }
     },
     "scorers": [
       { "name": "Lionel Messi", "team": "ARG", "goals": 3, "assists": 1 }
     ],
     "squads": {}
   }
   ```
   - `hs` = bàn thắng đội nhà, `as` = bàn thắng đội khách
   - Bảng xếp hạng **tự tính lại** từ các tỉ số này
4. Kéo xuống cuối, bấm **Commit changes**
5. Xong — đợi ~30 giây, web cập nhật cho tất cả mọi người

### B) Cập nhật VUA PHÁ LƯỚI / KIẾN TẠO
Cũng trong `results.json`, thêm vào mục `scorers`:
```json
"scorers": [
  { "name": "Tên cầu thủ", "team": "ARG", "goals": 5, "assists": 2 }
]
```
(mã đội: ARG, BRA, FRA, ENG... xem trong teams.json)

### C) Cập nhật ĐỘI HÌNH khi đội công bố chính thức
Sửa trực tiếp file `data/teams.json` trên GitHub: tìm mã đội, sửa phần `squad`, đặt `"official": true`. Hoặc nhờ Claude cập nhật giúp trong phiên chat rồi dán nội dung mới vào.

### D) Thêm TIN TỨC
Sửa `data/news.json`, thêm vào đầu mảng `news`:
```json
{ "date": "2026-06-12", "tag": "Trận đấu", "title": "Tiêu đề", "body": "Nội dung..." }
```

---

## Lưu ý quan trọng

- **Người xem chỉ xem, không sửa được dữ liệu chung.** Chỉ bạn (người sửa file trên GitHub) mới cập nhật được. Nếu người xem tự nhập tỉ số trên web, nó chỉ lưu tạm trên máy họ, không ảnh hưởng ai khác.
- **Sửa xong không thấy đổi?** Đợi ~30 giây cho Vercel deploy xong, rồi tải lại trang (kéo refresh). File cấu hình đã tắt cache cho thư mục `data/` nên thường thấy ngay.
- **Định dạng JSON phải đúng.** Thiếu dấu phẩy hay ngoặc sẽ làm app lỗi. GitHub có tô màu cú pháp giúp bạn nhận ra. Nếu lỡ sai, chỉ cần sửa lại file và Commit tiếp.
- **Nếu sửa code (giao diện/logic):** sửa trong `src/`, rồi chạy `node src/build.js` để tạo lại `index.html`, sau đó upload `index.html` mới. (Việc này cần máy có Node — hoặc nhờ Claude build giúp.)

---

## BẢNG TRA MÃ TRẬN (vòng bảng)

Dùng mã này khi điền kết quả vào `results.json`.

**Bảng A**

| Mã | Trận | Ngày |
|---|---|---|
| `M01` | Mexico vs Nam Phi | 12/06 |
| `M02` | Hàn Quốc vs Czechia | 12/06 |
| `M25` | Czechia vs Nam Phi | 18/06 |
| `M28` | Mexico vs Hàn Quốc | 19/06 |
| `M51` | Czechia vs Mexico | 25/06 |
| `M52` | Nam Phi vs Hàn Quốc | 25/06 |

**Bảng B**

| Mã | Trận | Ngày |
|---|---|---|
| `M03` | Canada vs Bosnia & Herzegovina | 13/06 |
| `M06` | Qatar vs Thụy Sĩ | 14/06 |
| `M26` | Thụy Sĩ vs Bosnia & Herzegovina | 19/06 |
| `M27` | Canada vs Qatar | 19/06 |
| `M49` | Thụy Sĩ vs Canada | 25/06 |
| `M50` | Bosnia & Herzegovina vs Qatar | 25/06 |

**Bảng C**

| Mã | Trận | Ngày |
|---|---|---|
| `M07` | Brazil vs Morocco | 14/06 |
| `M08` | Haiti vs Scotland | 14/06 |
| `M30` | Scotland vs Morocco | 20/06 |
| `M31` | Brazil vs Haiti | 20/06 |
| `M53` | Scotland vs Brazil | 26/06 |
| `M54` | Morocco vs Haiti | 26/06 |

**Bảng D**

| Mã | Trận | Ngày |
|---|---|---|
| `M04` | Hoa Kỳ vs Paraguay | 13/06 |
| `M05` | Úc vs Thổ Nhĩ Kỳ | 13/06 |
| `M29` | Hoa Kỳ vs Úc | 20/06 |
| `M32` | Thổ Nhĩ Kỳ vs Paraguay | 20/06 |
| `M55` | Thổ Nhĩ Kỳ vs Hoa Kỳ | 26/06 |
| `M56` | Paraguay vs Úc | 26/06 |

**Bảng E**

| Mã | Trận | Ngày |
|---|---|---|
| `M09` | Đức vs Curaçao | 15/06 |
| `M11` | Bờ Biển Ngà vs Ecuador | 15/06 |
| `M34` | Đức vs Bờ Biển Ngà | 21/06 |
| `M35` | Ecuador vs Curaçao | 21/06 |
| `M57` | Curaçao vs Bờ Biển Ngà | 26/06 |
| `M58` | Ecuador vs Đức | 26/06 |

**Bảng F**

| Mã | Trận | Ngày |
|---|---|---|
| `M10` | Hà Lan vs Nhật Bản | 15/06 |
| `M12` | Thụy Điển vs Tunisia | 15/06 |
| `M33` | Hà Lan vs Thụy Điển | 21/06 |
| `M36` | Tunisia vs Nhật Bản | 21/06 |
| `M59` | Nhật Bản vs Thụy Điển | 26/06 |
| `M60` | Tunisia vs Hà Lan | 26/06 |

**Bảng G**

| Mã | Trận | Ngày |
|---|---|---|
| `M14` | Bỉ vs Ai Cập | 16/06 |
| `M16` | Iran vs New Zealand | 16/06 |
| `M38` | Bỉ vs Iran | 22/06 |
| `M40` | New Zealand vs Ai Cập | 22/06 |
| `M65` | Ai Cập vs Iran | 27/06 |
| `M66` | New Zealand vs Bỉ | 27/06 |

**Bảng H**

| Mã | Trận | Ngày |
|---|---|---|
| `M13` | Tây Ban Nha vs Cape Verde | 15/06 |
| `M15` | Saudi Arabia vs Uruguay | 16/06 |
| `M37` | Tây Ban Nha vs Saudi Arabia | 21/06 |
| `M39` | Uruguay vs Cape Verde | 22/06 |
| `M63` | Cape Verde vs Saudi Arabia | 27/06 |
| `M64` | Uruguay vs Tây Ban Nha | 27/06 |

**Bảng I**

| Mã | Trận | Ngày |
|---|---|---|
| `M17` | Pháp vs Senegal | 17/06 |
| `M18` | Iraq vs Na Uy | 17/06 |
| `M41` | Pháp vs Iraq | 23/06 |
| `M42` | Na Uy vs Senegal | 23/06 |
| `M61` | Na Uy vs Pháp | 27/06 |
| `M62` | Senegal vs Iraq | 27/06 |

**Bảng J**

| Mã | Trận | Ngày |
|---|---|---|
| `M19` | Argentina vs Algeria | 17/06 |
| `M20` | Áo vs Jordan | 17/06 |
| `M43` | Argentina vs Áo | 23/06 |
| `M44` | Jordan vs Algeria | 23/06 |
| `M71` | Jordan vs Argentina | 28/06 |
| `M72` | Algeria vs Áo | 28/06 |

**Bảng K**

| Mã | Trận | Ngày |
|---|---|---|
| `M21` | Bồ Đào Nha vs DR Congo | 18/06 |
| `M24` | Uzbekistan vs Colombia | 18/06 |
| `M45` | Bồ Đào Nha vs Uzbekistan | 24/06 |
| `M48` | Colombia vs DR Congo | 24/06 |
| `M69` | Colombia vs Bồ Đào Nha | 28/06 |
| `M70` | DR Congo vs Uzbekistan | 28/06 |

**Bảng L**

| Mã | Trận | Ngày |
|---|---|---|
| `M22` | Anh vs Croatia | 18/06 |
| `M23` | Ghana vs Panama | 18/06 |
| `M46` | Anh vs Ghana | 24/06 |
| `M47` | Panama vs Croatia | 24/06 |
| `M67` | Panama vs Anh | 28/06 |
| `M68` | Croatia vs Ghana | 28/06 |

> Các trận vòng knock-out (1/16 trở đi) có mã R32-x, R16-x, QF-x, SF-x, FINAL — xem trong `data/matches.json`. Đội của các trận này phụ thuộc kết quả vòng bảng nên điền sau.
