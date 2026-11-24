// Uygulamanın giriş noktası: sunucuyu burada kuruyoruz.
const express = require("express");
const path = require("path");

const app = express();

// Render, çalışacağı portu PORT ortam değişkeniyle verir.
// Bilgisayarında bu değişken yoksa 3000 kullanılır.
const PORT = process.env.PORT || 3000;

// EJS: HTML şablonlarına sunucudan veri basmamızı sağlar (views klasörü).
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// public klasöründeki CSS, görsel, JS dosyaları doğrudan erişilebilir olur.
app.use(express.static(path.join(__dirname, "public")));

// Form verilerini okumak için (yarın CRUD formlarında lazım olacak).
app.use(express.urlencoded({ extended: true }));

// Şimdilik sabit bir veri; yarın brief'e göre veritabanından gelecek.
const site = {
  title: "Özel Ders",
  tagline: "Birebir, kişiye özel ders programı",
};

// Ana sayfa
app.get("/", (req, res) => {
  res.render("index", { site });
});

// Sunucunun ayakta olup olmadığını kontrol etmek için.
app.get("/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Sunucu çalışıyor: http://localhost:${PORT}`);
});
