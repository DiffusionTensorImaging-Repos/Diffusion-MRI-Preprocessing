---
sidebar_position: 2
title: "FSL (FMRIB Software Library)"
---

# FSL — FMRIB Software Library

## Overview

FSL is the backbone of the DTI preprocessing pipeline. Developed by the Analysis Group at the [Oxford Centre for Functional MRI of the Brain (FMRIB)](https://www.win.ox.ac.uk/), FSL provides the core tools for distortion correction, eddy current correction, brain extraction, tensor fitting, registration, and fiber orientation estimation.

You will use FSL commands in **11 of the 14 pipeline stages** — it is the single most important piece of software for DTI preprocessing.

**Official Site**: [https://fsl.fmrib.ox.ac.uk/fsl/fslwiki](https://fsl.fmrib.ox.ac.uk/fsl/fslwiki)

## Installation

### Option 1: FSLInstaller.py (Recommended)

The official installer handles dependencies and environment setup automatically.

1. Download `FSLInstaller.py` from the [FSL Installation page](https://fsl.fmrib.ox.ac.uk/fsl/fslwiki/FslInstallation)
2. Run it:

```bash
python3 FSLInstaller.py
# Follow the prompts
# Default install location: /usr/local/fsl
```

3. The installer will add environment setup to your shell profile. Open a new terminal or source it:

```bash
source ~/.bashrc
```

### Option 2: NeuroDebian (Debian/Ubuntu)

```bash
# Add the NeuroDebian repository
# See https://neuro.debian.net/ for your specific OS version
sudo apt-get install fsl-complete

# Source the FSL environment
echo 'source /usr/share/fsl/6.0/etc/fslconf/fsl.sh' >> ~/.bashrc
source ~/.bashrc
```

### Option 3: conda

```bash
conda install -c conda-forge fsl
```

The conda distribution of FSL may not include all tools (e.g., `eddy_cuda`, `bedpostx_gpu`). For a complete installation, use the official installer.

### Option 4: Docker

```bash
docker pull brainlife/fsl:6.0.7

# Run FSL commands inside the container
docker run -v /path/to/data:/data brainlife/fsl:6.0.7 \
    flirt -version
```

## Environment Variables

FSL requires three environment variables. These are usually set automatically by the installer, but if you installed manually, add them to your shell profile:

```bash
# Add to ~/.bashrc or ~/.zshrc
export FSLDIR="/usr/local/fsl"           # Where FSL is installed
source $FSLDIR/etc/fslconf/fsl.sh        # Load FSL configuration
export FSLOUTPUTTYPE="NIFTI_GZ"          # Output compressed NIfTI
export PATH="$FSLDIR/bin:$PATH"          # Make FSL commands available
```

**Why `FSLOUTPUTTYPE` matters**: By default, FSL outputs uncompressed `.nii` files. Setting `FSLOUTPUTTYPE="NIFTI_GZ"` produces `.nii.gz` files, saving significant disk space (DTI data can be many gigabytes per subject).

## Verify Installation

```bash
# Check FSLDIR is set
echo $FSLDIR
# Expected: /usr/local/fsl (or your install path)

# Check version
flirt -version
# Expected: FLIRT version 6.0 (or similar)

# Check key commands exist
which eddy topup bet fslmaths dtifit bedpostx flirt fslroi fslmerge
```

## Key Commands Used in This Pipeline

| Command | Pipeline Stage | What It Does |
|---------|---------------|--------------|
| `fslroi` | [B0 Concatenation](../pipeline/b0-concatenation) | Extracts specific volumes from a 4D image (e.g., the first B0 volume) |
| `fslmerge` | [B0 Concatenation](../pipeline/b0-concatenation) | Concatenates volumes along the time axis |
| `topup` | [TOPUP](../pipeline/topup) | Estimates and corrects susceptibility-induced distortions using opposite phase-encoded B0 images |
| `fslmaths` | [Mean B0](../pipeline/mean-b0) | Arithmetic operations on images (averaging, thresholding, masking) |
| `bet` | [Brain Masking](../pipeline/brain-masking) | Brain extraction — removes skull and non-brain tissue |
| `eddy` | [Eddy Correction](../pipeline/eddy) | Corrects eddy current distortions and head motion simultaneously |
| `dtifit` | [Tensor Fitting](../pipeline/dtifit) | Fits the diffusion tensor model to produce FA, MD, AD, RD maps |
| `flirt` | [Registration](../pipeline/flirt-registration) | Linear (affine) registration between images |
| `convert_xfm` | [Registration](../pipeline/flirt-registration) | Concatenates or inverts transformation matrices |
| `bedpostx` | [BedpostX](../pipeline/bedpostx) | Bayesian estimation of fiber orientations (for tractography) |
| `fslstats` | [ICV Calculation](../pipeline/icv-calculation) | Computes statistics from an image (volume, mean, etc.) |
| `eddy_quad` | [Eddy QC](../qc/eddy-qc) | Per-subject quality control for eddy output |
| `eddy_squad` | [Eddy QC](../qc/eddy-qc) | Group-level quality control summary |

## FSLeyes — Visual Quality Control

FSLeyes is FSL's image viewer. You will use it at nearly every pipeline stage to visually check your results. It is installed separately from FSL.

### Installing FSLeyes

```bash
# Recommended: install via conda in its own environment
conda create -n fsleyes python=3.11
conda activate fsleyes
conda install -c conda-forge fsleyes

# Alternative: pip
pip install fsleyes
```

### Basic Usage

```bash
# Open a single image
fsleyes image.nii.gz &

# Overlay two images (e.g., brain mask on structural)
fsleyes structural.nii.gz mask.nii.gz -cm blue -a 30 &

# Compare before/after (e.g., pre- and post-TOPUP B0)
fsleyes pre_topup_b0.nii.gz post_topup_b0.nii.gz -cm red-yellow &

# View FA map over MNI template
fsleyes $FSLDIR/data/standard/MNI152_T1_2mm_brain.nii.gz \
        FA_in_MNI.nii.gz -cm red-yellow -a 50 &
```

### Useful FSLeyes Flags

| Flag | Purpose | Example |
|------|---------|---------|
| `-cm` | Color map | `-cm red-yellow`, `-cm blue`, `-cm hot` |
| `-a` | Opacity (0–100) | `-a 50` (50% transparent) |
| `-dr` | Display range | `-dr 0 1` (useful for FA maps) |
| `&` | Run in background | Frees up your terminal |

### macOS vs Linux

- **Linux**: FSLeyes works out of the box with X11
- **macOS**: Requires a working Python environment (conda recommended). If you are SSHing to a Linux machine, you need [XQuartz](https://www.xquartz.org/) for X11 forwarding
- **Remote display**: Use `ssh -XY` to forward the FSLeyes window

## Version Guidance

We recommend **FSL 6.0.x** (6.0.5 or later). Major features relevant to DTI:

- **6.0.5+**: Improved `eddy` with `--repol` (outlier slice replacement) and `--cnr_maps`
- **6.0.4+**: `eddy_quad` and `eddy_squad` for automated QC
- **6.0.0+**: Modernized `topup` and `eddy` implementations

Check your version:

```bash
cat $FSLDIR/etc/fslversion
```

## References

- Jenkinson M, Beckmann CF, Behrens TEJ, Woolrich MW, Smith SM (2012). FSL. *NeuroImage*, 62(2), 782-790.
- Smith SM, et al. (2004). Advances in functional and structural MR image analysis and implementation as FSL. *NeuroImage*, 23(S1), 208-219.
- [FSL Wiki](https://fsl.fmrib.ox.ac.uk/fsl/fslwiki) — Official documentation
- [FSL Course](https://fsl.fmrib.ox.ac.uk/fslcourse/) — Free online course materials from FMRIB
