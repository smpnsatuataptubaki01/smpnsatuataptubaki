const fs = require('fs');
const express = require('express');
const mysql = require('mysql');
const path = require('path');
const multer = require('multer');
const XLSX = require('xlsx');
const session = require('express-session');

const app = express();

// --- 1. OTOMATISASI FOLDER ---
const folders = ['./public/uploads', './public/gambar', './public/uploads/docs'];
folders.forEach(dir => {
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }
});

// --- 2. PENGATURAN MIDDLEWARE & ENGINE ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/gambar', express.static(path.join(__dirname, 'public/gambar')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

app.use(session({
    secret: 'smpn-satap-nanaenoe-key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 3600000, secure: false } 
}));

// --- 3. KONEKSI KE DATABASE ---
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '', 
    database: 'smpn_tubaki',
    multipleStatements: true 
});

db.connect((err) => {
    if (err) return console.error('❌ Database Error:', err.message);
    console.log('✅ Database Terhubung.');
});

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

// --- 4. KONFIGURASI MULTER (UPDATED) ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Logika: Jika file adalah PDF/Dokumen, arahkan ke public/uploads/docs
        if (file.mimetype === 'application/pdf' || 
            file.mimetype === 'application/msword' || 
            file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            file.originalname.match(/\.(pdf|doc|docx)$/)) {
            cb(null, 'public/uploads/docs'); 
        } else {
            // Selain itu (Gambar), masuk ke public/gambar
            cb(null, 'public/gambar');
        }
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '-'));
    }
});
const upload = multer({ storage: storage });

// --- 5. RUTE NAVIGASI USER ---

app.get('/', (req, res) => {
    const sql = `
        SELECT * FROM slider ORDER BY id DESC; 
        SELECT * FROM berita ORDER BY id DESC LIMIT 6; 
        SELECT * FROM pengumuman ORDER BY id DESC LIMIT 5;
        SELECT * FROM statistik LIMIT 1;
        SELECT * FROM guru ORDER BY id ASC;
    `;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).send("Database Error: " + err.message);
        const dataStatistik = (results[3] && results[3].length > 0) 
            ? results[3][0] 
            : { ruang_belajar: 0, tenaga_pendidik: 0, tenaga_kependidikan: 0, murid: 0 };
        res.render('index', { 
            daftarSlider: results[0] || [], 
            daftarBerita: results[1] || [], 
            daftarPengumuman: results[2] || [],
            stats: dataStatistik,
            daftarGuru: results[4] || []
        });
    });
});

app.get('/pengumuman', (req, res) => {
    db.query("SELECT * FROM pengumuman ORDER BY id DESC", (err, results) => {
        if (err) return res.status(500).send("Database Error");
        res.render('pengumuman', { daftarPengumuman: results || [] });
    });
});

app.get('/berita', (req, res) => {
    db.query("SELECT * FROM berita ORDER BY id DESC", (err, results) => {
        if (err) return res.status(500).send("Database Error");
        res.render('berita', { daftarBerita: results || [] });
    });
});

app.get('/berita/:id', (req, res) => {
    const id = req.params.id;
    db.query("SELECT * FROM berita WHERE id = ?", [id], (err, result) => {
        if (err || result.length === 0) return res.redirect('/berita');
        res.render('detail-berita', { berita: result[0] });
    });
});

app.get('/guru', (req, res) => {
    db.query("SELECT * FROM guru ORDER BY id ASC", (err, results) => {
        if (err) return res.status(500).send("Database Error");
        res.render('guru', { daftarGuru: results });
    });
});

app.get('/tentang-sekolah', (req, res) => res.render('tentang-sekolah'));
app.get('/visimisi', (req, res) => res.render('visimisi'));
app.get('/struktur-organisasi', (req, res) => res.render('struktur-organisasi'));
app.get('/kurikulum', (req, res) => res.render('kurikulum'));
app.get('/osis', (req, res) => res.render('osis'));
app.get('/ekstrakurikuler', (req, res) => res.render('ekstrakurikuler'));
app.get('/video', (req, res) => res.render('video'));
app.get('/persyaratan', (req, res) => res.render('persyaratan'));
app.get('/kontak', (req, res) => res.render('kontak'));
app.get('/formulir', (req, res) => res.render('formulir'));

app.get('/prestasi', (req, res) => {
    db.query("SELECT * FROM prestasi ORDER BY id DESC", (err, results) => {
        res.render('prestasi', { daftarPrestasi: results || [] });
    });
});

app.get('/galeri', (req, res) => {
    db.query("SELECT * FROM galeri ORDER BY id DESC", (err, results) => {
        res.render('galeri', { daftarGaleri: results || [] });
    });
});

// --- 6. RUTE LOGIN & LOGOUT ---
app.get('/login', (req, res) => {
    if (req.session.isAdmin) return res.redirect('/admin');
    res.render('login');
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === 'admin123') {
        req.session.isAdmin = true;
        req.session.save(() => { res.redirect('/admin'); });
    } else {
        res.send('<script>alert("Login Gagal!"); window.location="/login";</script>');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => { res.redirect('/login'); });
});

// --- 7. RUTE ADMIN ---
app.get('/admin', checkLogin, (req, res) => {
    const sql = `
        SELECT * FROM pengumuman ORDER BY id DESC;
        SELECT * FROM guru ORDER BY id DESC;
        SELECT * FROM pendaftaran ORDER BY id DESC;
        SELECT * FROM berita ORDER BY id DESC;
        SELECT * FROM slider ORDER BY id DESC;
        SELECT * FROM galeri ORDER BY id DESC;
        SELECT * FROM statistik LIMIT 1;
    `;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).send("Database Error");
        res.render('admin', { 
            daftarPengumuman: results[0] || [], 
            daftarGuru: results[1] || [],
            daftarPendaftar: results[2] || [], 
            daftarBerita: results[3] || [],
            daftarSlider: results[4] || [], 
            daftarGaleri: results[5] || [],
            stats: (results[6] && results[6][0]) || { ruang_belajar: 0, tenaga_pendidik: 0, tenaga_kependidikan: 0, murid: 0 }
        });
    });
});

// --- 8. PROSES CRUD ADMIN (UPDATED) ---

app.post('/admin/tambah-pengumuman', checkLogin, upload.single('file_pdf'), (req, res) => {
    const { judul } = req.body;
    const file = req.file ? req.file.filename : null;

    if (!file) {
        return res.send('<script>alert("Gagal: Mohon pilih file PDF!"); window.location="/admin";</script>');
    }

    // Gunakan query yang lebih aman dan pastikan nama kolom (judul, file_pdf) sesuai dengan DB
    const sql = "INSERT INTO pengumuman (judul, file_pdf) VALUES (?, ?)";
    db.query(sql, [judul, file], (err, result) => {
        if (err) {
            // Ini akan memunculkan detail error di Terminal/CMD Anda
            console.error("❌ Database Insert Error:", err);
            return res.status(500).send("Gagal simpan ke Database: " + err.message);
        }
        res.send('<script>alert("Pengumuman Berhasil Diupload!"); window.location="/admin";</script>');
    });
});
app.post('/admin/update-statistik', checkLogin, (req, res) => {
    const { ruang, guru, staf, murid } = req.body;
    db.query("SELECT id FROM statistik LIMIT 1", (err, rows) => {
        let sql, params = [ruang, guru, staf, murid];
        if (rows.length > 0) {
            sql = "UPDATE statistik SET ruang_belajar=?, tenaga_pendidik=?, tenaga_kependidikan=?, murid=? WHERE id=?";
            params.push(rows[0].id);
        } else {
            sql = "INSERT INTO statistik (ruang_belajar, tenaga_pendidik, tenaga_kependidikan, murid) VALUES (?, ?, ?, ?)";
        }
        db.query(sql, params, () => res.send('<script>alert("Statistik Diperbarui!"); window.location="/admin";</script>'));
    });
});

app.post('/admin/tambah-berita', checkLogin, upload.single('gambar_berita'), (req, res) => {
    const { judul, isi } = req.body;
    const gambar = req.file ? req.file.filename : null;
    db.query("INSERT INTO berita (judul, isi, gambar) VALUES (?, ?, ?)", [judul, isi, gambar], () => {
        res.send('<script>alert("Berita Berhasil!"); window.location="/admin";</script>');
    });
});

app.get('/admin/hapus-berita/:id', checkLogin, (req, res) => {
    db.query("DELETE FROM berita WHERE id = ?", [req.params.id], () => res.redirect('/admin'));
});

app.get('/admin/hapus-pengumuman/:id', checkLogin, (req, res) => {
    db.query("DELETE FROM pengumuman WHERE id = ?", [req.params.id], () => res.redirect('/admin'));
});

app.post('/admin/tambah-guru', checkLogin, upload.single('foto'), (req, res) => {
    const { nama, jabatan } = req.body;
    const foto = req.file ? req.file.filename : null;
    db.query("INSERT INTO guru (nama, jabatan, foto) VALUES (?, ?, ?)", [nama, jabatan, foto], () => {
        res.send('<script>alert("Guru Tersimpan!"); window.location="/admin";</script>');
    });
});

app.get('/admin/hapus-guru/:id', checkLogin, (req, res) => {
    db.query("DELETE FROM guru WHERE id = ?", [req.params.id], () => res.redirect('/admin'));
});

app.post('/admin/tambah-slider', checkLogin, upload.single('gambar_slider'), (req, res) => {
    const { judul, sub_judul } = req.body;
    const gambar = req.file ? req.file.filename : null;
    db.query("INSERT INTO slider (judul, sub_judul, gambar) VALUES (?, ?, ?)", [judul, sub_judul, gambar], () => {
        res.send('<script>alert("Slider Ditambahkan!"); window.location="/admin";</script>');
    });
});

app.get('/admin/hapus-slider/:id', checkLogin, (req, res) => {
    db.query("DELETE FROM slider WHERE id = ?", [req.params.id], () => res.redirect('/admin'));
});

app.get('/admin/ekspor-ppdb', checkLogin, (req, res) => {
    db.query("SELECT tgl_daftar, nama_lengkap, nisn, sekolah_asal, whatsapp FROM pendaftaran ORDER BY id DESC", (err, results) => {
        const worksheet = XLSX.utils.json_to_sheet(results);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Data PPDB");
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Disposition', `attachment; filename=PPDB_Nanaenoe.xlsx`);
        res.send(buffer);
    });
});

app.listen(3000, () => {
    console.log('🚀 Server running on http://localhost:3000');
});