#!/usr/bin/env node
/* ============================================================
   build.js — Ghép source thành index.html chạy được
   ------------------------------------------------------------
   Dùng: node src/build.js   (chạy từ thư mục gốc dự án)

   Quy trình:
     src/index.template.html  (khung HTML + CSS)
   + data/*.json              (dữ liệu, nhúng làm bản dự phòng offline)
   + src/app.js               (toàn bộ logic JavaScript)
   ─────────────────────────────────────────────
   = index.html               (file deploy, Vercel phục vụ file này)

   Lưu ý: index.html nhúng sẵn dữ liệu để chạy được cả khi mở offline.
   Khi deploy lên web, app vẫn ưu tiên đọc data/*.json mới nhất từ server
   (xem hàm fetchData trong src/app.js), nên cập nhật results.json là đủ.
   ============================================================ */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const p = (...a) => path.join(ROOT, ...a);

function read(f){ return fs.readFileSync(p(f), "utf8"); }

console.log("→ Đọc dữ liệu từ data/ ...");
const matches = read("data/matches.json");
const teams   = read("data/teams.json");
const news    = read("data/news.json");

// kiểm tra JSON hợp lệ trước khi nhúng
[["matches.json",matches],["teams.json",teams],["news.json",news]].forEach(([name,txt])=>{
  try{ JSON.parse(txt); }
  catch(e){ console.error("✗ LỖI: "+name+" không phải JSON hợp lệ:\n  "+e.message); process.exit(1); }
});

// tạo khối dữ liệu nhúng
const embed = `window.WC_MATCHES=${matches};\nwindow.WC_TEAMS=${teams};\nwindow.WC_NEWS=${news};\n`;

console.log("→ Đọc logic từ src/app.js ...");
const appLogic = read("src/app.js");

// ghép thành 1 khối <script> = dữ liệu nhúng + logic
const fullScript = "<script>\n" + embed + "\n" + appLogic + "\n</script>";

console.log("→ Ghép vào template ...");
let html = read("src/index.template.html");
if(!html.includes('<script src="app.js"></script>')){
  console.error('✗ LỖI: không tìm thấy <script src="app.js"></script> trong template');
  process.exit(1);
}
html = html.replace('<script src="app.js"></script>', fullScript);

fs.writeFileSync(p("index.html"), html);
const kb = (fs.statSync(p("index.html")).size/1024).toFixed(1);
console.log(`✓ Đã build index.html (${kb} KB)`);
console.log("  Mở thử bằng trình duyệt, hoặc deploy nguyên thư mục lên Vercel.");
