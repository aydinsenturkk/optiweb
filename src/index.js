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
  .option(
    '--slug',
    'Convert image filenames to slug format (lowercase, no spaces, web-friendly)',
    false,
  )
  .option('--webp-lossless', 'Enable lossless mode for WebP', false)
  .option('--webp-near-lossless', 'Enable nearLossLess mode for WebP', false);

program.parse();

const options = program.opts();

// Convert input and output paths to absolute paths
const inputDir = path.resolve(options.input);
const outputDir = path.resolve(options.output);

// Convert quality levels to numbers
const quality = parseInt(options.quality, 10);
const jpgQuality = options.jpgQuality ? parseInt(options.jpgQuality, 10) : quality;
const pngQuality = options.pngQuality ? parseInt(options.pngQuality, 10) : quality;

if (isNaN(quality) || quality < 0 || quality > 100) {
  console.error(chalk.red('Error: General quality level must be between 0-100.'));
  process.exit(1);
}
if (isNaN(jpgQuality) || jpgQuality < 0 || jpgQuality > 100) {
  console.error(chalk.red('Error: JPG quality level must be between 0-100.'));
  process.exit(1);
}
if (isNaN(pngQuality) || pngQuality < 0 || pngQuality > 100) {
  console.error(chalk.red('Error: PNG quality level must be between 0-100.'));
  process.exit(1);
}

// Parse ignore patterns
const ignorePatterns = options.ignore ? options.ignore.split(',').map((p) => p.trim()) : [];

// Process resize options
let resizeOptions = null;

if (options.sizes) {
  // Using multiple sizes
  const sizes = options.sizes.split(',').map((size) => {
    const parsed = parseInt(size.trim(), 10);
    if (isNaN(parsed) || parsed <= 0) {
      console.error(chalk.red(`Error: Invalid size value: ${size}`));
      process.exit(1);
    }
    return parsed;
  });

  resizeOptions = {
    sizes,
    suffixPattern: options.suffixPattern,
    mode: options.resizeMode,
  };
} else if (options.resize) {
  // Using single size (width x height)
  const dimensions = options.resize.split('x');
  if (dimensions.length !== 2 || isNaN(parseInt(dimensions[0])) || isNaN(parseInt(dimensions[1]))) {
    console.error(
      chalk.red('Error: Invalid resize format. Correct format: WIDTHxHEIGHT (e.g. 800x600)'),
    );
    process.exit(1);
  }

  resizeOptions = {
    width: parseInt(dimensions[0]),
    height: parseInt(dimensions[1]),
    mode: options.resizeMode,
  };
} else if (options.maxWidth || options.maxHeight) {
  // Using maximum size
  resizeOptions = {};

  if (options.maxWidth) {
    const maxWidth = parseInt(options.maxWidth, 10);
    if (isNaN(maxWidth) || maxWidth <= 0) {
      console.error(chalk.red('Error: Maximum width must be a positive number.'));
      process.exit(1);
    }
    resizeOptions.maxWidth = maxWidth;
  }

  if (options.maxHeight) {
    const maxHeight = parseInt(options.maxHeight, 10);
    if (isNaN(maxHeight) || maxHeight <= 0) {
      console.error(chalk.red('Error: Maximum height must be a positive number.'));
      process.exit(1);
    }
    resizeOptions.maxHeight = maxHeight;
  }
}

console.log(chalk.blue('Optiweb starting...'));
console.log(chalk.gray(`Input folder: ${inputDir}`));
console.log(chalk.gray(`Output folder: ${outputDir}`));
console.log(chalk.gray(`WebP conversion: ${options.webp ? 'Yes' : 'No'}`));
console.log(chalk.gray(`General quality level: ${quality}`));
console.log(chalk.gray(`JPG quality level: ${jpgQuality}`));
console.log(chalk.gray(`PNG quality level: ${pngQuality}`));
console.log(chalk.gray(`Skip existing files: ${options.skipExisting ? 'Yes' : 'No'}`));
console.log(chalk.gray(`Verbose output: ${options.verbose ? 'Yes' : 'No'}`));
console.log(chalk.gray(`Only resize: ${options.onlyResize ? 'Yes' : 'No'}`));
console.log(chalk.gray(`Slugify filenames: ${options.slug ? 'Yes' : 'No'}`));

if (ignorePatterns.length > 0) {
  console.log(chalk.gray(`Ignore patterns: ${ignorePatterns.join(', ')}`));
}

// Display resize information
if (resizeOptions) {
  if (resizeOptions.sizes) {
    console.log(
      chalk.gray(
        `Multi-size resize: ${resizeOptions.sizes.join(', ')} (mode: ${options.resizeMode})`,
      ),
    );
    console.log(chalk.gray(`Suffix pattern: ${options.suffixPattern}`));
  } else if (resizeOptions.width && resizeOptions.height) {
    console.log(
      chalk.gray(
        `Resize dimensions: ${resizeOptions.width}x${resizeOptions.height} (mode: ${options.resizeMode})`,
      ),
    );
  } else {
    if (resizeOptions.maxWidth) {
      console.log(chalk.gray(`Maximum width: ${resizeOptions.maxWidth}px`));
    }
    if (resizeOptions.maxHeight) {
      console.log(chalk.gray(`Maximum height: ${resizeOptions.maxHeight}px`));
    }
  }
}

// Start optimization process
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
  webpNearLossless: options.webpNearLossless,
  slug: options.slug,
})
  .then((results) => {
    console.log(chalk.green('\n✅ Optimization completed!'));
    console.log(chalk.gray(`Total files processed: ${results.totalFiles}`));
    console.log(chalk.gray(`Number of optimized images: ${results.optimizedImages}`));
    if (results.resizedImages > 0) {
      console.log(chalk.gray(`Number of resized images: ${results.resizedImages}`));
    }
    if (results.multiSizeImages > 0) {
      console.log(chalk.gray(`Number of multi-size processed images: ${results.multiSizeImages}`));
    }
    if (results.skippedImages > 0) {
      console.log(
        chalk.gray(`Number of images skipped due to WebP version: ${results.skippedImages}`),
      );
    }
    if (results.ignoredFiles > 0) {
      console.log(chalk.gray(`Number of ignored files: ${results.ignoredFiles}`));
    }
    console.log(chalk.gray(`Number of other copied files: ${results.copiedFiles}`));

    if (results.totalSaved > 0) {
      const savedInMB = (results.totalSaved / (1024 * 1024)).toFixed(2);
      console.log(chalk.green(`Total space saved: ${savedInMB} MB`));
      const reductionPercentage = ((results.totalSaved / results.totalSize) * 100).toFixed(2);
      console.log(chalk.green(`Total reduction rate: %${reductionPercentage}`));
    }
  })
  .catch((err) => {
    console.error(chalk.red('Error:', err.message));
    process.exit(1);
  });
