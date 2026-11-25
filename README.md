# Matematik Terapi Evi

Psikoloji eğitimi almış bir matematik özel öğretmeni için hazırlanmış web sitesi.
Teknoloji: Node.js, Express, EJS, Knex (Render'da PostgreSQL, bilgisayarda SQLite).

## Bilgisayarda çalıştırma

```
npm install
npm start
```

Site `http://localhost:3000` adresinde açılır. Yönetim paneli: `/admin/giris`
(yalnızca geliştirme ortamında varsayılan giriş: `admin@example.com` / `admin123`).
Veriler `data.sqlite` dosyasında tutulur, dosya GitHub'a gönderilmez.

## Render'da yayınlama

1. Kodu GitHub'a gönderin (`.env` ve `*.sqlite` dosyaları `.gitignore` ile dışarıda kalır).
2. Render'da bir **PostgreSQL** veritabanı oluşturun, **Internal Database URL** değerini kopyalayın.
3. Web servisinde **Build Command:** `npm install`, **Start Command:** `npm start`.
4. Servisin **Environment** bölümüne şu değişkenleri girin:

| Değişken | Açıklama |
|---|---|
| `DATABASE_URL` | Render PostgreSQL bağlantı adresi |
| `SESSION_SECRET` | Uzun, rastgele bir metin |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Yönetim paneli girişi. Production'da varsayılan şifre yoktur, bunlar girilmezse panele girilemez |
| `CONTACT_PHONE`, `CONTACT_EMAIL`, `CONTACT_CITY` | İsteğe bağlı, sitenin alt bilgisinde görünür |

Veritabanı tabloları ve örnek içerik ilk açılışta otomatik oluşturulur.
Bağlantı SSL hatası verirse `DB_SSL=false` değişkenini ekleyin.

## Sayfalar

- Herkese açık: `/` (ana sayfa), `/hakkimda`, `/yazilar`, `/yazilar/:id`, `/randevu` (görüşme talebi formu)
- Yönetim: `/admin` (görüşme talepleri: filtrele, durum güncelle, sil), `/admin/hizmetler` ve `/admin/yazilar` (ekle, listele, düzenle, sil)

## Dosya yapısı

- `server.js`: rotalar, form doğrulama, giriş ve CSRF koruması
- `db.js`: veritabanı bağlantısı, tablolar ve örnek içerik
- `views/`: EJS şablonları (`partials/` ortak üst ve alt bölüm, `admin/` yönetim sayfaları)
- `public/style.css`: tüm tasarım (renkler en üstteki `:root` bölümünde)

## Teslimden önce yapılacaklar

- Hizmet ve yazı metinleri örnektir. Gerçek müşterinin bilgileriyle değiştirin: hizmetleri ve yazıları panelden, `views/about.ejs` içindeki "Hakkımda" metnini kod üzerinden.
- Sitedeki metinlerde klinik terapi hizmeti verildiği izlenimi yaratılmamalıdır. "Psikoloji eğitimi almış" ifadesinin müşteriyle uyumlu olduğunu doğrulayın.
- Brief kanıtını (e-posta, imzalı brief ya da görüşme notu) sunuma ekleyin.
