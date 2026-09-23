---
sidebar_position: 4
title: "Step 3: B0 Concatenation"
---

# Step 3: B0 Concatenation

## Overview

This step extracts the **B0 (non-diffusion-weighted) volumes** from the anterior-to-posterior (AP) and posterior-to-anterior (PA) fieldmap scans and merges them into a single **4D NIfTI file**. This paired B0 dataset is the required input for **TOPUP**, which uses the opposite-direction distortions to estimate and correct susceptibility-induced geometric warping.

**Further reading:** [Blip-Up-Blip-Down Distortion Correction](https://www.fmrib.ox.ac.uk/primers/intro_primer/ExBox20/IntroBox20.html) — FMRIB Primers walkthrough of merging opposite phase-encoding B0 pairs and applying TOPUP corrections

## Conceptual Background

### B0 Images

In a diffusion MRI acquisition, most volumes are acquired with diffusion-sensitizing gradients applied (producing contrast that reflects water molecule displacement along specific directions). However, one or more volumes are acquired **without** diffusion weighting -- these are the **B0 images** (b-value = 0 s/mm^2). B0 images show the anatomy without diffusion contrast, making them ideal for estimating and correcting geometric distortions.

### Opposite Phase-Encoding Directions

**Echo-planar imaging (EPI)** sequences, used for diffusion MRI, are highly sensitive to **magnetic field inhomogeneities** near air-tissue boundaries (frontal sinuses, ear canals, base of the skull). These inhomogeneities cause geometric distortions -- voxels are shifted along the **phase-encoding direction**, resulting in visible stretching or compression of anatomy.

By acquiring B0 images with **opposite phase-encoding directions** (AP and PA):

- In the **AP image**, anatomy near susceptibility boundaries is distorted in one direction (e.g., stretched anteriorly)
- In the **PA image**, the same anatomy is distorted in the **opposite** direction (e.g., compressed anteriorly)

TOPUP exploits this symmetry: the true anatomy lies somewhere between the two distorted versions, and the field map that best explains both distortions simultaneously can be estimated and used to correct all diffusion volumes.

### The Concatenation

1. **Extracts** the first B0 volume from the AP fieldmap scan
2. **Extracts** the first B0 volume from the PA fieldmap scan
3. **Merges** both B0 volumes into a single 4D file along the time dimension

## Prerequisites

- **Fieldmap AP** and **Fieldmap PA** NIfTI files from [Step 1](./dicom-to-nifti)
- **FSL** installed and available on your `PATH`

## Tool & Command Reference

### fslroi -- Extract Volumes

`fslroi` extracts a subset of volumes from a 4D NIfTI file.

**Syntax:**

```bash
fslroi <input> <output> <first_volume> <number_of_volumes>
```

- `first_volume`: Zero-indexed position of the first volume to extract
- `number_of_volumes`: How many consecutive volumes to extract

### fslmerge -- Concatenate Volumes

`fslmerge` combines multiple 3D or 4D images into a single 4D file.

**Syntax:**

```bash
fslmerge -t <output> <input1> <input2> [input3 ...]
```

- `-t`: Merge along the **time** (4th) dimension

### Step-by-Step Commands

```bash
# Define paths
input_dir="/path/to/project/nifti/${subj}/dti"
output_dir="/path/to/project/derivatives/b0_concat/${subj}"
mkdir -p "$output_dir"

# 1. Extract the first B0 volume from the AP fieldmap
fslroi "$input_dir/${subj}_fmapAP.nii.gz" \
       "$output_dir/${subj}_a2p_b0" \
       0 1

# 2. Extract the first B0 volume from the PA fieldmap
fslroi "$input_dir/${subj}_fmapPA.nii.gz" \
       "$output_dir/${subj}_p2a_b0" \
       0 1

# 3. Merge both B0 volumes into a single 4D file
fslmerge -t "$output_dir/${subj}_merged_b0s" \
    "$output_dir/${subj}_a2p_b0" \
    "$output_dir/${subj}_p2a_b0"
```

**What each command does:**

| Command | Action |
|---------|--------|
| `fslroi ... 0 1` | Extracts volume at index 0 (the first volume), extracting 1 volume total. This is the B0 image. |
| `fslmerge -t` | Concatenates the two 3D B0 volumes along the time dimension, producing a 4D file with 2 volumes. |

### Batch Processing Script

```bash
#!/bin/bash
# batch_b0_concat.sh - Extract and merge B0 volumes for all subjects
#
# Usage: bash batch_b0_concat.sh

base_dir="/path/to/project"
input_dir="$base_dir/nifti"
output_dir="$base_dir/derivatives/b0_concat"

for subj_dir in "$input_dir"/sub-*; do
    subj=$(basename "$subj_dir")

    ap_file="$subj_dir/dti/${subj}_fmapAP.nii.gz"
    pa_file="$subj_dir/dti/${subj}_fmapPA.nii.gz"

    # Check inputs exist
    if [ ! -f "$ap_file" ] || [ ! -f "$pa_file" ]; then
        echo "WARNING: Missing fieldmap for $subj -- skipping"
        continue
    fi

    out="$output_dir/$subj"
    mkdir -p "$out"

    # Skip if already processed
    if [ -f "$out/${subj}_merged_b0s.nii.gz" ]; then
        echo "Skipping $subj (already processed)"
        continue
    fi

    echo "Processing: $subj"

    # Extract B0 from AP
    fslroi "$ap_file" "$out/${subj}_a2p_b0" 0 1

    # Extract B0 from PA
    fslroi "$pa_file" "$out/${subj}_p2a_b0" 0 1

    # Merge
    fslmerge -t "$out/${subj}_merged_b0s" \
        "$out/${subj}_a2p_b0" \
        "$out/${subj}_p2a_b0"

    echo "  Done: $subj"
done

echo "B0 concatenation complete."
```

## Expected Output

```
$output_dir/
  sub-001/
    sub-001_a2p_b0.nii.gz      # Single B0 volume from AP fieldmap
    sub-001_p2a_b0.nii.gz      # Single B0 volume from PA fieldmap
    sub-001_merged_b0s.nii.gz   # 4D file containing both B0 volumes (2 volumes)
```

## Quality Check

### Verify Volume Count

The merged file should contain exactly **2 volumes** (one AP, one PA):

```bash
fslnvols "$output_dir/${subj}_merged_b0s.nii.gz"
# Expected output: 2
```

You can also inspect the full header for additional verification:

```bash
fslinfo "$output_dir/${subj}_merged_b0s.nii.gz"
```

Look for `dim4` in the output -- it should equal `2`.

### Visual Inspection

Open the merged B0 file in FSLeyes and scroll through the two volumes. You should see:

- **Volume 0 (AP)**: Distortion in the anterior-posterior direction (e.g., frontal regions may appear stretched or compressed)
- **Volume 1 (PA)**: The **same anatomy** but with distortion in the **opposite** direction

```bash
fsleyes "$output_dir/${subj}_merged_b0s.nii.gz" &
```

The two volumes should show the same overall brain anatomy with visibly **opposite** distortion patterns, particularly near the frontal lobes and temporal regions.

## Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| **Merged file has wrong number of volumes** | Extracted wrong number of volumes with fslroi, or fieldmap has unexpected structure | Check the number of volumes in the original fieldmap files with `fslnvols`; adjust the volume index accordingly |
| **AP/PA labels swapped** | Fieldmap scan names don't match actual phase-encoding direction | Check the `PhaseEncodingDirection` field in the JSON sidecar files from Step 1 |
| **Distortions look identical in both volumes** | Both fieldmaps were acquired with the same phase-encoding direction | Verify scan protocol; re-acquire if necessary |
| **Dimension mismatch error from fslmerge** | AP and PA volumes have different matrix sizes or voxel dimensions | Check headers with `fslinfo`; volumes must have matching dimensions to merge |

## References

- Smith, S. M., et al. (2004). Advances in functional and structural MR image analysis and implementation as FSL. *NeuroImage*, 23(S1), 208-219. https://doi.org/10.1016/j.neuroimage.2004.07.051
- FSL documentation: https://fsl.fmrib.ox.ac.uk/fsl/fslwiki

## Next Step

Proceed to **[Step 4: TOPUP](./topup)** to estimate and correct susceptibility-induced distortions using the merged B0 file.
