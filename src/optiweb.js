const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');
const glob = require('glob');
const ora = require('ora');
const chalk = require('chalk');
const micromatch = require('micromatch');

/**
 * Processes and optimizes all files in a directory
 * @param {string} inputDir - Input directory path
 * @param {string} outputDir - Output directory path
 * @param {Object} options - Optimization options
 * @returns {Promise<Object>} - Result statistics
 */
async function processDirectory(inputDir, outputDir, options) {
  const spinner = ora('Scanning files...').start();

  // Check if input directory exists
  if (!fs.existsSync(inputDir)) {
    spinner.fail('Input directory not found!');
    throw new Error(`Input directory not found: ${inputDir}`);
  }

  // Create output directory if it doesn't exist
  await fs.ensureDir(outputDir);

  // Find all files
  const allFiles = glob.sync('**/*', { cwd: inputDir, nodir: true, dot: true });

  // Filter ignored files
  let ignoredFiles = [];
  let files = allFiles;

  if (options.ignorePatterns && options.ignorePatterns.length > 0) {
    ignoredFiles = micromatch(allFiles, options.ignorePatterns);
    files = allFiles.filter((file) => !ignoredFiles.includes(file));

    if (options.verbose && ignoredFiles.length > 0) {
      spinner.info(`Ignored file count: ${ignoredFiles.length}`);
      if (options.verbose) {
        ignoredFiles.forEach((file) => {
          spinner.info(`Ignored: ${file}`);
        });
      }
    }
  }

  // Separate WebP files
  const webpFiles = files.filter((file) => path.extname(file).toLowerCase() === '.webp');
  const webpBaseNames = webpFiles.map((file) => path.basename(file, '.webp'));

  spinner.text = `${files.length} files found. Starting processing...`;

  // Result statistics
  const results = {
    totalFiles: files.length,
    optimizedImages: 0,
    resizedImages: 0,
    multiSizeImages: 0,
    copiedFiles: 0,
    skippedImages: 0, // Number of images skipped because a WebP version exists
    ignoredFiles: ignoredFiles.length, // Number of ignored files
    totalSize: 0,
    totalSaved: 0,
    errors: [],
  };

  // Process each file
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const inputFile = path.join(inputDir, file);
    const relativeOutputDir = path.dirname(file);
    const absoluteOutputDir = path.join(outputDir, relativeOutputDir);

    // Apply slug transformation if enabled
    let outputFileName = file;
    if (options.slug) {
      const dirName = path.dirname(file);
      const baseName = path.basename(file);
      const slugifiedName = slugifyFilename(baseName);
      outputFileName = dirName === '.' ? slugifiedName : path.join(dirName, slugifiedName);

      if (options.verbose && baseName !== slugifiedName) {
        spinner.info(`Slugified: ${baseName} -> ${slugifiedName}`);
      }
    }
    const outputFile = path.join(outputDir, outputFileName);

    // Update progress
    spinner.text = `Processing: ${file} (${i + 1}/${files.length})`;

    // Create output directory
    await fs.ensureDir(absoluteOutputDir);

    try {
      // Get file stats
      const stats = await fs.stat(inputFile);
      results.totalSize += stats.size;

      // Skip if file already exists and skipping is enabled
      if (options.skipExisting && fs.existsSync(outputFile)) {
        if (options.verbose) {
          spinner.info(`Skipped (already exists): ${file}`);
        }
        continue;
      }

      // Check file extension
      const ext = path.extname(file).toLowerCase();
      const baseName = path.basename(file, ext);

      if (['.jpg', '.jpeg', '.png'].includes(ext)) {
        // Check if a WebP file with the same name exists
        if (webpBaseNames.includes(baseName)) {
          // Skip PNG/JPG if WebP already exists
          results.skippedImages++;
          if (options.verbose) {
            spinner.info(`Skipped (WebP exists): ${file}`);
          }
          continue;
        }

        // Multi-size processing
        if (options.resize && options.resize.sizes) {
          const sizeResults = await processMultiSizeImage(
            inputFile,
            absoluteOutputDir,
            baseName,
            ext,
            options,
            options.slug ? slugifyFilename(baseName) : baseName,
          );
          results.multiSizeImages++;
          results.optimizedImages += sizeResults.optimizedCount;
          results.totalSaved += sizeResults.totalSaved;

          if (options.verbose) {
            spinner.info(`Multi-size processing: ${file} (${options.resize.sizes.join(', ')})`);
            if (sizeResults.totalSaved > 0) {
              const reduction = ((sizeResults.totalSaved / stats.size) * 100).toFixed(2);
              spinner.info(
                `Total space saved: ${formatBytes(sizeResults.totalSaved)} (-%${reduction})`,
              );
            }
          }
        } else {
          // Optimize image file
          let outputFilePath = outputFile;

          // Convert to WebP if requested
          if (options.webp) {
            // Use slugified basename if slug option is enabled
            const baseNameToUse = options.slug
              ? path.basename(slugifyFilename(baseName))
              : baseName;
            outputFilePath = path.join(absoluteOutputDir, `${baseNameToUse}.webp`);
          }

          // Optimize image
          await optimizeImage(inputFile, outputFilePath, ext, options);

          results.optimizedImages++;
          if (options.resize) {
            results.resizedImages++;
          }

          // Calculate space saved
          const optimizedStats = await fs.stat(outputFilePath);
          const saved = stats.size - optimizedStats.size;
          results.totalSaved += saved;

          if (options.verbose) {
            const reduction = ((saved / stats.size) * 100).toFixed(2);
            spinner.info(`Optimized: ${file} (-%${reduction})`);
          }
        }
      } else {
        // Copy other files as-is
        await fs.copy(inputFile, outputFile);
        results.copiedFiles++;

        if (options.verbose) {
          spinner.info(`Copied: ${file}`);
        }
      }
    } catch (err) {
      results.errors.push({ file, error: err.message });
      spinner.warn(`Error: ${file} - ${err.message}`);
    }
  }

  // Show results
  if (results.errors.length > 0) {
    spinner.warn(`Processing completed with ${results.errors.length} errors.`);
  } else {
    spinner.succeed('All files processed successfully.');
  }

  if (results.skippedImages > 0) {
    spinner.info(
      `Number of images skipped because a WebP version exists: ${results.skippedImages}`,
    );
  }

  return results;
}

/**
 * Processes an image in multiple sizes
 * @param {string} inputFile - Input file path
 * @param {string} outputDir - Output directory path
 * @param {string} baseName - Base file name (without extension)
 * @param {string} ext - File extension
 * @param {Object} options - Optimization options
 */
async function processMultiSizeImage(
  inputFile,
  outputDir,
  baseName,
  ext,
  options,
  slugifiedBaseName = null,
) {
  const image = sharp(inputFile);
  const metadata = await image.metadata();
  const originalStats = await fs.stat(inputFile);
  const originalSize = originalStats.size;

  // Result statistics
  const results = {
    optimizedCount: 0,
    totalSaved: 0,
  };

  // Loop through all sizes
  for (const size of options.resize.sizes) {
    // Create file name with suffix
    const suffixPattern = options.resize.suffixPattern || '-{width}';
    const suffix = suffixPattern.replace('{width}', size);

    // Use the slugified basename if provided
    const baseNameToUse = slugifiedBaseName || baseName;
    const newBaseName = `${baseNameToUse}${suffix}`;

    let outputExt = ext;
    if (options.webp) {
      outputExt = '.webp';
    }

    const outputPath = path.join(outputDir, `${newBaseName}${outputExt}`);

    // Resize image
    let resizedImage = sharp(inputFile).resize({
      width: size,
      height: null, // Maintain aspect ratio, only width specified
      fit: options.resize.mode || 'cover',
      position: 'center',
      withoutEnlargement: true, // Do not enlarge small images
    });

    // Optimize (unless only resizing)
    if (!options.onlyResize) {
      if (options.webp) {
        resizedImage = resizedImage.webp({
          quality: ext === '.png' ? options.pngQuality : options.jpgQuality,
          lossless: options.webpLossless,
          reductionEffort: 6,
          nearLossless: options.webpNearLossless,
        });
      } else if (['.jpg', '.jpeg'].includes(ext)) {
        resizedImage = resizedImage.jpeg({
          quality: options.jpgQuality,
          mozjpeg: true,
          trellisQuantisation: true,
          overshootDeringing: true,
          optimizeScans: true,
        });
      } else if (ext === '.png') {
        resizedImage = resizedImage.png({
          compressionLevel: 9,
          adaptiveFiltering: true,
          palette: true,
        });
      }
    }

    // Save image
    await resizedImage.toFile(outputPath);

    // Calculate space saved
    if (!options.onlyResize) {
      const optimizedStats = await fs.stat(outputPath);
      const saved = Math.max(0, originalSize - optimizedStats.size); // At least 0
      results.totalSaved += saved;
      results.optimizedCount++;

      if (options.verbose) {
        const sizeReduction = ((saved / originalSize) * 100).toFixed(2);
        const outputSizeFormatted = formatBytes(optimizedStats.size);
        console.log(`  → ${newBaseName}${outputExt}: ${outputSizeFormatted} (-%${sizeReduction})`);
      }
    }
  }

  return results;
}

/**
 * Optimizes a single image file
 * @param {string} inputFile - Input file path
 * @param {string} outputFile - Output file path
 * @param {string} ext - File extension
 * @param {Object} options - Optimization options
 */
async function optimizeImage(inputFile, outputFile, ext, options) {
  // Load image with sharp
  let image = sharp(inputFile);

  // Resize if requested
  if (options.resize) {
    if (options.resize.width && options.resize.height) {
      image = image.resize({
        width: options.resize.width,
        height: options.resize.height,
        fit: options.resize.mode || 'cover',
        position: 'center',
      });
    } else {
      const resizeOptions = {};
      if (options.resize.maxWidth) resizeOptions.width = options.resize.maxWidth;
      if (options.resize.maxHeight) resizeOptions.height = options.resize.maxHeight;
      resizeOptions.fit = 'inside';
      resizeOptions.withoutEnlargement = true;
      image = image.resize(resizeOptions);
    }
  }

  if (options.onlyResize) {
    await image.toFile(outputFile);
    return;
  }

  if (['.jpg', '.jpeg'].includes(ext)) {
    if (options.webp) {
      image = image.webp({
        quality: options.jpgQuality,
        lossless: options.webpLossless,
        reductionEffort: 6,
        nearLossless: options.webpNearLossless,
      });
    } else {
      image = image.jpeg({
        quality: options.jpgQuality,
        mozjpeg: true,
        trellisQuantisation: true,
        overshootDeringing: true,
        optimizeScans: true,
      });
    }
  } else if (ext === '.png') {
    if (options.webp) {
      image = image.webp({
        quality: options.pngQuality,
        lossless: options.webpLossless,
        reductionEffort: 6,
        nearLossless: options.webpNearLossless,
      });
    } else {
      image = image.png({
        compressionLevel: 9,
        adaptiveFiltering: true,
        palette: true,
      });
    }
  }

  await image.toFile(outputFile);
}

/**
 * Formats bytes as a human-readable string
 * @param {number} bytes - Size in bytes
 * @returns {string} - Formatted size string
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Converts a filename to slug format
 * @param {string} filename - Original filename
 * @returns {string} - Slugified filename
 */
function slugifyFilename(filename) {
  // Split filename and extension
  const lastDotIndex = filename.lastIndexOf('.');
  const ext = lastDotIndex !== -1 ? filename.slice(lastDotIndex) : '';
  const name = lastDotIndex !== -1 ? filename.slice(0, lastDotIndex) : filename;

  // Convert to lowercase, replace spaces with hyphens, remove special chars
  const slugName = name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .trim() // Remove leading/trailing whitespace
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens

  // Return slugified name with original extension
  return slugName + ext;
}

module.exports = {
  processDirectory,
};
