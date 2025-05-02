#!/usr/bin/env node

const { program } = require('commander');
const path = require('path');
const chalk = require('chalk');
const { processDirectory } = require('./optiweb');
const packageJson = require('../package.json');

program
    .name('optiweb')
    .description('Advanced CLI image optimization tool compliant with Google PageSpeed standards')
    .version(packageJson.version)
    .requiredOption('-i, --input <path>', 'Input folder (required)')
    .requiredOption('-o, --output <path>', 'Output folder (required)')
    .option('-w, --webp', 'Convert to WebP format', false)
    .option('-q, --quality <number>', 'General quality level (0-100)', '85')
    .option('--jpg-quality <number>', 'Quality level for JPG (0-100)')
    .option('--png-quality <number>', 'Quality level for PNG (0-100)')
    .option('-s, --skip-existing', 'Skip files that already exist', false)
    .option('-v, --verbose', 'Verbose output', false)
    .option('--ignore <patterns>', 'Ignore file/folder patterns (comma-separated glob patterns)', '')
    .option('--resize <dimensions>', 'Resize image (e.g. 800x600)')
    .option('--resize-mode <mode>', 'Resize mode (cover, contain, fill, inside, outside)', 'cover')
    .option('--max-width <width>', 'Maximum width, proportional resize')
    .option('--max-height <height>', 'Maximum height, proportional resize')
    .option('--sizes <sizes>', 'Multiple sizes (comma-separated list, e.g. 180,300,500)')
    .option('--suffix-pattern <pattern>', 'File name suffix pattern (e.g. "-{width}")', '-{width}')
    .option('--only-resize', 'Only resize, do not optimize', false)
    .option('--webp-lossless', 'Enable lossless mode for WebP', false)
    .option('--webp-near-lossless', 'Enable nearLossLess mode for WebP', false);

program.parse();

const options = program.opts();

// Giriş ve çıkış yollarını mutlak yollara dönüştür
const inputDir = path.resolve(options.input);
const outputDir = path.resolve(options.output);

// Kalite seviyelerini sayıya dönüştür
const quality = parseInt(options.quality, 10);
const jpgQuality = options.jpgQuality ? parseInt(options.jpgQuality, 10) : quality;
const pngQuality = options.pngQuality ? parseInt(options.pngQuality, 10) : quality;

if (isNaN(quality) || quality < 0 || quality > 100) {
    console.error(chalk.red('Hata: Genel kalite seviyesi 0-100 arasında olmalıdır.'));
    process.exit(1);
}
if (isNaN(jpgQuality) || jpgQuality < 0 || jpgQuality > 100) {
    console.error(chalk.red('Hata: JPG kalite seviyesi 0-100 arasında olmalıdır.'));
    process.exit(1);
}
if (isNaN(pngQuality) || pngQuality < 0 || pngQuality > 100) {
    console.error(chalk.red('Hata: PNG kalite seviyesi 0-100 arasında olmalıdır.'));
    process.exit(1);
}

// Ignore desenlerini parçala
const ignorePatterns = options.ignore ? options.ignore.split(',').map(p => p.trim()) : [];

// Boyutlandırma seçeneklerini işle
let resizeOptions = null;

if (options.sizes) {
    // Çoklu boyutlandırma kullanılıyor
    const sizes = options.sizes.split(',').map(size => {
        const parsed = parseInt(size.trim(), 10);
        if (isNaN(parsed) || parsed <= 0) {
            console.error(chalk.red(`Hata: Geçersiz boyut değeri: ${size}`));
            process.exit(1);
        }
        return parsed;
    });

    resizeOptions = {
        sizes,
        suffixPattern: options.suffixPattern,
        mode: options.resizeMode
    };
} else if (options.resize) {
    // Tek boyutlandırma (width x height) kullanılıyor
    const dimensions = options.resize.split('x');
    if (dimensions.length !== 2 || isNaN(parseInt(dimensions[0])) || isNaN(parseInt(dimensions[1]))) {
        console.error(chalk.red('Hata: Boyutlandırma formatı geçersiz. Doğru format: WIDTHxHEIGHT (örn: 800x600)'));
        process.exit(1);
    }

    resizeOptions = {
        width: parseInt(dimensions[0]),
        height: parseInt(dimensions[1]),
        mode: options.resizeMode
    };
} else if (options.maxWidth || options.maxHeight) {
    // Maksimum boyutlandırma kullanılıyor
    resizeOptions = {};

    if (options.maxWidth) {
        const maxWidth = parseInt(options.maxWidth, 10);
        if (isNaN(maxWidth) || maxWidth <= 0) {
            console.error(chalk.red('Hata: Maksimum genişlik pozitif bir sayı olmalıdır.'));
            process.exit(1);
        }
        resizeOptions.maxWidth = maxWidth;
    }

    if (options.maxHeight) {
        const maxHeight = parseInt(options.maxHeight, 10);
        if (isNaN(maxHeight) || maxHeight <= 0) {
            console.error(chalk.red('Hata: Maksimum yükseklik pozitif bir sayı olmalıdır.'));
            process.exit(1);
        }
        resizeOptions.maxHeight = maxHeight;
    }
}

console.log(chalk.blue('Optiweb başlatılıyor...'));
console.log(chalk.gray(`Giriş klasörü: ${inputDir}`));
console.log(chalk.gray(`Çıkış klasörü: ${outputDir}`));
console.log(chalk.gray(`WebP dönüşümü: ${options.webp ? 'Evet' : 'Hayır'}`));
console.log(chalk.gray(`Genel kalite seviyesi: ${quality}`));
console.log(chalk.gray(`JPG kalite seviyesi: ${jpgQuality}`));
console.log(chalk.gray(`PNG kalite seviyesi: ${pngQuality}`));
console.log(chalk.gray(`Var olan dosyaları atla: ${options.skipExisting ? 'Evet' : 'Hayır'}`));
console.log(chalk.gray(`Detaylı çıktı: ${options.verbose ? 'Evet' : 'Hayır'}`));
console.log(chalk.gray(`Sadece boyutlandırma: ${options.onlyResize ? 'Evet' : 'Hayır'}`));

if (ignorePatterns.length > 0) {
    console.log(chalk.gray(`Yoksayılan desenler: ${ignorePatterns.join(', ')}`));
}

// Boyutlandırma bilgilerini göster
if (resizeOptions) {
    if (resizeOptions.sizes) {
        console.log(chalk.gray(`Çoklu boyutlandırma: ${resizeOptions.sizes.join(', ')} (mod: ${options.resizeMode})`));
        console.log(chalk.gray(`Suffix deseni: ${options.suffixPattern}`));
    } else if (resizeOptions.width && resizeOptions.height) {
        console.log(chalk.gray(`Yeniden boyutlandırma: ${resizeOptions.width}x${resizeOptions.height} (mod: ${options.resizeMode})`));
    } else {
        if (resizeOptions.maxWidth) {
            console.log(chalk.gray(`Maksimum genişlik: ${resizeOptions.maxWidth}px`));
        }
        if (resizeOptions.maxHeight) {
            console.log(chalk.gray(`Maksimum yükseklik: ${resizeOptions.maxHeight}px`));
        }
    }
}

// Optimizasyon işlemini başlat
processDirectory(inputDir, outputDir, {
    webp: options.webp,
    quality,
    jpgQuality,
    pngQuality,
    skipExisting: options.skipExisting,
    verbose: options.verbose,
    ignorePatterns,
    resize: resizeOptions,
    onlyResize: options.onlyResize,
    webpLossless: options.webpLossless,
    webpNearLossless: options.webpNearLossless
})
    .then(results => {
        console.log(chalk.green('\n✅ Optimizasyon tamamlandı!'));
        console.log(chalk.gray(`İşlenen dosya sayısı: ${results.totalFiles}`));
        console.log(chalk.gray(`Optimize edilen görüntü sayısı: ${results.optimizedImages}`));
        if (results.resizedImages > 0) {
            console.log(chalk.gray(`Yeniden boyutlandırılan görüntü sayısı: ${results.resizedImages}`));
        }
        if (results.multiSizeImages > 0) {
            console.log(chalk.gray(`Çoklu boyutlandırma yapılan görüntü sayısı: ${results.multiSizeImages}`));
        }
        if (results.skippedImages > 0) {
            console.log(chalk.gray(`WebP versiyonu olduğu için atlanan görüntü sayısı: ${results.skippedImages}`));
        }
        if (results.ignoredFiles > 0) {
            console.log(chalk.gray(`Yoksayılan dosya sayısı: ${results.ignoredFiles}`));
        }
        console.log(chalk.gray(`Kopyalanan diğer dosya sayısı: ${results.copiedFiles}`));

        if (results.totalSaved > 0) {
            const savedInMB = (results.totalSaved / (1024 * 1024)).toFixed(2);
            console.log(chalk.green(`Toplam kazanılan alan: ${savedInMB} MB`));
            const reductionPercentage = ((results.totalSaved / results.totalSize) * 100).toFixed(2);
            console.log(chalk.green(`Toplam küçülme oranı: %${reductionPercentage}`));
        }
    })
    .catch(err => {
        console.error(chalk.red('Hata:', err.message));
        process.exit(1);
    });