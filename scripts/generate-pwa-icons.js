const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const inputImage = 'C:/Users/DISTRIEMPAQUES/.gemini/antigravity/brain/8028d81f-bd79-473b-9774-00aa737313b2/saferoute_logo_512_1777951436317.png';
const outputDir = 'c:/Users/DISTRIEMPAQUES/Desktop/Safe and route/frontend-map/icons';

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function generateIcons() {
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    for (const size of sizes) {
        await sharp(inputImage)
            .resize(size, size)
            .toFile(path.join(outputDir, `icon-${size}x${size}.png`));
        console.log(`Generado: icon-${size}x${size}.png`);
    }

    // Iconos para shortcuts
    await sharp(inputImage).resize(192, 192).toFile(path.join(outputDir, 'map.png'));
    await sharp(inputImage).resize(192, 192).toFile(path.join(outputDir, 'alert.png'));
}

generateIcons().catch(console.error);
