# optiweb

[![npm version](https://img.shields.io/npm/v/optiweb.svg)](https://www.npmjs.com/package/optiweb)
[![MIT License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

A powerful CLI image optimization tool compliant with Google PageSpeed standards. Supports WebP, multiple sizes, responsive images, and lossless/nearLossless modes.

## Features

- Optimizes JPG and PNG images according to PageSpeed standards
- Optionally converts images to WebP format
- Provides optimal compression while preserving quality
- Preserves folder structure and outputs to the same structure
- Copies non-image files as-is
- If a WebP file with the same name exists, only the WebP is copied (JPG/PNG is skipped)
- Option to ignore specific files or folders
- Ability to resize images to specific or maximum dimensions
- Generate multiple outputs in different sizes from a single image (responsive images)
- CLI options for WebP lossless and nearLossless modes

## Installation

```bash
npm install -g optiweb
```

For local development:

```bash
git clone https://github.com/yourusername/optiweb.git
cd optiweb
npm install
npm link
```

## Usage

Basic usage:

```bash
optiweb --input <input-folder> --output <output-folder>
```

All options:

```bash
optiweb --input <input-folder> --output <output-folder> [options]
```

### Options

| Option                  | Description                                              | Default  |
| ----------------------- | -------------------------------------------------------- | -------- |
| `--input`, `-i`         | Input folder (required)                                  | -        |
| `--output`, `-o`        | Output folder (required)                                 | -        |
| `--webp`, `-w`          | Convert to WebP format                                   | false    |
| `--quality`, `-q`       | General quality level (0-100)                            | 85       |
| `--jpg-quality`         | Quality for JPG (0-100)                                  | 85       |
| `--png-quality`         | Quality for PNG (0-100)                                  | 85       |
| `--webp-lossless`       | Enable WebP lossless mode                                | false    |
| `--webp-near-lossless`  | Enable WebP nearLossless mode                            | false    |
| `--skip-existing`, `-s` | Skip files that already exist                            | false    |
| `--verbose`, `-v`       | Verbose output                                           | false    |
| `--ignore <patterns>`   | Ignore file/folder patterns (comma-separated glob)       | -        |
| `--resize <dimensions>` | Resize to fixed size (e.g. 800x600)                      | -        |
| `--resize-mode <mode>`  | Resize mode                                              | cover    |
| `--max-width <width>`   | Maximum width, proportional resize                       | -        |
| `--max-height <height>` | Maximum height, proportional resize                      | -        |
| `--sizes <sizes>`       | Multiple sizes (comma-separated, e.g. 180,300,500)       | -        |
| `--suffix-pattern <p>`  | Suffix pattern for file names                            | -{width} |
| `--only-resize`         | Only resize, do not optimize                             | false    |
| `--slug`                | Convert file names to slug format (lowercase, no spaces) | false    |
| `--help`, `-h`          | Show help                                                | -        |

### Examples

Optimize JPG and PNG files:

```bash
optiweb --input ./images --output ./optimized
```

Optimize and convert to WebP:

```bash
optiweb --input ./images --output ./optimized --webp
```

Use higher quality:

```bash
optiweb --input ./images --output ./optimized --quality 90
```

Ignore specific files and folders:

```bash
optiweb --input ./images --output ./optimized --ignore "node_modules/**,*.svg,temp/*"
```

Resize images to a specific size:

```bash
optiweb --input ./images --output ./optimized --resize 800x600
```

Limit maximum width (keep aspect ratio):

```bash
optiweb --input ./images --output ./optimized --max-width 1200
```

Resize and convert to WebP:

```bash
optiweb --input ./images --output ./optimized --resize 800x600 --webp
```

Generate responsive images in multiple sizes:

```bash
optiweb --input ./images --output ./optimized --sizes "200,400,800,1200" --webp
```

Use a custom suffix pattern for multi-size output:

```bash
optiweb --input ./images --output ./optimized --sizes "200,400,800" --suffix-pattern "_w{width}"
```

Only resize, do not optimize:

```bash
optiweb --input ./images --output ./optimized --sizes "200,400,800" --only-resize
```

Use WebP lossless and nearLossless modes:

```bash
optiweb --input ./images --output ./optimized --webp --webp-lossless --webp-near-lossless
```

### Resize Modes

Available values for `--resize-mode`:

- `cover`: Fills the target size, cropping if necessary (default)
- `contain`: Fits the image within the target size, may add padding
- `fill`: Stretches the image to fill the target size, may distort aspect ratio
- `inside`: Fits the image inside the target size
- `outside`: Fills the target size from the outside

### Suffix Pattern

The `--suffix-pattern` option determines how the size is added to the file name. The default is "-{width}", which appends the width to the file name:

- `logo.png` → `logo-200.png`, `logo-400.png`, etc.

Other examples:

- `--suffix-pattern "_w{width}"` → `logo_w200.png`, `logo_w400.png`, etc.
- `--suffix-pattern "@{width}x"` → `logo@200x.png`, `logo@400x.png`, etc.

## How It Works

1. Scans all files in the input folder
2. Ignores files matching the ignore patterns
3. Skips JPG/PNG files if a WebP with the same name exists
4. Detects JPG and PNG files
5. If multi-size is requested, generates outputs for each specified size
6. If single-size is requested, resizes images to the specified dimensions
7. Uses the Sharp library to optimize files (unless only resizing)
8. Converts to WebP if the option is enabled
9. Saves results to the output folder, preserving the input folder structure
10. Copies non-image files directly

## Performance

This tool uses optimization methods recommended by Google PageSpeed Insights:

- MozJPEG algorithm for JPG files
- Optimum compression for PNG files
- Quality/size optimization for WebP

## Requirements

- Node.js 14.0 or higher

## License

MIT
