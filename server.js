const path = require('path');
const fs = require('fs');

// --- 1. CARA PAKSA MUAT .ENV (ANTI GAGAL) ---
const envPath = path.join(__dirname, '.env');
const hasilEnv = require('dotenv').config({ path: envPath });

if (hasilEnv.error) {
    console.log("❌ ERROR: Gagal memuat file .env!");
    console.log("Lokasi yang dicari:", envPath);
} else {
    console.log("✅ File .env ditemukan dan berhasil dimuat.");
}

// --- 2. IMPORT MODUL LAINNYA ---
const express = require('express');
const mysql = require('mysql');
const multer = require('multer');
const XLSX = require('xlsx');
const session = require('express-session');
const nodemailer = require('nodemailer');

const app = express();

// --- 3. DEBUG KONFIGURASI (CEK VARIABEL) ---
console.log("--- DEBUG KONFIGURASI ---");
console.log("DB Host   :", process.env.DB_HOST || 'localhost (default)');
console.log("Email User:", process.env.EMAIL_USER || 'KOSONG');
console.log("Email Pass:", process.env.EMAIL_PASS ? "TERISI (Tersembunyi)" : "KOSONG");
console.log("-------------------------");

// --- 4. OTOMATISASI FOLDER ---
const folders = [
    './public/uploads', 
    './public/gambar', 
    './public/uploads/docs', 
    './public/gambar/prestasi',
    './public/gambar/osis/struktur',
    './public/gambar/osis/kegiatan',
    './public/gambar/brosur',
    './public/gambar/galeri'
];
folders.forEach(dir => {
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }
});
// Daftarkan folder uploads agar bisa diakses publik
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
// Atau jika folder uploads berada di luar folder public:
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- 5. PENGATURAN MIDDLEWARE & ENGINE ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/gambar', express.static(path.join(__dirname, 'public/gambar')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

app.use(session({
    secret: process.env.SESSION_SECRET || 'smpn-satap-nanaenoe-key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 3600000, 
        secure: false, 
        httpOnly: true 
    } 
}));

// --- 6. KONEKSI KE DATABASE ---
const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '', 
    database: process.env.DB_NAME || 'smpn_tubaki',
    multipleStatements: true,
    ssl: {
        rejectUnauthorized: false
    }
});

db.connect((err) => {
    if (err) {
        console.error('❌ Database Error:', err.message);
    } else {
        console.log('✅ Database Terhubung.');
    }
});

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'smpnsatuataptubaki01@gmail.com',
        pass: 'kyjkbmlgcyxjqvaf'
    }
});

// Middleware Navigasi (Daftar Guru di Navbar)
app.use((req, res, next) => {
    db.query("SELECT * FROM guru ORDER BY id ASC", (err, results) => {
        res.locals.daftarGuruNav = err ? [] : results;
        next();
    });
});

const checkLogin = (req, res, next) => {
    if (req.session && req.session.isAdmin) {
        next();
    } else {
        res.send('<script>alert("Akses ditolak! Silakan login."); window.location="/login";</script>');
    }
};

// --- 8. KONFIGURASI MULTER ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (file.fieldname === 'gambar') cb(null, 'public/gambar/prestasi');
        else if (file.fieldname === 'foto_pengurus') cb(null, 'public/gambar/osis/struktur');
        else if (file.fieldname === 'gambar_kegiatan') cb(null, 'public/gambar/osis/kegiatan');
        else if (file.fieldname === 'dokumen_syarat') cb(null, 'public/uploads/docs'); 
        else if (file.fieldname === 'foto_kepsek') cb(null, 'public/gambar');
        else if (file.fieldname === 'file_brosur') cb(null, 'public/gambar/brosur');
        else if (file.fieldname === 'foto') cb(null, 'public/gambar');
        else if (file.fieldname === 'gambar_slider') cb(null, 'public/gambar');
        else if (file.fieldname === 'gambar_berita') cb(null, 'public/gambar');
        else if (file.fieldname === 'file_pdf') cb(null, 'public/uploads/docs');
        else if (file.fieldname === 'gambar_galeri') cb(null, 'public/gambar/galeri');
        else cb(null, 'public/gambar');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '-'));
    }
});
const upload = multer({ storage: storage });

// --- 9. RUTE USER ---
app.get('/', (req, res) => {
    // Note: Pastikan semua tabel ini (slider, berita, pengumuman, sambutan, brosur, running_text, statistik) sudah dibuat di TiDB
    const sql = `
        SELECT * FROM slider ORDER BY id DESC;
        SELECT * FROM berita ORDER BY id DESC LIMIT 3;
        SELECT * FROM pengumuman ORDER BY id DESC LIMIT 5;
        SELECT * FROM sambutan LIMIT 1;
        SELECT * FROM brosur WHERE aktif = 1 ORDER BY id DESC LIMIT 1;
        SELECT * FROM running_text LIMIT 1;
        SELECT * FROM statistik LIMIT 1;
    `;
    db.query(sql, (err, results) => {
        if (err) {
            console.error("❌ Error di Halaman Utama:", err.message);
            return res.status(500).send("Database Error di Halaman Utama: " + err.message);
        }
        res.render('index', { 
            daftarSlider: results[0] || [],
            daftarBerita: results[1] || [],
            daftarPengumuman: results[2] || [],
            sambutan: results[3][0] || { nama_kepsek: '-', foto: 'default.jpg', isi: '' },
            brosur: results[4][0] || null,
            runningText: results[5][0] || { pesan: '' },
            stats: results[6][0] || { ruang_belajar: 0, tenaga_pendidik: 0, tenaga_kependidikan: 0, murid: 0 }
        });
    });
});

app.get('/osis', (req, res) => {
    const sql = "SELECT * FROM osis_struktur ORDER BY id ASC; SELECT * FROM osis_kegiatan ORDER BY tanggal DESC";
    db.query(sql, (err, results) => {
        if (err) return res.status(500).send("Database Error");
        res.render('osis', { strukturOsis: results[0] || [], kegiatanOsis: results[1] || [] });
    });
});

app.get('/pengumuman', (req, res) => {
    db.query("SELECT * FROM pengumuman ORDER BY id DESC", (err, results) => {
        res.render('pengumuman', { daftarPengumuman: results || [] });
    });
});

app.get('/berita', (req, res) => {
    db.query("SELECT * FROM berita ORDER BY id DESC", (err, results) => {
        res.render('berita', { daftarBerita: results || [] });
    });
});

app.get('/berita/:id', (req, res) => {
    db.query("SELECT * FROM berita WHERE id = ?", [req.params.id], (err, result) => {
        if (err || result.length === 0) return res.redirect('/berita');
        res.render('detail-berita', { berita: result[0] });
    });
});

app.get('/guru', (req, res) => {

    const sqlPendidik = "SELECT * FROM guru WHERE kategori = 'pendidik' ORDER BY id ASC";
    const sqlStaf = "SELECT * FROM guru WHERE kategori = 'kependidikan' ORDER BY id ASC";
    
    db.query(`${sqlPendidik}; ${sqlStaf}`, (err, results) => {
        if (err) {
            console.error("❌ Error Database Guru:", err);
            return res.status(500).send("Database Error");
        }

        res.render('guru', { 

            daftarGuru: results[0] || [],
            daftarStaf: results[1] || []
        });
    });

});

app.get('/tentang-sekolah', (req, res) => res.render('tentang-sekolah'));
app.get('/visimisi', (req, res) => res.render('visimisi'));
app.get('/kurikulum', (req, res) => res.render('kurikulum'));
app.get('/persyaratan', (req, res) => res.render('persyaratan'));
app.get('/kontak', (req, res) => res.render('kontak'));
app.get('/formulir', (req, res) => res.render('formulir'));

app.get('/ekstrakurikuler', (req, res) => {
    db.query("SELECT * FROM ekskul ORDER BY id DESC", (err, results) => {
        res.render('ekstrakurikuler', { daftarEkskul: results || [] });
    });
});

app.get('/prestasi', (req, res) => {
    db.query("SELECT * FROM prestasi ORDER BY id DESC", (err, results) => {
        res.render('prestasi', { daftarPrestasi: results || [] });
    });
});

app.get('/galeri', (req, res) => {
    db.query("SELECT * FROM galeri WHERE tipe = 'foto' ORDER BY id DESC", (err, results) => {
        res.render('galeri', { daftarGaleri: results || [] });
    });
});

app.get('/video', (req, res) => {
    db.query("SELECT * FROM galeri WHERE tipe = 'video' ORDER BY id DESC", (err, results) => {
        if (err) return res.status(500).send("Database Error");
        res.render('video', { daftarVideo: results || [] });
    });
});

// --- 10. AUTHENTICATION (RUTE LOGIN) ---
app.get('/login', (req, res) => {
    if (req.session.isAdmin) return res.redirect('/admin');
    res.render('login');
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Ganti 'admin_baru' dan 'password_baru' sesuai keinginan Anda
    if (username === 'admin' && password === 'tubaki2026@@') { 
        req.session.isAdmin = true;
        req.session.save(() => res.redirect('/admin'));
    } else {
        res.send('<script>alert("Login Gagal!"); window.location="/login";</script>');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/login'));
});

// --- 11. ADMIN PANEL ---
app.get('/admin', checkLogin, (req, res) => {
    const sql = `
        SELECT * FROM pengumuman ORDER BY id DESC;
        SELECT * FROM guru WHERE kategori = 'pendidik' ORDER BY id DESC;
        SELECT * FROM guru WHERE kategori = 'kependidikan' ORDER BY id DESC;
        SELECT * FROM pendaftaran ORDER BY id DESC;
        SELECT * FROM berita ORDER BY id DESC;
        SELECT * FROM slider ORDER BY id DESC;
        SELECT * FROM galeri ORDER BY id DESC;
        SELECT * FROM statistik LIMIT 1;
        SELECT * FROM prestasi ORDER BY id DESC;
        SELECT * FROM osis_struktur ORDER BY id ASC;
        SELECT * FROM osis_kegiatan ORDER BY tanggal DESC;
        SELECT * FROM running_text LIMIT 1;
        SELECT * FROM ekskul ORDER BY id DESC;
        SELECT * FROM sambutan LIMIT 1;
        SELECT * FROM brosur ORDER BY id DESC;
    `;
    db.query(sql, (err, results) => {
        if (err) {
            console.error("❌ Error Panel Admin:", err.message);
            return res.status(500).send("Database Error Panel Admin: " + err.message);
        }

        res.render('admin', { 
            daftarPengumuman: results[0] || [], 
            daftarGuru: results[1] || [], 
            daftarStaf: results[2] || [], 
            daftarPendaftar: results[3] || [], 
            daftarBerita: results[4] || [],
            daftarSlider: results[5] || [], 
            daftarGaleri: results[6] || [],
            stats: results[7][0] || { ruang_belajar: 0, tenaga_pendidik: 0, tenaga_kependidikan: 0, murid: 0 },
            daftarPrestasi: results[8] || [],
            strukturOsis: results[9] || [],
            kegiatanOsis: results[10] || [],
            runningText: results[11][0] || { pesan: '' },
            daftarEkskul: results[12] || [],
            sambutan: results[13][0] || { nama_kepsek: '-', foto: 'default.jpg', isi: '' },
            daftarBrosur: results[14] || []
        });
    });
});

// --- 12. CRUD OPERATIONS (ADMIN) ---
app.post('/admin/tambah-galeri', checkLogin, upload.single('gambar_galeri'), (req, res) => {
    const { judul, tipe, link_video } = req.body;
    const fileGambar = req.file ? req.file.filename : null;
    const sql = "INSERT INTO galeri (judul, gambar, tipe, link_video) VALUES (?, ?, ?, ?)";
    const values = [judul || 'Tanpa Judul', fileGambar || '', tipe || 'foto', link_video || null];
    db.query(sql, values, (err, result) => {
        if (err) return res.status(500).send("Gagal tambah galeri: " + err.message);
        res.redirect('/admin');
    });
});

app.get('/admin/hapus-galeri/:id', checkLogin, (req, res) => {
    db.query("SELECT gambar FROM galeri WHERE id = ?", [req.params.id], (err, row) => {
        if (!err && row.length > 0 && row[0].gambar) {
            const filePath = path.join(__dirname, 'public/gambar/galeri', row[0].gambar);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        db.query("DELETE FROM galeri WHERE id=?", [req.params.id], () => res.redirect('/admin'));
    });
});

app.post('/admin/update-statistik', checkLogin, (req, res) => {
    const { ruang, guru, staf, murid } = req.body;
    db.query("SELECT id FROM statistik LIMIT 1", (err, rows) => {
        if (rows.length > 0) {
            db.query("UPDATE statistik SET ruang_belajar=?, tenaga_pendidik=?, tenaga_kependidikan=?, murid=? WHERE id=?", 
            [ruang, guru, staf, murid, rows[0].id], () => res.redirect('/admin'));
        } else {
            db.query("INSERT INTO statistik (ruang_belajar, tenaga_pendidik, tenaga_kependidikan, murid) VALUES (?,?,?,?)", 
            [ruang, guru, staf, murid], () => res.redirect('/admin'));
        }
    });
});

app.post('/admin/update-sambutan', checkLogin, upload.single('foto_kepsek'), (req, res) => {
    const { nama_kepsek, isi_sambutan } = req.body;
    db.query("SELECT id FROM sambutan LIMIT 1", (err, rows) => {
        let sql, params;
        if (rows.length > 0) {
            sql = "UPDATE sambutan SET nama_kepsek=?, isi=?" + (req.file ? ", foto=?" : "") + " WHERE id=?";
            params = [nama_kepsek, isi_sambutan];
            if (req.file) params.push(req.file.filename);
            params.push(rows[0].id);
        } else {
            sql = "INSERT INTO sambutan (nama_kepsek, isi, foto) VALUES (?,?,?)";
            params = [nama_kepsek, isi_sambutan, req.file ? req.file.filename : 'default.jpg'];
        }
        db.query(sql, params, () => res.redirect('/admin'));
    });
});

app.post('/admin/tambah-brosur', checkLogin, upload.single('file_brosur'), (req, res) => {
    const { judul } = req.body;
    if (!req.file) return res.send('<script>alert("File wajib diunggah!"); window.location="/admin";</script>');
    db.query("INSERT INTO brosur (judul, gambar, aktif) VALUES (?, ?, 1)", [judul, req.file.filename], () => res.redirect('/admin'));
});

app.get('/admin/hapus-brosur/:id', checkLogin, (req, res) => {
    db.query("SELECT gambar FROM brosur WHERE id=?", [req.params.id], (err, row) => {
        if (row && row.length > 0) {
            const p = path.join(__dirname, 'public/gambar/brosur/', row[0].gambar);
            if (fs.existsSync(p)) fs.unlinkSync(p);
            db.query("DELETE FROM brosur WHERE id=?", [req.params.id], () => res.redirect('/admin'));
        } else res.redirect('/admin');
    });
});

app.post('/admin/update-running-text', checkLogin, (req, res) => {
    db.query("SELECT id FROM running_text LIMIT 1", (err, rows) => {
        if (rows.length > 0) db.query("UPDATE running_text SET pesan=? WHERE id=?", [req.body.pesan, rows[0].id], () => res.redirect('/admin'));
        else db.query("INSERT INTO running_text (pesan) VALUES (?)", [req.body.pesan], () => res.redirect('/admin'));
    });
});

app.post('/admin/berita/tambah', checkLogin, upload.single('gambar_berita'), (req, res) => {
    const { judul, isi } = req.body;
    const gambar = req.file ? req.file.filename : null;

    // Perhatikan: Kita tidak perlu memasukkan tgl_posting di sini
    const sql = "INSERT INTO berita (judul, isi, gambar) VALUES (?, ?, ?)";
    
    db.query(sql, [judul, isi, gambar], (err, result) => {
        if (err) {
            console.error("❌ Gagal posting berita:", err);
            return res.status(500).send("Error database.");
        }
        res.redirect('/admin#berita-panel');
    });
});
// --- FITUR EDIT BERITA ---

// 1. Menampilkan Halaman Formulir Edit
app.get('/admin/berita/edit/:id', checkLogin, (req, res) => {
    const id = req.params.id;
    const sql = "SELECT * FROM berita WHERE id = ?";
    
    db.query(sql, [id], (err, results) => {
        if (err) {
            console.error("Error fetching berita:", err);
            return res.status(500).send("Terjadi kesalahan pada database.");
        }
        if (results.length === 0) {
            return res.status(404).send("Berita tidak ditemukan.");
        }
        
        // Mengirim data berita yang dipilih ke file edit_berita.ejs
        res.render('edit_berita', { berita: results[0] });
    });
});

// 2. Memproses Update Data Berita (POST)
app.post('/admin/berita/update/:id', checkLogin, upload.single('gambar_berita'), (req, res) => {
    const id = req.params.id;
    const { judul, isi } = req.body;
    const gambarBaru = req.file ? req.file.filename : null;

    if (gambarBaru) {
        // Jika ada unggahan gambar baru, update judul, isi, dan gambar
        const sql = "UPDATE berita SET judul = ?, isi = ?, gambar = ? WHERE id = ?";
        db.query(sql, [judul, isi, gambarBaru, id], (err) => {
            if (err) return res.status(500).send("Gagal mengupdate berita: " + err.message);
            res.redirect('/admin#berita');
        });
    } else {
        // Jika tidak ada gambar baru, hanya update judul dan isi
        const sql = "UPDATE berita SET judul = ?, isi = ? WHERE id = ?";
        db.query(sql, [judul, isi, id], (err) => {
            if (err) return res.status(500).send("Gagal mengupdate berita: " + err.message);
            res.redirect('/admin#berita');
        });
    }
});

app.get('/admin/hapus-berita/:id', checkLogin, (req, res) => {
    db.query("DELETE FROM berita WHERE id=?", [req.params.id], () => res.redirect('/admin'));
});

app.post('/admin/tambah-pengumuman', checkLogin, upload.single('file_pdf'), (req, res) => {
    db.query("INSERT INTO pengumuman (judul, file_pdf) VALUES (?,?)", [req.body.judul, req.file ? req.file.filename : null], () => res.redirect('/admin'));
});
app.get('/admin/hapus-pengumuman/:id', checkLogin, (req, res) => {
    db.query("DELETE FROM pengumuman WHERE id=?", [req.params.id], () => res.redirect('/admin'));
});

app.post('/admin/tambah-guru', checkLogin, upload.single('foto'), (req, res) => {
    const { nama, jabatan, kategori } = req.body; 
    const foto = req.file ? req.file.filename : null;
    
    if (!kategori) {
        return res.send('<script>alert("Silakan pilih kategori!"); window.history.back();</script>');
    }

    const sql = "INSERT INTO guru (nama, jabatan, kategori, foto) VALUES (?,?,?,?)";
    db.query(sql, [nama, jabatan, kategori, foto], (err) => {
        if (err) {
            console.error("❌ Gagal Tambah Guru/Staf:", err);
            return res.status(500).send("Gagal tambah data: " + err.message);
        }
        res.redirect('/admin');
    });
});

app.get('/admin/hapus-guru/:id', checkLogin, (req, res) => {
    db.query("DELETE FROM guru WHERE id=?", [req.params.id], (err) => {
        if (err) console.error("❌ Gagal Hapus:", err);
        res.redirect('/admin');
    });
});

app.post('/admin/tambah-slider', checkLogin, upload.single('gambar_slider'), (req, res) => {
    db.query("INSERT INTO slider (judul, sub_judul, gambar) VALUES (?,?,?)", [req.body.judul, req.body.sub_judul, req.file ? req.file.filename : null], () => res.redirect('/admin'));
});
app.get('/admin/hapus-slider/:id', checkLogin, (req, res) => {
    db.query("DELETE FROM slider WHERE id=?", [req.params.id], () => res.redirect('/admin'));
});

app.post('/admin/tambah-ekskul', checkLogin, upload.any(), (req, res) => {
    db.query("INSERT INTO ekskul (nama, deskripsi, gambar) VALUES (?,?,?)", [req.body.nama_ekskul, req.body.deskripsi, req.files[0] ? req.files[0].filename : null], () => res.redirect('/admin'));
});
app.get('/admin/hapus-ekskul/:id', checkLogin, (req, res) => {
    db.query("DELETE FROM ekskul WHERE id=?", [req.params.id], () => res.redirect('/admin'));
});

app.post('/admin/prestasi/tambah', checkLogin, upload.single('gambar'), (req, res) => {
    db.query("INSERT INTO prestasi (judul, pemenang, kategori, gambar) VALUES (?,?,?,?)", [req.body.judul, req.body.pemenang, req.body.kategori, req.file ? req.file.filename : null], () => res.redirect('/admin'));
});
app.get('/admin/prestasi/hapus/:id', checkLogin, (req, res) => {
    db.query("DELETE FROM prestasi WHERE id=?", [req.params.id], () => res.redirect('/admin'));
});

/// --- BAGIAN STRUKTUR OSIS ---

// Tambah Struktur
app.post('/admin/osis/struktur/tambah', checkLogin, upload.single('foto_pengurus'), (req, res) => {
    const { nama, jabatan } = req.body;
    const foto = req.file ? req.file.filename : 'default.jpg';
    
    db.query("INSERT INTO osis_struktur (nama, jabatan, foto) VALUES (?, ?, ?)", 
    [nama, jabatan, foto], (err) => {
        if (err) return res.status(500).send("Gagal: " + err.message);
        res.redirect('/admin#osis-panel');
    });
});

// Hapus Struktur
app.get('/admin/osis/struktur/hapus/:id', checkLogin, (req, res) => {
    db.query("DELETE FROM osis_struktur WHERE id = ?", [req.params.id], (err) => {
        if (err) return res.status(500).send("Gagal: " + err.message);
        res.redirect('/admin#osis-panel');
    });
});

// --- BAGIAN KEGIATAN OSIS ---

// Tambah Kegiatan
app.post('/admin/osis/kegiatan/tambah', checkLogin, upload.single('gambar_kegiatan'), (req, res) => {
    const { nama_kegiatan, tanggal } = req.body; 
    const gambar = req.file ? req.file.filename : null;
    
    // Pastikan menggunakan judul_kegiatan sesuai struktur tabel Anda
    const sql = "INSERT INTO osis_kegiatan (judul_kegiatan, gambar, tanggal) VALUES (?, ?, ?)";
    db.query(sql, [nama_kegiatan, gambar, tanggal], (err) => {
        if (err) {
            console.error("❌ SQL Error:", err);
            return res.status(500).send("Gagal menyimpan: " + err.message);
        }
        res.redirect('/admin#osis-panel');
    });
});

// PASTIKAN MENGGUNAKAN app.get
app.get('/admin/osis/kegiatan/hapus/:id', checkLogin, (req, res) => {
    const idHapus = req.params.id;
    
    // 1. Log untuk memastikan rute ini terpanggil oleh server
    console.log("Mencoba menghapus kegiatan ID:", idHapus);

    const sql = "DELETE FROM osis_kegiatan WHERE id = ?";
    db.query(sql, [idHapus], (err, result) => {
        if (err) {
            console.error("❌ SQL Error:", err);
            return res.status(500).send("Gagal hapus di database");
        }
        
        // 2. Jika berhasil, kembali ke panel osis
        console.log("✅ Berhasil hapus ID:", idHapus);
        res.redirect('/admin#osis-panel');
    });
});

app.get('/admin/ekspor-ppdb', checkLogin, (req, res) => {
    db.query("SELECT * FROM pendaftaran ORDER BY id DESC", (err, results) => {
        const ws = XLSX.utils.json_to_sheet(results);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "PPDB");
        res.setHeader('Content-Disposition', 'attachment; filename=Data_PPDB.xlsx');
        res.send(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
    });
});

app.get('/admin/hapus-ppdb/:id', checkLogin, (req, res) => {
    db.query("DELETE FROM pendaftaran WHERE id=?", [req.params.id], () => res.redirect('/admin'));
});

// --- 13. FORM SUBMISSION (USER) ---
app.post('/kirim-pesan', (req, res) => {
    const { nama, email, subjek, pesan } = req.body;
    transporter.sendMail({
        from: `"${nama}" <${process.env.EMAIL_USER}>`, 
        to: process.env.EMAIL_USER, 
        replyTo: email, 
        subject: subjek,
        text: `Dari: ${nama} (${email})\n\nPesan:\n${pesan}`
    }, (error) => {
        if (error) {
            console.log("LOG ERROR EMAIL:", error); 
            return res.send(`<script>alert("Gagal kirim email!"); window.location="/kontak";</script>`);
        }
        res.send('<script>alert("Pesan Terkirim!"); window.location="/kontak";</script>');
    });
});

app.post('/daftar-ppdb', upload.single('dokumen_syarat'), (req, res) => {
    const d = req.body;
    const sql = `INSERT INTO pendaftaran (nama_lengkap, nisn, jenis_kelamin, tempat_lahir, tanggal_lahir, sekolah_asal, alamat_sekolah, nama_ortu, whatsapp, alamat_domisili, dokumen, tgl_daftar) VALUES (?,?,?,?,?,?,?,?,?,?,?,NOW())`;
    db.query(sql, [d.nama_lengkap, d.nisn, d.jenis_kelamin, d.tempat_lahir, d.tanggal_lahir, d.sekolah_asal, d.alamat_sekolah, d.nama_ortu, d.whatsapp, d.alamat_domisili, req.file ? req.file.filename : null], (err) => {
        if (err) return res.status(500).send("Gagal mendaftar: " + err.message);
        res.send('<script>alert("Pendaftaran Berhasil!"); window.location="/formulir";</script>');
    });
});

// --- 14. START SERVER ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
});