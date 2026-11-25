// Veritabanı bağlantısı: Render'da DATABASE_URL (PostgreSQL), bilgisayarında SQLite dosyası.
const config = process.env.DATABASE_URL
  ? {
      client: 'pg',
      connection: {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
      },
    }
  : {
      client: 'better-sqlite3',
      connection: { filename: process.env.SQLITE_FILE || './data.sqlite' },
      useNullAsDefault: true,
    };

const knex = require('knex')(config);

const SERVICES = [
  ['Birebir Özel Ders', 'Öğrencinin seviyesine ve okul müfredatına göre hazırlanan tek kişilik matematik dersleri. Konu anlatımı, soru çözümü ve tekrar bir arada ilerler.', ''],
  ['Matematikten Çekinenlere Özel Ders', 'Matematik denince geriliyor ya da hemen vazgeçiyorsanız, derse en kolay yerden başlanır. Hatalar birlikte incelenir ve öğrenci küçük adımlarla ilerler.', ''],
  ['Sınav Hazırlık Çalışması', 'Yaklaşan sınava göre eksik konular belirlenir, kısa ve düzenli bir çalışma planı çıkarılır.', ''],
  ['Ön Görüşme', 'Ders başlamadan önce öğrenci ve aileyle tanışılır, ihtiyaçlar konuşulur. Devam edip etmemeye bu görüşmeden sonra karar verilir.', ''],
];

const POSTS = [
  [
    'Matematik kaygısı nedir, nasıl azalır?',
    'Matematik dersinde gerilen ya da hemen kaçmak isteyen öğrenciler için üç küçük öneri.',
    'Matematik kaygısı, matematikle karşılaşınca yaşanan gerginlik ve kaçma isteğidir. Çoğu zaman yetenekle ilgisi yoktur; geçmişte yaşanan bir kötü sınavın ya da "ben bunu yapamam" düşüncesinin izidir.\n\nİşe yarayan üç küçük adım: Birincisi, çalışmaya öğrencinin kolayca yapabildiği bir sorudan başlamak. İkincisi, yanlış cevabı başarısızlık değil bilgi olarak görmek; hata, eksik halkanın nerede olduğunu gösterir. Üçüncüsü, uzun ve nadir çalışmak yerine kısa ve düzenli çalışmak.\n\nKaygı günlük hayatı ya da uykuyu ciddi şekilde etkiliyorsa, bir ruh sağlığı uzmanına danışmak en doğrusudur.',
  ],
  [
    'Evde matematik çalışırken işe yarayan dört alışkanlık',
    'Çalışma saatini daha verimli ve daha az yorucu hale getirmek için basit alışkanlıklar.',
    'Her gün aynı saatte, 25-30 dakikalık kısa bir çalışma, haftada bir kez üç saat çalışmaktan daha kalıcıdır.\n\nTakıldığınız soruyu hemen çözüme bakmadan önce kendi cümlelerinizle yazın: "Ne veriliyor, ne isteniyor?" Birçok soru bu adımda açılır.\n\nÇözemediğiniz soruları bir deftere işaretleyin ve ders sırasında birlikte bakın. Kaç tane olduğu önemli değil; hangi tür sorularda takıldığınız önemli.\n\nSon olarak çalışmayı bir şeyi tamamlayarak bitirin. Küçük de olsa bitmiş bir iş, bir sonraki gün için motivasyon bırakır.',
  ],
];

async function init() {
  if (!(await knex.schema.hasTable('services'))) {
    await knex.schema.createTable('services', (t) => {
      t.increments('id');
      t.string('title', 80).notNullable();
      t.text('description').notNullable();
      t.string('price_note', 60);
      t.timestamp('created_at').defaultTo(knex.fn.now());
    });
    await knex('services').insert(SERVICES.map(([title, description, price_note]) => ({ title, description, price_note })));
  }
  if (!(await knex.schema.hasTable('posts'))) {
    await knex.schema.createTable('posts', (t) => {
      t.increments('id');
      t.string('title', 120).notNullable();
      t.string('summary', 200).notNullable();
      t.text('body').notNullable();
      t.timestamp('created_at').defaultTo(knex.fn.now());
    });
    await knex('posts').insert(POSTS.map(([title, summary, body]) => ({ title, summary, body })));
  }
  if (!(await knex.schema.hasTable('requests'))) {
    await knex.schema.createTable('requests', (t) => {
      t.increments('id');
      t.string('name', 80).notNullable();
      t.string('phone', 30).notNullable();
      t.string('email', 120);
      t.string('grade', 30).notNullable();
      t.string('mode', 30).notNullable();
      t.text('message').notNullable();
      t.string('status', 20).notNullable().defaultTo('yeni');
      t.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }
}

module.exports = { knex, init };
