---
sidebar_position: 5
title: "dcm2niix"
---

# dcm2niix

## Overview

dcm2niix is a command-line tool that converts DICOM medical imaging files into the NIfTI format. Developed by Chris Rorden at the University of South Carolina, it is the standard tool for DICOM-to-NIfTI conversion in the neuroimaging community.

dcm2niix handles the complexities of DICOM format across scanner vendors (Siemens, GE, Philips) and automatically extracts the gradient tables and acquisition metadata that downstream diffusion processing tools require.

**GitHub**: [https://github.com/rordenlab/dcm2niix](https://github.com/rordenlab/dcm2niix)

## Installation

### Option 1: conda (Easiest)

```bash
conda install -c conda-forge dcm2niix
```

### Option 2: Pre-built Binary

Download the latest release for your platform from the [GitHub releases page](https://github.com/rordenlab/dcm2niix/releases). Extract the binary and place it somewhere on your PATH:

```bash
# Example for Linux
wget https://github.com/rordenlab/dcm2niix/releases/latest/download/dcm2niix_lnx.zip
unzip dcm2niix_lnx.zip
sudo mv dcm2niix /usr/local/bin/
```

### Option 3: apt (Ubuntu/Debian)

```bash
# Via NeuroDebian
sudo apt-get install dcm2niix

# Or from the standard Ubuntu repos (may be an older version)
sudo apt-get install dcm2niix
```

### Option 4: Build from Source

```bash
git clone https://github.com/rordenlab/dcm2niix.git
cd dcm2niix
mkdir build && cd build
cmake ..
make
sudo make install
```

## Verify Installation

```bash
dcm2niix --version
# Expected: something like "v1.0.20230411"

dcm2niix -h
# Shows full help with all flags
```

## Basic Usage

### Single Subject Conversion

```bash
# Convert all DICOMs in a directory
dcm2niix -o "$output_dir" -f "${subj}_%p" -z y -b y "$dicom_dir"
```

This produces:
- `.nii.gz` — the NIfTI image volume
- `.json` — metadata sidecar (acquisition parameters)
- `.bval` — b-values (for diffusion scans only)
- `.bvec` — gradient directions (for diffusion scans only)

### Converting Specific Scan Types

In a typical DTI study, you need to convert multiple scan types per subject. Use the `-f` flag to control output naming and organize by scan type. See [Step 1: DICOM to NIfTI](../pipeline/dicom-to-nifti) for a complete batch conversion script.

## Key Flags

| Flag | Purpose | Example | Notes |
|------|---------|---------|-------|
| `-o` | Output directory | `-o /data/nifti/sub-001` | Created automatically if it doesn't exist |
| `-f` | Output filename format | `-f "%n_%p_%s"` | Supports variables (see below) |
| `-z` | Compression | `-z y` | `y` = gzip, `n` = uncompressed |
| `-b` | BIDS sidecar | `-b y` | Generate JSON metadata file |
| `-ba` | Anonymize sidecar | `-ba y` | Removes patient name/ID from JSON |
| `-p` | Philips scaling | `-p y` | Apply Philips precise scaling |

### Filename Format Variables

The `-f` flag supports several variables that are substituted from DICOM metadata:

| Variable | Meaning | Example Value |
|----------|---------|---------------|
| `%p` | Protocol name | `DWI_64dir` |
| `%s` | Series number | `5` |
| `%n` | Patient name | `sub-001` |
| `%d` | Series description | `ep2d_diff_b1000` |
| `%t` | Date-time | `20240115120000` |

A common naming pattern:

```bash
# Simple: subject + protocol
dcm2niix -f "${subj}_%p" ...

# More explicit: subject + custom label
dcm2niix -f "${subj}_dti" ...
```

## Output Files Explained

### JSON Sidecar — Why It Matters for DTI

The `.json` sidecar file contains acquisition parameters extracted from DICOM headers. Several fields are critical for later preprocessing steps:

| JSON Field | Used By | Why |
|------------|---------|-----|
| `PhaseEncodingDirection` | TOPUP, eddy | Tells the tools which direction distortions occur |
| `TotalReadoutTime` | TOPUP, eddy | Needed to estimate distortion magnitude |
| `EchoTime` | eddy | Used in signal modeling |
| `RepetitionTime` | General | Scan timing information |
| `SliceTiming` | eddy (`--slspec`) | Required for slice-to-volume correction |
| `MultibandAccelerationFactor` | eddy | Informs slice timing model |

After conversion, open one of your DWI `.json` files and verify that `PhaseEncodingDirection` and `TotalReadoutTime` are present. If they are missing, TOPUP and eddy will not work correctly. Missing fields usually mean dcm2niix could not parse them from your DICOM headers — see [Common Issues](#common-issues) below.

### .bval and .bvec Files

For diffusion-weighted scans, dcm2niix extracts:

- **`.bval`** — a single row of b-values, one per volume. Example:
  ```
  0 1000 1000 1000 0 1000 1000 ...
  ```

- **`.bvec`** — three rows (x, y, z) of gradient directions, one column per volume. Example:
  ```
  0 0.1 0.7 -0.3 0 0.5 ...
  0 0.9 0.2  0.8 0 0.1 ...
  0 0.4 0.7 -0.5 0 0.8 ...
  ```

These files are in **FSL format** and are directly usable by `eddy`, `dtifit`, and other FSL tools.

## Figuring Out Your DICOM Organization

The biggest challenge in DICOM conversion is often figuring out which folders contain which scan types. Scanner vendors use wildly different naming conventions, and scan operators may change names between subjects.

### Strategy 1: List One Subject's Directories

```bash
ls /path/to/dicoms/sub-001/
# Look for names that suggest:
#   T1/structural: MPRAGE, T1w, 3D_T1, anat, BRAVO, TFE
#   DWI: DWI, DTI, ep2d_diff, cmrr_mbdiff, dMRI
#   Fieldmaps: FieldMap, SpinEcho, SE_AP, SE_PA, B0map
```

### Strategy 2: Dry-Run Conversion

Run dcm2niix in "print only" mode to see what it detects without actually converting:

```bash
dcm2niix -b o -f "%p_%s" /path/to/one/subject/dicoms/
```

This prints protocol names and series descriptions, helping you identify which folders contain which scan types.

### Strategy 3: Inspect DICOM Headers

If you need more detail, inspect the DICOM headers directly:

```bash
# Using dcm2niix's built-in header dump
dcm2niix -b o /path/to/one/folder/

# Using dcmdump (from DCMTK package)
dcmdump /path/to/single/dicom/file.dcm | grep -i "protocol\|series\|description"
```

## Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| **No .bval/.bvec files produced** | Non-diffusion scan, or DICOM lacks gradient info | Check that the input is actually a DWI scan; try a different DICOM folder |
| **Missing PhaseEncodingDirection in JSON** | Scanner did not write this field; or dcm2niix version is old | Update dcm2niix to the latest version; check scanner console for the PE direction and add it manually to the JSON |
| **Missing TotalReadoutTime in JSON** | Some scanners/protocols don't expose this | Calculate it from other parameters — see [Step 4: TOPUP](../pipeline/topup) for the formula |
| **Duplicate outputs (file_a, file_b)** | Same scan acquired twice (e.g., repeat due to motion) | dcm2niix appends `_a`, `_b` suffixes; choose the better run based on visual quality |
| **Philips data looks wrong** | Philips uses different scaling conventions | Try `-p y` for precise scaling, or `-p n` |
| **PAR/REC files instead of DICOM** | Philips export format | dcm2niix handles PAR/REC files too — point it at the directory containing `.par`/`.rec` files |
| **Wrong orientation** | Rare issue with certain scanner/software versions | Update dcm2niix; verify orientation visually in FSLeyes (the anterior commissure should be at the center in standard orientation) |

## References

- Li X, Morgan PS, Ashburner J, Smith J, Rorden C (2016). The first step for neuroimaging data analysis: DICOM to NIfTI conversion. *Journal of Neuroscience Methods*, 264, 47-56.
- [dcm2niix GitHub](https://github.com/rordenlab/dcm2niix) — Source code, documentation, and issue tracker
- [BIDS Specification](https://bids-specification.readthedocs.io/) — Standard for organizing neuroimaging data
- [Chris Rorden's dcm2niix Wiki](https://www.nitrc.org/plugins/mwiki/index.php/dcm2nii:MainPage) — Detailed usage notes
