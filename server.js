const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const cors = require('cors');

const app = express();
const PORT = 3000;

// ملفات JSON + مجلد الصور
const DATA_FILE = path.join(__dirname, 'advertisements.json');
const IMAGES_DIR = path.join(__dirname, 'images');

// إنشاء مجلد الصور لو مش موجود
if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR);

app.use(cors());
app.use(express.json());
app.use(express.static('public')); // ملفات الموقع
app.use('/images', express.static(IMAGES_DIR)); // الوصول للصور عبر HTTP

// صفحة رئيسية للتأكد أن السيرفر شغال
app.get('/', (req, res) => {
  res.send('<h2>Server is running</h2><p>Use /listings to get ads or /images/... to access images</p>');
});

// إعداد multer لتخزين الصور
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      if (!req.body.ad) return cb(new Error('Missing ad data'));
      const ad = JSON.parse(req.body.ad);
      if (!ad.id) return cb(new Error('Missing ad ID'));

      const adFolder = path.join(IMAGES_DIR, String(ad.id));
      if (!fs.existsSync(adFolder)) fs.mkdirSync(adFolder, { recursive: true });
      cb(null, adFolder);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// حفظ أو تعديل إعلان
app.post('/saveListing', upload.array('images'), (req, res) => {
  try {
    if (!req.body.ad) return res.status(400).json({ success: false, message: 'Missing ad data' });
    const ad = JSON.parse(req.body.ad);

    // إضافة الصور الجديدة
    if (req.files && req.files.length) {
      ad.images = req.files.map(f => `http://localhost:${PORT}/images/${ad.id}/${f.filename}`);
    }

    let ads = [];
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf8');
      if (content.trim()) ads = JSON.parse(content);
    }

    const index = ads.findIndex(a => a.id === ad.id);
    if (index !== -1) ads[index] = ad;
    else ads.push(ad);

    fs.writeFileSync(DATA_FILE, JSON.stringify(ads, null, 2));

    res.json({ success: true, message: 'Ad saved successfully', ad });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// استدعاء جميع الإعلانات مع الصور من المجلد
app.get('/listings', (req, res) => {
  try {
    let ads = [];
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf8');
      if (content.trim()) ads = JSON.parse(content);
    }

    ads = ads.map(ad => {
      const adFolder = path.join(IMAGES_DIR, String(ad.id));
      if (fs.existsSync(adFolder)) {
        const files = fs.readdirSync(adFolder);
        ad.images = files.map(f => `http://localhost:${PORT}/images/${ad.id}/${f}`);
      } else {
        ad.images = [];
      }
      return ad;
    });

    res.json(ads);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// تشغيل السيرفر
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
