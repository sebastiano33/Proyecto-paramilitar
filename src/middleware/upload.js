const multer = require('multer');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        if (allowed.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Tipo de archivo no permitido'), false);
    }
});

const processImage = async (req, res, next) => {
    if (!req.files || req.files.length === 0) return next();

    const uploadDir = path.join(__dirname, '../../uploads/complaints');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    try {
        req.body.mediaUrls = await Promise.all(req.files.map(async (file, index) => {
            const filename = `${uuidv4()}-${Date.now()}.webp`;
            const filepath = path.join(uploadDir, filename);

            await sharp(file.buffer)
                .resize({ width: 1200, withoutEnlargement: true })
                .webp({ quality: 82 })
                .withMetadata(false) // Quitar EXIF/GPS para privacidad
                .toFile(filepath);

            return `/uploads/complaints/${filename}`;
        }));
        next();
    } catch (err) {
        next(err);
    }
};

module.exports = { upload, processImage };
