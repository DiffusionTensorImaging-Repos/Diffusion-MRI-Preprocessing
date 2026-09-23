---
sidebar_position: 7
title: "Step 6: Brain Masking"
---

# Step 6: Brain Masking in Diffusion Space

## Overview

This step creates a **binary brain mask** from the mean B0 image using FSL's BET (Brain Extraction Tool). The mask defines which voxels are "brain" and which are not — every downstream processing step uses this mask to restrict computations to brain tissue only, excluding skull, scalp, eyes, and air.

**Further reading:** [Brain Extraction (Skull Stripping)](https://andysbrainbook.readthedocs.io/en/latest/fMRI_Short_Course/Preprocessing/Skull_Stripping.html) — Andy's Brain Book explanation of why skull stripping matters and how BET's intensity threshold works

## Conceptual Background

### A Second Brain Extraction

You already performed skull stripping on the T1 structural image in [Step 2](./skull-stripping) using ANTs. Why do you need another brain mask here?

Because the T1 mask lives in **structural space** and this mask needs to be in **diffusion space**. The T1 and DWI images have different:
- **Resolution** (T1 is typically 1mm isotropic; DWI is typically 1.5–2mm)
- **Contrast** (T1 shows gray/white matter contrast; B0 shows different tissue contrast)
- **Geometric distortions** (DWI has susceptibility distortions, even after TOPUP correction)

Rather than trying to warp the T1 mask into diffusion space (which introduces interpolation errors), it is simpler and more reliable to create a mask directly from the diffusion data itself.

### BET

BET (Brain Extraction Tool) fits a deformable surface (mesh) to the brain boundary. It starts with a sphere centered on the brain's center of gravity and iteratively expands it outward, stopping when it encounters the intensity transition between brain and non-brain tissue.

The key parameter is the **fractional intensity threshold** (`-f`):
- **Lower values** (e.g., 0.2): more liberal — includes more tissue, risks including skull
- **Higher values** (e.g., 0.5): more aggressive — tighter mask, risks cutting into brain tissue
- **Default** (0.3): a reasonable starting point for most mean B0 images

### Choosing the Right `-f` Value

There is no universal "correct" value — it depends on your data. The goal is a mask that:

1. **Includes all brain tissue** — especially in the frontal and temporal lobes (which are prone to signal dropout)
2. **Excludes non-brain tissue** — skull, scalp, eyes, sinuses

If your first attempt is not right, adjust `-f` and re-run. This is one of the most commonly adjusted parameters in the entire pipeline.

## Prerequisites

| Input | Source | Description |
|-------|--------|-------------|
| Mean B0 image | [Step 5: Mean B0](./mean-b0) | TOPUP-corrected, time-averaged B0 |

## Command

```bash
# ──────────────────────────────────────────────
# Define paths
# ──────────────────────────────────────────────
topup_dir="$base_dir/topup/$subj"

# ──────────────────────────────────────────────
# Run BET on the mean B0
# ──────────────────────────────────────────────
bet "$topup_dir/${subj}_topup_Tmean" \
    "$topup_dir/${subj}_topup_Tmean_brain" \
    -m -f 0.3
```

### Flag Explanation

| Flag | Purpose |
|------|---------|
| `-m` | Generate a binary mask file (appends `_mask` to the output name) |
| `-f 0.3` | Fractional intensity threshold — controls how aggressively tissue is stripped |

## Batch Processing Script

```bash
#!/bin/bash
# brain_masking.sh — Create brain masks for all subjects

base_dir="/path/to/project"
topup_dir="$base_dir/topup"

# Fractional intensity threshold — adjust if masks are too tight or loose
f_threshold=0.3

subjects=$(ls -d "$topup_dir"/sub-* 2>/dev/null | xargs -n1 basename)

for subj in $subjects; do
    echo "Processing: $subj"

    input="$topup_dir/$subj/${subj}_topup_Tmean"

    if [ ! -f "${input}.nii.gz" ]; then
        echo "  WARNING: Missing mean B0 for $subj — skipping"
        continue
    fi

    bet "$input" \
        "$topup_dir/$subj/${subj}_topup_Tmean_brain" \
        -m -f $f_threshold

    echo "  Done: $subj"
done

echo "Brain masking complete."
```

## Expected Output

| File | Description |
|------|-------------|
| `${subj}_topup_Tmean_brain.nii.gz` | Brain-extracted mean B0 (skull removed) |
| `${subj}_topup_Tmean_brain_mask.nii.gz` | Binary brain mask (1 = brain, 0 = not brain) |

## Quality Check

This is one of the most important QC steps in the pipeline. A bad brain mask will cause problems in every subsequent step.

### Visual Inspection in FSLeyes

```bash
fsleyes "$topup_dir/$subj/${subj}_topup_Tmean" \
        "$topup_dir/$subj/${subj}_topup_Tmean_brain_mask" \
        -cm red-yellow -a 40 &
```

### What to Look For

**Good mask:**
- Covers the entire brain including frontal and temporal poles
- Smooth boundary that follows the brain surface
- No skull fragments inside the mask
- No "holes" in the middle of the brain

**Over-stripped (mask too tight — `-f` too high):**
- Brain tissue is missing, especially at the frontal and temporal poles
- The mask looks like a smaller version of the brain
- **Fix**: Lower `-f` (e.g., from 0.3 to 0.2)

**Under-stripped (mask too loose — `-f` too low):**
- Skull, scalp, or eye tissue is included
- The mask extends beyond the brain boundary
- **Fix**: Raise `-f` (e.g., from 0.3 to 0.4)

It is completely normal to run BET 2–3 times with different `-f` values to find the right threshold for your data. Some datasets need `-f 0.2`, others need `-f 0.4`. Check a few subjects and pick a value that works well across your sample. If one `-f` value does not work for all subjects, you may need different values for different subjects.

### Alternative: Use `-R` for Robust Mode

If the standard BET fails (e.g., the center of gravity estimate is off), try robust mode:

```bash
bet "$input" "$output" -m -f 0.3 -R
```

The `-R` flag runs BET multiple times with different starting points and picks the best result. It is slower but more reliable for difficult cases.

## Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Frontal lobe missing from mask | `-f` too high for this data | Lower `-f` to 0.2 or 0.15 |
| Skull included in mask | `-f` too low | Raise `-f` to 0.35 or 0.4 |
| BET fails completely (tiny mask or enormous mask) | Mean B0 has severe artifacts | Check the mean B0 from Step 5; if it looks bad, revisit TOPUP |
| Asymmetric mask (one hemisphere truncated) | Center of gravity estimate is wrong | Use `-R` (robust) mode, or manually specify center with `-c x y z` |
| Mask has holes inside the brain | Low SNR in certain regions | Fill holes with `fslmaths mask -fillh mask_filled` |

## References

- Smith SM (2002). Fast robust automated brain extraction. *Human Brain Mapping*, 17(3), 143-155.
- FSL BET documentation: [https://fsl.fmrib.ox.ac.uk/fsl/fslwiki/BET](https://fsl.fmrib.ox.ac.uk/fsl/fslwiki/BET)

## Next Step

Proceed to **[Step 7: Denoising & Gibbs Correction](./denoising-gibbs)** to remove noise and ringing artifacts from the DWI data.
