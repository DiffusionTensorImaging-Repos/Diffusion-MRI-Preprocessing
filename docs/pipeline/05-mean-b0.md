---
sidebar_position: 6
title: "Step 5: Mean B0 Image"
---

# Step 5: Computing the Mean B0 Image

## Overview

After TOPUP corrects susceptibility distortions in the B0 images, the corrected output is still a **4D volume** containing multiple B0 volumes (typically 2 — one from each phase-encoding direction). This step averages those corrected B0 volumes across time to produce a single **3D volume** with improved signal-to-noise ratio (SNR). This mean B0 image becomes the reference for brain mask creation in the next step.

**Further reading:** [FSL TOPUP User Guide](https://fsl.fmrib.ox.ac.uk/fsl/fslwiki/topup/TopupUsersGuide) — Covers the full TOPUP workflow including how corrected B0 volumes are produced and averaged

## Conceptual Background

### Averaging Improves SNR

Every MRI image contains random thermal noise from the scanner electronics and the body. This noise varies randomly from volume to volume — sometimes a voxel reads slightly too high, sometimes too low. The underlying signal, however, stays consistent.

When you average multiple volumes together:
- **Noise** (random): partially cancels out, reducing by a factor of √N, where N is the number of volumes averaged
- **Signal** (consistent): remains intact

The result is a cleaner image with better contrast between brain tissue and background — exactly what you need for reliable brain extraction in the next step.

### A Single B0 Volume

If your acquisition only has a single B0 volume (uncommon but possible), you can skip the averaging step and use that B0 directly as input to brain masking. The mask may be slightly noisier, but the pipeline will still work. Most modern DTI protocols acquire at least 2 B0 images — one in each phase-encoding direction — so this is rarely an issue.

## Prerequisites

| Input | Source | Description |
|-------|--------|-------------|
| Corrected B0 volume | [Step 4: TOPUP](./topup) | TOPUP-corrected B0 images (4D) |

## Command

```bash
# ──────────────────────────────────────────────
# Define paths
# ──────────────────────────────────────────────
topup_dir="$base_dir/topup/$subj"
output_dir="$base_dir/topup/$subj"    # Same directory — this is a quick derivative

# ──────────────────────────────────────────────
# Average the corrected B0 volumes across time
# ──────────────────────────────────────────────
fslmaths "$topup_dir/${subj}_topup_corrected_b0" \
    -Tmean \
    "$output_dir/${subj}_topup_Tmean"
```

### `-Tmean`

The `-Tmean` flag tells `fslmaths` to compute the mean across the **T**ime (4th) dimension:

- **Input**: 4D volume with shape `[X, Y, Z, N]` where N is the number of B0 volumes
- **Output**: 3D volume with shape `[X, Y, Z]` — the voxel-wise average

This is equivalent to computing, for every voxel $(x, y, z)$:

$$
\text{mean}(x, y, z) = \frac{1}{N} \sum_{i=1}^{N} \text{B0}_i(x, y, z)
$$

## Batch Processing Script

```bash
#!/bin/bash
# mean_b0.sh — Compute mean B0 for all subjects

base_dir="/path/to/project"
topup_dir="$base_dir/topup"

subjects=$(ls -d "$topup_dir"/sub-* 2>/dev/null | xargs -n1 basename)

for subj in $subjects; do
    echo "Processing: $subj"

    if [ ! -f "$topup_dir/$subj/${subj}_topup_corrected_b0.nii.gz" ]; then
        echo "  WARNING: Missing TOPUP-corrected B0 for $subj — skipping"
        continue
    fi

    fslmaths "$topup_dir/$subj/${subj}_topup_corrected_b0" \
        -Tmean \
        "$topup_dir/$subj/${subj}_topup_Tmean"

    echo "  Done: $subj"
done

echo "Mean B0 computation complete."
```

## Expected Output

| File | Description |
|------|-------------|
| `${subj}_topup_Tmean.nii.gz` | 3D mean B0 image (single volume) |

## Quality Check

### 1. Verify Dimensionality

The output should be 3D (dim4 = 1), not 4D:

```bash
fslinfo "$topup_dir/$subj/${subj}_topup_Tmean" | grep "^dim"
# dim1    X
# dim2    Y
# dim3    Z
# dim4    1    ← this should be 1
```

### 2. Visual Inspection

Open the mean B0 in FSLeyes and confirm:

```bash
fsleyes "$topup_dir/$subj/${subj}_topup_Tmean" &
```

- **Brain tissue** should be clearly visible with good gray/white matter contrast
- **Background** (outside the head) should be relatively uniform and dark
- **No distortions** should remain (these were corrected by TOPUP in Step 4)
- **No obvious artifacts** — e.g., bright streaks, dropout regions, or ghosting

If the mean B0 looks noisy or distorted, the issue likely occurred upstream in TOPUP — revisit [Step 4](./topup).

## Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Output is still 4D | Wrong input file (used uncorrected B0 with many volumes) | Verify you are using the TOPUP-corrected output, not the raw concatenated B0 |
| Image looks very noisy | Only 1 B0 volume available | This is expected with a single B0; the mask may need manual adjustment in Step 6 |
| Signal dropout in frontal/temporal lobes | TOPUP did not fully correct distortions | Revisit TOPUP parameters; check `acqp.txt` values |

Keep this image after masking is done. The mean B0 is the greyscale background that tractography QC overlays are drawn on, and streamlines and ROIs are much harder to read against a bare binary mask. The [handoff contract](./output-contract) expects it at `dwi/<subj>/mean_b0.nii.gz`.

## Next Step

Proceed to **[Step 6: Brain Masking](./brain-masking)** to create a binary brain mask from this mean B0 image.
