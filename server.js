const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cookieSession = require('cookie-session');
const { knex, init } = require('./db');

const app = express();
const isProd = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3000;

// Yönetici bilgileri ortam değişkenlerinden gelir, kod içinde şifre yoktur.
// Yalnızca geliştirme ortamında (bilgisayarında) varsayılan bir giriş kullanılır.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || (isProd ? '' : 'admin@example.com');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || (isProd ? '' : 'admin123');

const SITE = {
  name: 'Matematik Terapi Evi',
  phone: process.env.CONTACT_PHONE || '',
  email: process.env.CONTACT_EMAIL || '',
  city: process.env.CONTACT_CITY || '',
};

const STATUSES = { yeni: 'Yeni', gorusuldu: 'Görüşüldü', tamamlandi: 'Tamamlandı' };
const GRADES = ['İlkokul', 'Ortaokul', 'Lise', 'Üniversite', 'Yetişkin'];
const MODES = ['Yüz yüze', 'Online', 'Fark etmez'];

// ---------- Yardımcılar ----------
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const toDate = (v) => (v instanceof Date ? v : new Date(String(v).includes('T') ? v : String(v).replace(' ', 'T') + 'Z'));
const fmt = (v) => toDate(v).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' });
const fmtTime = (v) => toDate(v).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Istanbul' });
const parseId = (v) => (/^\d+$/.test(v) ? Number(v) : null);
const digest = (s) => crypto.createHash('sha256').update(String(s)).digest();
const safeEqual = (a, b) => crypto.timingSafeEqual(digest(a), digest(b));

// ---------- Ayarlar ----------
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1); // Render, HTTPS'i bir proxy üzerinden sağlar
app.disable('x-powered-by');
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(
  cookieSession({
    name: 'mte',
    keys: [process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex')],
    maxAge: 2 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
  })
);
if (!process.env.SESSION_SECRET) console.warn('Uyarı: SESSION_SECRET tanımlı değil, her yeniden başlatmada oturumlar sıfırlanır.');

app.use((req, res, next) => {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(16).toString('hex');
  Object.assign(res.locals, { csrf: req.session.csrf, site: SITE, isAdmin: !!req.session.admin, path: req.path, fmt, fmtTime, statuses: STATUSES, flash: null });
  if (req.session.flash) {
    res.locals.flash = req.session.flash;
    req.session.flash = null;
  }
  next();
});

// CSRF: tüm POST formlarında gizli bir anahtar kontrol edilir.
app.use((req, res, next) => {
  if (req.method === 'POST' && req.body._csrf !== req.session.csrf) {
    return res.status(403).render('error', { title: 'Oturum süresi doldu', message: 'Sayfayı yenileyip işlemi tekrar deneyin.' });
  }
  next();
});

// ---------- Herkese açık sayfalar ----------
app.get('/', wrap(async (req, res) => {
  const [services, posts] = await Promise.all([knex('services').orderBy('id'), knex('posts').orderBy('id', 'desc').limit(3)]);
  res.render('index', { title: 'Birebir matematik özel dersi', services, posts });
}));

app.get('/hakkimda', (req, res) => res.render('about', { title: 'Hakkımda' }));

app.get('/yazilar', wrap(async (req, res) => {
  res.render('posts', { title: 'Yazılar', posts: await knex('posts').orderBy('id', 'desc') });
}));

app.get('/yazilar/:id', wrap(async (req, res, next) => {
  const id = parseId(req.params.id);
  const post = id && (await knex('posts').where({ id }).first());
  if (!post) return next();
  res.render('post', { title: post.title, post });
}));

// ---------- Görüşme talebi formu ----------
function validateRequest(b) {
  const v = {
    name: (b.name || '').trim(),
    phone: (b.phone || '').trim(),
    email: (b.email || '').trim(),
    grade: b.grade || '',
    mode: b.mode || '',
    message: (b.message || '').trim(),
    kvkk: b.kvkk === 'on',
  };
  const e = {};
  if (v.name.length < 2 || v.name.length > 80) e.name = 'Adınızı ve soyadınızı yazın (en az 2 karakter).';
  if (!/^(\+90|0)?\d{10}$/.test(v.phone.replace(/[\s()-]/g, ''))) e.phone = 'Telefon numarasını 05XX XXX XX XX biçiminde yazın.';
  if (v.email && (v.email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email))) e.email = 'E-posta adresi geçerli görünmüyor.';
  if (!GRADES.includes(v.grade)) e.grade = 'Öğrencinin seviyesini seçin.';
  if (!MODES.includes(v.mode)) e.mode = 'Ders şeklini seçin.';
  if (v.message.length < 10 || v.message.length > 1000) e.message = 'Mesajınız 10 ile 1000 karakter arasında olmalı.';
  if (!v.kvkk) e.kvkk = 'Devam etmek için onay kutusunu işaretleyin.';
  return { v, e };
}

const renderRequest = (res, v = {}, e = {}) => res.status(Object.keys(e).length ? 400 : 200).render('request', { title: 'Görüşme talebi', v, e, GRADES, MODES });

app.get('/randevu', (req, res) => renderRequest(res));

app.post('/randevu', wrap(async (req, res) => {
  if (req.body.website) return res.redirect('/randevu/tesekkurler'); // gizli alan doluysa bu bir bottur
  const { v, e } = validateRequest(req.body);
  if (Object.keys(e).length) return renderRequest(res, v, e);
  await knex('requests').insert({ name: v.name, phone: v.phone, email: v.email || null, grade: v.grade, mode: v.mode, message: v.message });
  res.redirect('/randevu/tesekkurler');
}));

app.get('/randevu/tesekkurler', (req, res) => res.render('thanks', { title: 'Talebiniz alındı' }));

// ---------- Yönetici girişi ----------
const requireAdmin = (req, res, next) => (req.session.admin ? next() : res.redirect('/admin/giris'));
const attempts = new Map(); // IP başına başarısız deneme sayısı (kaba kuvvet koruması)

app.get('/admin/giris', (req, res) => res.render('admin/login', { title: 'Yönetici girişi', error: null }));

app.post('/admin/giris', (req, res) => {
  const a = attempts.get(req.ip) || { n: 0, t: Date.now() };
  if (Date.now() - a.t > 15 * 60 * 1000) Object.assign(a, { n: 0, t: Date.now() });
  const fail = (code, error) => res.status(code).render('admin/login', { title: 'Yönetici girişi', error });
  if (a.n >= 5) return fail(429, 'Çok fazla hatalı deneme yapıldı. 15 dakika sonra tekrar deneyin.');
  const ok = ADMIN_EMAIL && ADMIN_PASSWORD && safeEqual(req.body.email || '', ADMIN_EMAIL) && safeEqual(req.body.password || '', ADMIN_PASSWORD);
  if (!ok) {
    attempts.set(req.ip, { ...a, n: a.n + 1 });
    return fail(401, 'E-posta ya da şifre hatalı.');
  }
  attempts.delete(req.ip);
  req.session.admin = true;
  res.redirect('/admin');
});

app.post('/admin/cikis', (req, res) => {
  req.session = null;
  res.redirect('/');
});

// ---------- Yönetici: görüşme talepleri ----------
app.get('/admin', requireAdmin, wrap(async (req, res) => {
  const durum = STATUSES[req.query.durum] ? req.query.durum : '';
  const q = String(req.query.q || '').trim();
  const all = await knex('requests').orderBy('id', 'desc');
  const counts = { toplam: all.length, yeni: 0, gorusuldu: 0, tamamlandi: 0 };
  all.forEach((r) => counts[r.status]++);
  const needle = q.toLocaleLowerCase('tr');
  const rows = all.filter((r) => (!durum || r.status === durum) && (!needle || [r.name, r.phone, r.message].join(' ').toLocaleLowerCase('tr').includes(needle)));
  res.render('admin/dashboard', { title: 'Yönetim paneli', rows, counts, durum, q });
}));

app.post('/admin/talepler/:id/durum', requireAdmin, wrap(async (req, res, next) => {
  const id = parseId(req.params.id);
  if (!id || !STATUSES[req.body.status]) return next();
  await knex('requests').where({ id }).update({ status: req.body.status });
  req.session.flash = 'Talep durumu güncellendi.';
  res.redirect('/admin');
}));

app.post('/admin/talepler/:id/sil', requireAdmin, wrap(async (req, res, next) => {
  const id = parseId(req.params.id);
  if (!id) return next();
  await knex('requests').where({ id }).del();
  req.session.flash = 'Talep silindi.';
  res.redirect('/admin');
}));

// ---------- Yönetici: hizmetler ve yazılar (ekle, listele, düzenle, sil) ----------
const RESOURCES = {
  hizmetler: {
    table: 'services', label: 'Hizmet', plural: 'Hizmetler', order: ['id', 'asc'], cols: ['title', 'description'], heads: ['Başlık', 'Açıklama'],
    fields: [
      { name: 'title', label: 'Başlık', type: 'text', max: 80, required: true },
      { name: 'description', label: 'Açıklama', type: 'textarea', max: 500, required: true },
      { name: 'price_note', label: 'Ücret notu (isteğe bağlı)', type: 'text', max: 60 },
    ],
  },
  yazilar: {
    table: 'posts', label: 'Yazı', plural: 'Yazılar', order: ['id', 'desc'], cols: ['title', 'summary'], heads: ['Başlık', 'Özet'],
    fields: [
      { name: 'title', label: 'Başlık', type: 'text', max: 120, required: true },
      { name: 'summary', label: 'Kısa özet', type: 'text', max: 200, required: true },
      { name: 'body', label: 'Yazı metni (paragrafları boş satırla ayırın)', type: 'textarea', max: 6000, required: true },
    ],
  },
};

function validateFields(fields, body) {
  const values = {}, errors = {};
  for (const f of fields) {
    const val = String(body[f.name] || '').trim();
    values[f.name] = val;
    if (f.required && !val) errors[f.name] = `${f.label} boş bırakılamaz.`;
    else if (val.length > f.max) errors[f.name] = `${f.label} en fazla ${f.max} karakter olabilir.`;
  }
  return { values, errors };
}

function crudRouter(key) {
  const r = RESOURCES[key];
  const router = express.Router();
  const base = `/admin/${key}`;
  const form = (res, values, errors, id) => res.status(Object.keys(errors).length ? 400 : 200).render('admin/form', { title: id ? `${r.label} düzenle` : `${r.label} ekle`, r, key, values, errors, id });

  router.get('/', wrap(async (req, res) => {
    res.render('admin/list', { title: r.plural, r, key, rows: await knex(r.table).orderBy(...r.order) });
  }));
  router.get('/yeni', (req, res) => form(res, {}, {}, null));
  router.post('/', wrap(async (req, res) => {
    const { values, errors } = validateFields(r.fields, req.body);
    if (Object.keys(errors).length) return form(res, values, errors, null);
    await knex(r.table).insert(values);
    req.session.flash = `${r.label} eklendi.`;
    res.redirect(base);
  }));
  router.get('/:id/duzenle', wrap(async (req, res, next) => {
    const id = parseId(req.params.id);
    const row = id && (await knex(r.table).where({ id }).first());
    if (!row) return next();
    form(res, row, {}, id);
  }));
  router.post('/:id', wrap(async (req, res, next) => {
    const id = parseId(req.params.id);
    if (!id || !(await knex(r.table).where({ id }).first())) return next();
    const { values, errors } = validateFields(r.fields, req.body);
    if (Object.keys(errors).length) return form(res, values, errors, id);
    await knex(r.table).where({ id }).update(values);
    req.session.flash = `${r.label} güncellendi.`;
    res.redirect(base);
  }));
  router.post('/:id/sil', wrap(async (req, res, next) => {
    const id = parseId(req.params.id);
    if (!id) return next();
    await knex(r.table).where({ id }).del();
    req.session.flash = `${r.label} silindi.`;
    res.redirect(base);
  }));
  return router;
}

Object.keys(RESOURCES).forEach((key) => app.use(`/admin/${key}`, requireAdmin, crudRouter(key)));

// ---------- Hata sayfaları ----------
app.use((req, res) => res.status(404).render('error', { title: 'Sayfa bulunamadı', message: 'Aradığınız sayfa yok ya da taşınmış olabilir.' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', { title: 'Bir şeyler ters gitti', message: 'Birkaç dakika sonra tekrar deneyin.' });
});

init()
  .then(() => app.listen(PORT, () => console.log(`Site hazır: http://localhost:${PORT}`)))
  .catch((err) => {
    console.error('Veritabanı başlatılamadı:', err);
    process.exit(1);
  });
