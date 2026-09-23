---
sidebar_position: 3
title: "ANTs (Advanced Normalization Tools)"
---

# ANTs — Advanced Normalization Tools

## Overview

ANTs (Advanced Normalization Tools) is an open-source software suite for image registration and segmentation, developed at the University of Pennsylvania. In the DTI pipeline, ANTs is used for two key tasks:

1. **Brain extraction** (skull stripping) of T1 structural images — using a template-based approach that is more accurate than simpler methods
2. **Tissue segmentation** — classifying voxels into CSF, gray matter, and white matter (used for ICV calculation)

ANTs is not used in every pipeline stage, but the brain extraction it produces in [Step 2](../pipeline/skull-stripping) is a critical input for later registration steps.

**GitHub**: [https://github.com/ANTsX/ANTs](https://github.com/ANTsX/ANTs)

## Installation

### Option 1: Pre-built Binaries (Recommended)

The easiest installation method — no compiling required.

1. Go to the [ANTs Releases page](https://github.com/ANTsX/ANTs/releases)
2. Download the archive for your platform (e.g., `ants-2.5.1-centos7-X64-gcc.zip` for Linux)
3. Extract to a permanent location:

```bash
# Download (check releases page for latest version)
wget https://github.com/ANTsX/ANTs/releases/download/v2.5.1/ants-2.5.1-centos7-X64-gcc.zip

# Extract
unzip ants-2.5.1-centos7-X64-gcc.zip -d /opt/

# Add to your shell profile
echo 'export ANTSPATH="/opt/ants-2.5.1/bin"' >> ~/.bashrc
echo 'export PATH="$ANTSPATH:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### Option 2: conda

```bash
conda install -c aramislab ants
# or
conda install -c conda-forge ants
```

conda packages may lag behind official releases. Verify that `antsBrainExtraction.sh` is included — some minimal packages omit the shell scripts.

### Option 3: Build from Source

Building ANTs from source gives you the latest features but takes **1–2 hours** and requires significant RAM (~8 GB).

```bash
# Prerequisites
sudo apt-get install cmake git build-essential zlib1g-dev

# Clone
git clone https://github.com/ANTsX/ANTs.git
cd ANTs
mkdir build && cd build

# Configure and build
cmake -DCMAKE_INSTALL_PREFIX=/opt/ANTs \
      -DBUILD_TESTING=OFF \
      -DCMAKE_BUILD_TYPE=Release \
      ..
make -j$(nproc)
make install

# Add to PATH
echo 'export ANTSPATH="/opt/ANTs/bin"' >> ~/.bashrc
echo 'export PATH="$ANTSPATH:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

- The build uses a lot of RAM. On systems with less than 16 GB, reduce parallelism: `make -j2` instead of `make -j$(nproc)`
- If cmake fails, check your cmake version: ANTs requires cmake ≥ 3.16. Update with `pip install cmake` or from [cmake.org](https://cmake.org/download/)
- `BUILD_TESTING=OFF` skips the test suite, cutting build time significantly

## Verify Installation

```bash
# Check that key commands are available
which antsBrainExtraction.sh
# Expected: /opt/ANTs/bin/antsBrainExtraction.sh (or your install path)

which Atropos
# Expected: /opt/ANTs/bin/Atropos

# Quick version check
antsRegistration --version
```

## Brain Extraction Templates

ANTs brain extraction (`antsBrainExtraction.sh`) requires a **template** and a **template probability mask**. These tell the algorithm what a "typical brain" looks like so it can identify brain vs. non-brain tissue in your images.

### Downloading Templates

Download templates from the official ANTs figshare repository:
[https://figshare.com/articles/dataset/ANTs_ANTsR_Brain_Templates/915436](https://figshare.com/articles/dataset/ANTs_ANTsR_Brain_Templates/915436)

### Which Template Should I Use?

| Template | Population | Best For |
|----------|-----------|----------|
| **OASIS** | Adults (18–96 years) | General adult neuroimaging studies |
| **NKI** | Adolescents and adults | Studies spanning teenage to adult |
| **MNI/ICBM** | Adults | Standard reference, widely used |
| **NIH Pediatric** | Children (4–18 years) | Pediatric studies — brain shape differs significantly from adults |
| **Study-specific** | Your participants | If you have 20+ subjects, consider building a study-specific template |

Using an adult template on pediatric data (or vice versa) will produce poor brain extractions. If your participants are children, elderly, or a clinical population with atypical brain anatomy, choose a template that matches your population.

### Template File Structure

After downloading, you should have two files per template:

```
OASIS/
  T_template0.nii.gz                  # The template brain image
  T_template0_BrainCerebellumProbabilityMask.nii.gz  # Brain probability mask
```

These are passed to `antsBrainExtraction.sh` with the `-e` (template) and `-m` (mask) flags. See [Step 2: Skull Stripping](../pipeline/skull-stripping) for the full command.

## Key Commands for DTI

### antsBrainExtraction.sh

Used in [Step 2: Skull Stripping](../pipeline/skull-stripping) to remove non-brain tissue from T1 structural images.

```bash
antsBrainExtraction.sh \
    -d 3 \
    -a "$t1_image" \
    -e "$template" \
    -m "$template_mask" \
    -o "$output_prefix"
```

| Flag | Meaning |
|------|---------|
| `-d 3` | 3-dimensional image |
| `-a` | Input anatomical image (your T1) |
| `-e` | Template image |
| `-m` | Template brain probability mask |
| `-o` | Output prefix (produces `*Brain.nii.gz` and `*BrainMask.nii.gz`) |

### Atropos

Used in [ICV Calculation](../pipeline/icv-calculation) for tissue segmentation (CSF, gray matter, white matter).

```bash
Atropos -d 3 \
    -a "$brain_image" \
    -i KMeans[3] \
    -o "$output_prefix" \
    -x "$brain_mask"
```

## Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| `antsBrainExtraction.sh: command not found` | ANTs scripts not on PATH | Add `$ANTSPATH` to PATH, and check that the `Scripts/` directory is also on PATH |
| Brain extraction runs for hours | Normal — ANTs registration is thorough | Expect 20–45 min per subject. Use `nohup` or `tmux` |
| Poor brain extraction | Wrong template for your population | Try a different template; check that the T1 is not corrupted |
| Build fails at cmake | cmake too old | Update cmake: `pip install cmake --upgrade` |
| `ITK: ERROR` during build | Out of memory | Reduce build parallelism: `make -j2` |

## References

- Avants BB, Tustison NJ, Song G, Cook PA, Klein A, Gee JC (2011). A reproducible evaluation of ANTs similarity metric performance in brain image registration. *NeuroImage*, 54(3), 2033-2044.
- Tustison NJ, et al. (2014). Large-scale evaluation of ANTs and FreeSurfer cortical thickness measurements. *NeuroImage*, 99, 166-179.
- [ANTs GitHub Wiki](https://github.com/ANTsX/ANTs/wiki) — Official documentation and examples
