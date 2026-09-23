---
sidebar_position: 2
title: "Step 1: DICOM to NIfTI Conversion"
---

# Step 1: DICOM to NIfTI Conversion

## Overview

Raw MRI data acquired from the scanner is stored in the **DICOM** (Digital Imaging and Communications in Medicine) format. Most neuroimaging analysis software, however, requires data in the **NIfTI** (Neuroimaging Informatics Technology Initiative) format. This first preprocessing step converts your raw DICOM directories into NIfTI volumes and simultaneously extracts the gradient tables (`.bval` and `.bvec` files) and scan metadata (`.json` sidecar files) needed for downstream diffusion processing.

## Conceptual Background

### DICOM Format

DICOM files contain both **image data** and **metadata** (patient information, acquisition parameters, scanner settings, orientation, etc.). A single MRI acquisition typically produces hundreds or thousands of individual DICOM files, one per image slice or volume.

### NIfTI Format

NIfTI consolidates all image slices from an acquisition into a single 3D or 4D volume file (`.nii` or compressed `.nii.gz`). It stores minimal but essential header information (voxel dimensions, orientation, data type) while discarding extraneous DICOM metadata.

### dcm2niix Over Alternatives

[dcm2niix](https://github.com/rordenlab/dcm2niix) is the standard tool for DICOM-to-NIfTI conversion because it:

- Correctly handles image **orientation** across scanner vendors
- Extracts **diffusion gradient tables** into FSL-compatible `.bval` and `.bvec` files
- Generates **BIDS-compatible JSON sidecar** files containing acquisition parameters (echo time, repetition time, phase encoding direction, total readout time) that are needed for later preprocessing steps
- Supports Siemens, GE, and Philips DICOM formats

## Prerequisites

- **Raw DICOM directories** organized by subject and scan type
- **dcm2niix** installed and available on your `PATH`
  - Install via conda: `conda install -c conda-forge dcm2niix`
  - Or download from: https://github.com/rordenlab/dcm2niix/releases

### Required Scan Types for DTI

A standard DTI preprocessing pipeline requires the following acquisitions per subject:

| Scan Type | Description | Purpose |
|-----------|-------------|---------|
| **T1 structural** | High-resolution anatomical image | Registration target, skull stripping |
| **DWI main run** | Diffusion-weighted images (multiple b-values and directions) | Primary diffusion data |
| **Fieldmap AP** | B0 image with anterior-to-posterior phase encoding | Susceptibility distortion correction |
| **Fieldmap PA** | B0 image with posterior-to-anterior phase encoding | Susceptibility distortion correction |

Your raw DICOM directory structure might look something like this — but folder names vary widely across scanners and sites:

```
$base_dir/dicoms/
  sub-001/
    T1_MPRAGE/          # or: MPRAGE, 3D_T1, anat_T1w, etc.
    DWI_64dir/          # or: ep2d_diff, cmrr_mbdiff, DTI, etc.
    FieldMap_AP/        # or: SpinEchoFieldMap_AP, SE_AP, etc.
    FieldMap_PA/        # or: SpinEchoFieldMap_PA, SE_PA, etc.
  sub-002/
    ...
```

If you are not sure what your DICOM folders are called, list one subject's directory and look for scan types that match the descriptions above. Scanner vendors use different naming conventions — Siemens, GE, and Philips all name sequences differently. See the [Acquisition Protocols](../foundations/acquisition-protocols) page for a vendor comparison table. You can also do a dry-run conversion to see what dcm2niix detects:

```bash
dcm2niix -b o -f "%p_%s" /path/to/one/subject/dicoms/
```

This prints protocol names without converting, helping you identify which folders contain which scan types.

## Tool & Command Reference

### dcm2niix

**Basic syntax:**

```bash
dcm2niix -o "$out_dir" -f "${subj}_${label}" "$dicom_dir"
```

**Key flags:**

| Flag | Description | Example |
|------|-------------|---------|
| `-o` | Output directory for converted files | `-o "$out_dir/struct"` |
| `-f` | Output filename format (supports variables) | `-f "${subj}_struct"` |
| `-z` | Compression: `y` = gzip, `n` = uncompressed, `i` = internal | `-z y` |
| `-b` | BIDS sidecar: `y` = generate JSON, `n` = skip | `-b y` |
| `-ba` | Anonymize BIDS sidecar (remove patient info) | `-ba y` |

### Batch Processing Script

The following script loops over subjects, checks for the required scan types, and converts each:

```bash
#!/bin/bash
# batch_convert.sh - Convert DICOMs to NIfTI for all subjects
#
# Usage: bash batch_convert.sh

base_dir="/path/to/project"
dicom_dir="$base_dir/dicoms"
nifti_dir="$base_dir/nifti"

# ============================================================
# IMPORTANT: Change these to match YOUR scanner's folder names
# These are examples — your DICOM folders will be named differently
# List one subject's directory to see what yours are called
# ============================================================
declare -A scan_map
scan_map[struct]="T1_MPRAGE"       # Your T1 structural folder name
scan_map[dti]="DWI_64dir"          # Your diffusion run folder name
scan_map[fmapAP]="FieldMap_AP"     # Your AP fieldmap folder name
scan_map[fmapPA]="FieldMap_PA"     # Your PA fieldmap folder name

# Get list of subjects
subjects=$(ls -d "$dicom_dir"/sub-* 2>/dev/null | xargs -n1 basename)

if [ -z "$subjects" ]; then
    echo "ERROR: No subject directories found in $dicom_dir"
    exit 1
fi

for subj in $subjects; do
    echo "=========================================="
    echo "Processing: $subj"
    echo "=========================================="

    # Check that all required scan types exist
    missing=0
    for label in "${!scan_map[@]}"; do
        scan_name="${scan_map[$label]}"
        if [ ! -d "$dicom_dir/$subj/$scan_name" ]; then
            echo "  WARNING: Missing $scan_name for $subj"
            missing=1
        fi
    done

    if [ "$missing" -eq 1 ]; then
        echo "  Skipping $subj due to missing scans."
        continue
    fi

    # Convert T1 structural
    mkdir -p "$nifti_dir/$subj/struct"
    dcm2niix -o "$nifti_dir/$subj/struct" \
             -f "${subj}_struct" \
             -z y -b y \
             "$dicom_dir/$subj/${scan_map[struct]}"

    # Convert DWI
    mkdir -p "$nifti_dir/$subj/dti"
    dcm2niix -o "$nifti_dir/$subj/dti" \
             -f "${subj}_dti" \
             -z y -b y \
             "$dicom_dir/$subj/${scan_map[dti]}"

    # Convert Fieldmap AP
    dcm2niix -o "$nifti_dir/$subj/dti" \
             -f "${subj}_fmapAP" \
             -z y -b y \
             "$dicom_dir/$subj/${scan_map[fmapAP]}"

    # Convert Fieldmap PA
    dcm2niix -o "$nifti_dir/$subj/dti" \
             -f "${subj}_fmapPA" \
             -z y -b y \
             "$dicom_dir/$subj/${scan_map[fmapPA]}"

    echo "  Done: $subj"
done

echo ""
echo "Batch conversion complete."
```

## Expected Output

After conversion, each subject should have the following file tree:

```
$nifti_dir/
  sub-001/
    struct/
      sub-001_struct.nii.gz        # T1 anatomical volume
      sub-001_struct.json           # Acquisition metadata
    dti/
      sub-001_dti.nii.gz           # 4D diffusion-weighted volume
      sub-001_dti.bval             # b-values (one per volume)
      sub-001_dti.bvec             # gradient directions (3 x N)
      sub-001_dti.json             # DWI acquisition metadata
      sub-001_fmapAP.nii.gz       # Fieldmap anterior-to-posterior
      sub-001_fmapAP.json         # Fieldmap AP metadata
      sub-001_fmapPA.nii.gz       # Fieldmap posterior-to-anterior
      sub-001_fmapPA.json         # Fieldmap PA metadata
```

## Quality Check

Run an audit script to verify that all expected output files exist for every subject:

```bash
#!/bin/bash
# audit_conversion.sh - Verify DICOM-to-NIfTI conversion completeness

nifti_dir="/path/to/project/nifti"

expected_files=(
    "struct/${subj}_struct.nii.gz"
    "dti/${subj}_dti.nii.gz"
    "dti/${subj}_dti.bval"
    "dti/${subj}_dti.bvec"
    "dti/${subj}_dti.json"
    "dti/${subj}_fmapAP.nii.gz"
    "dti/${subj}_fmapPA.nii.gz"
)

echo "Conversion Audit Report"
echo "======================="

for subj_dir in "$nifti_dir"/sub-*; do
    subj=$(basename "$subj_dir")
    missing=0

    for file_template in "${expected_files[@]}"; do
        # Substitute subject ID into template
        file_path=$(echo "$file_template" | sed "s/\${subj}/$subj/g")
        if [ ! -f "$subj_dir/$file_path" ]; then
            echo "  MISSING: $subj/$file_path"
            missing=$((missing + 1))
        fi
    done

    if [ "$missing" -eq 0 ]; then
        echo "  $subj: OK (all files present)"
    else
        echo "  $subj: $missing file(s) missing"
    fi
done
```

You can also spot-check the DWI data:

```bash
# Verify the number of volumes matches the number of b-values
fslnvols "$nifti_dir/sub-001/dti/sub-001_dti.nii.gz"
wc -w "$nifti_dir/sub-001/dti/sub-001_dti.bval"
```

Both commands should return the same number.

## Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| **Missing scan types** | Scan not acquired or DICOM folder named differently | Check scanner protocol; adjust `scan_map` in the batch script |
| **Naming inconsistencies** | Scanner operator used different series descriptions across subjects | Manually inspect DICOM headers with `dcmdump` or `dicom_hinfo` and update the mapping |
| **Duplicate runs** | Same scan acquired twice (e.g., due to motion) | dcm2niix appends `_a`, `_b` suffixes; decide which run to keep based on quality |
| **No .bval/.bvec files** | Non-diffusion scan, or dcm2niix could not parse gradient table | Verify DICOM headers contain diffusion gradient information |
| **Incorrect orientation** | Rare dcm2niix issue with certain scanner/software versions | Update dcm2niix to latest version; verify orientation visually in FSLeyes |

## References

- Li, X., Morgan, P. S., Ashburner, J., Smith, J., & Rorden, C. (2016). The first step for neuroimaging data analysis: DICOM to NIfTI conversion. *Journal of Neuroscience Methods*, 264, 47-56. https://doi.org/10.1016/j.jneumeth.2016.03.001
- dcm2niix GitHub repository: https://github.com/rordenlab/dcm2niix
- NIfTI format specification: https://nifti.nimh.nih.gov/

## Next Step

Proceed to **[Step 2: Skull Stripping](./skull-stripping)** to remove non-brain tissue from the T1 structural images.
