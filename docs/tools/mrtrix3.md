---
sidebar_position: 4
title: "MRtrix3"
---

# MRtrix3

## Overview

MRtrix3 is an open-source software package designed specifically for diffusion MRI analysis. It provides tools for denoising, artifact correction, fiber orientation estimation, and tractography. In this pipeline, MRtrix3 is used for three preprocessing steps:

1. **Denoising** — removing thermal noise from diffusion data using MP-PCA
2. **Gibbs ringing correction** — removing ringing artifacts caused by Fourier truncation
3. **Shell extraction** — isolating specific b-value shells for targeted analysis

MRtrix3 also provides powerful visualization (`mrview`) and advanced diffusion modeling tools (CSD, tractography) that go well beyond what FSL offers, making it a valuable companion for the DTI pipeline.

**Official Site**: [https://www.mrtrix.org/](https://www.mrtrix.org/)
**Documentation**: [https://mrtrix.readthedocs.io/](https://mrtrix.readthedocs.io/)
**GitHub**: [https://github.com/MRtrix3/mrtrix3](https://github.com/MRtrix3/mrtrix3)

## Installation

### Option 1: conda (Recommended)

The easiest and most reliable installation method:

```bash
conda install -c mrtrix3 mrtrix3
```

This installs all command-line tools. To also get the GUI viewer (`mrview`), you need Qt5 — conda handles this automatically.

### Option 2: Build from Source

Building from source is straightforward and gives you the latest features:

```bash
# Prerequisites (Ubuntu/Debian)
sudo apt-get install git g++ python3 libeigen3-dev zlib1g-dev \
    libqt5opengl5-dev libqt5svg5-dev libfftw3-dev libtiff5-dev libpng-dev

# Clone and build
git clone https://github.com/MRtrix3/mrtrix3.git
cd mrtrix3
./configure
./build

# Add to PATH
echo 'export PATH="/path/to/mrtrix3/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

:::info Qt5 is Optional
The Qt5 packages (`libqt5opengl5-dev`, `libqt5svg5-dev`) are only needed for `mrview` (MRtrix3's image viewer). If you plan to use FSLeyes for visualization instead, you can skip Qt5 and build without the GUI:

```bash
./configure -nogui
./build
```
:::

### Option 3: apt (Ubuntu/Debian)

```bash
# Via NeuroDebian
sudo apt-get install mrtrix3
```

### Option 4: Docker / Singularity

```bash
# Singularity (HPC)
singularity pull docker://mrtrix3/mrtrix3:latest

# Docker
docker pull mrtrix3/mrtrix3:latest
```

## Verify Installation

```bash
# Check core commands
dwidenoise --version
mrdegibbs --version
dwiextract --help
mrinfo --version

# If you installed the GUI
mrview --version
```

All MRtrix3 commands follow a consistent pattern — they accept NIfTI (`.nii.gz`) input directly and produce NIfTI output, so they integrate seamlessly with FSL-based workflows.

## Key Commands Used in This Pipeline

### dwidenoise

**Pipeline stage**: [Step 7: Denoising & Gibbs Correction](../pipeline/denoising-gibbs)

Removes thermal noise from diffusion-weighted images using the Marchenko-Pastur Principal Component Analysis (MP-PCA) method. This is a mathematically principled denoising approach — it separates signal from noise using random matrix theory rather than spatial blurring.

```bash
dwidenoise input_dwi.nii.gz output_denoised.nii.gz \
    -fslgrad input.bvec input.bval \
    -noise noise_map.nii.gz
```

| Flag | Purpose |
|------|---------|
| `-fslgrad bvec bval` | Provide gradient information in FSL format |
| `-noise` | Output the estimated noise map (useful for QC) |

:::caution Order Matters
`dwidenoise` must be run **before** any other processing (including Gibbs correction). The MP-PCA noise estimation requires unmodified data — any prior filtering corrupts the noise statistics.
:::

### mrdegibbs

**Pipeline stage**: [Step 7: Denoising & Gibbs Correction](../pipeline/denoising-gibbs)

Removes Gibbs ringing artifacts — oscillating bright and dark bands that appear near sharp tissue boundaries (e.g., the cortical surface). These artifacts are caused by truncation of the Fourier series during image reconstruction.

```bash
mrdegibbs denoised_dwi.nii.gz degibbs_dwi.nii.gz
```

No additional flags are typically needed. Run this **after** denoising.

### dwiextract

**Pipeline stage**: [Shell Extraction](../pipeline/shell-extraction)

Extracts volumes corresponding to a specific b-value shell from multi-shell diffusion data.

```bash
# Extract only b=0 and b=1000 volumes
dwiextract input.nii.gz output_b1000.nii.gz \
    -fslgrad input.bvec input.bval \
    -shells 0,1000 \
    -export_grad_fsl output.bvec output.bval
```

| Flag | Purpose |
|------|---------|
| `-shells` | Comma-separated list of b-values to extract |
| `-export_grad_fsl` | Export updated .bvec/.bval for the extracted subset |
| `-fslgrad` | Input gradient files in FSL format |

### mrinfo

A utility command for inspecting image metadata — useful for debugging and verification:

```bash
# Show image dimensions, voxel size, etc.
mrinfo image.nii.gz

# Show just the b-value shells present in the data
mrinfo dwi.nii.gz -fslgrad dwi.bvec dwi.bval -shell_bvalues

# Show the number of volumes
mrinfo dwi.nii.gz -size
```

### mrconvert

Converts between image formats and can modify metadata:

```bash
# Convert between formats
mrconvert input.mif output.nii.gz

# NIfTI to MRtrix format (preserving gradient info)
mrconvert input.nii.gz output.mif -fslgrad input.bvec input.bval
```

## MRtrix3 Image Formats

MRtrix3 has its own image format (`.mif`) that embeds gradient information and other metadata directly in the file header. However, **you do not need to use .mif format** — all MRtrix3 commands accept NIfTI (`.nii.gz`) input and output, which keeps your pipeline compatible with FSL.

When using NIfTI files with MRtrix3 commands, just pass the gradient information explicitly with `-fslgrad bvec bval`.

## mrview — MRtrix3 Viewer

If you installed MRtrix3 with Qt5, you have access to `mrview`, a powerful image viewer with built-in diffusion visualization tools:

```bash
# View an image
mrview image.nii.gz

# View DWI with gradient directions overlaid
mrview dwi.nii.gz -odf.load_sh csd_output.mif
```

`mrview` is particularly useful for visualizing tractography results and fiber orientation distributions. For routine QC of NIfTI images, FSLeyes is equally effective and may be more familiar.

## Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| `./configure` fails with "Eigen not found" | Missing Eigen3 library | `sudo apt-get install libeigen3-dev` |
| `mrview` crashes or won't open | Qt5 not installed or display issue | Install Qt5 packages, or use FSLeyes instead |
| "No DW encoding found" | Gradient info not provided | Add `-fslgrad file.bvec file.bval` |
| Shell extraction returns wrong volumes | b-values not exact integers (e.g., 998 instead of 1000) | MRtrix3 groups b-values within a tolerance — use `mrinfo -shell_bvalues` to check detected shells |
| Command not found after build | bin directory not on PATH | Add the `bin/` directory inside your MRtrix3 clone to PATH |

## References

- Tournier JD, Smith R, Raffelt D, et al. (2019). MRtrix3: A fast, flexible and open software framework for medical image processing and visualisation. *NeuroImage*, 202, 116137.
- Veraart J, Novikov DS, Christiaens D, Ades-Aron B, Sijbers J, Fieremans E (2016). Denoising of diffusion MRI using random matrix theory. *NeuroImage*, 142, 394-406.
- Kellner E, Dhital B, Kiselev VG, Reisert M (2016). Gibbs-ringing artifact removal based on local subvoxel-shifts. *Magnetic Resonance in Medicine*, 76(5), 1574-1581.
- [MRtrix3 Documentation](https://mrtrix.readthedocs.io/) — Complete command reference and tutorials
