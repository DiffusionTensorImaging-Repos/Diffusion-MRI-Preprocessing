---
sidebar_position: 12
title: "Step 11: Response Function Estimation"
---

# Step 11: Response Function Estimation

## Overview

Before you can estimate which directions fibers run in each voxel, you need a reference: what does the diffusion signal from a *single*, perfectly coherent fiber bundle actually look like in this dataset? That reference is called the **response function**.

This step estimates one response function per tissue type (white matter, gray matter, CSF) for every participant, then averages them into a single group response that all participants share.

:::caution
Three-tissue estimation needs **multi-shell** data — at least two non-zero b-values plus b=0. Single-shell data can only separate two tissues; see the [two-tissue variant](./fod-estimation#single-shell-data--the-two-tissue-variant) in Step 12.
:::

## Conceptual Background

### What a Response Function Is

The diffusion signal measured in a voxel is a mixture: it is the signal from one idealized fiber bundle, smeared out across however many directions fibers actually run in that voxel. Mathematically, the measured signal is the response function **convolved** with the fiber orientation distribution.

That framing is useful because convolution can be undone. If you know the response function, you can **deconvolve** it out of the measured signal and recover the orientation distribution — which is exactly what [Step 12](./fod-estimation) does. The response function is the piece you need to know first.

A helpful comparison is the point spread function in optics. A telescope blurs a point of light into a small disc. If you measure that blur precisely, you can deconvolve it back out of your images and sharpen them. The response function is the diffusion equivalent: it describes how a single fiber population "blurs" across the sphere of measured directions.

### Why Three Tissue Types

Multi-shell acquisitions make it possible to distinguish three compartments, because each behaves differently as b-value increases:

| Tissue | Angular profile | Behavior across shells |
|---|---|---|
| White matter | Strongly anisotropic | Signal drops steeply perpendicular to fibers, much less along them |
| Gray matter | Roughly isotropic | Signal decays moderately and about equally in all directions |
| CSF | Isotropic | Signal decays very fast — nearly gone by high b-values |

Estimating all three lets the deconvolution in Step 12 assign each voxel's signal to the right compartment instead of forcing everything into a white-matter model. This matters most at tissue boundaries, where a voxel may be part white matter and part CSF.

### The Dhollander Algorithm

`dwi2response dhollander` is **unsupervised**: it finds representative voxels for each tissue class from the diffusion data alone, with no T1 segmentation required. This is convenient (no dependency on a separate anatomical pipeline) and robust (no registration error propagating into the response estimate).

### Why the Responses Are Group-Averaged

This is the part that is easy to get wrong.

If every participant uses their own response function, the resulting FOD amplitudes are **not comparable across participants**. Each person's FODs would be expressed relative to a slightly different reference, so an amplitude of 0.4 would not mean the same thing in two different brains. Any group analysis built on those amplitudes would be comparing units that silently differ.

Averaging the responses into one group reference removes that problem: every participant's FODs are deconvolved against the same yardstick. This is the standard MRtrix3 recommendation for group studies and it is what the downstream tractography and normalization steps assume.

:::tip
The group average is computed across **all** participants in your study, so this step has a natural two-phase structure: estimate per-subject responses for everyone first, then average, then move on. You cannot compute FODs for participant 1 until every participant's response has been estimated.
:::

## Prerequisites

| Requirement | Source |
|---|---|
| Eddy-corrected DWI data | [Step 8](./eddy) |
| Rotated bvecs and bvals from eddy | [Step 8](./eddy) |
| Brain mask in diffusion space | [Step 6](./brain-masking) |
| Multi-shell acquisition (2+ non-zero b-values) | Acquisition |
| MRtrix3 installed | [Tool setup](../tools/mrtrix3) |

:::caution
Use the **rotated** bvecs written by `eddy`, not the originals. Eddy rotates volumes to correct motion, and the gradient table has to be rotated with them. Passing the original bvecs produces response functions — and downstream FODs — that are systematically wrong.
:::

## Commands

### Convert to MRtrix Format

MRtrix3 works in its own `.mif` format, which carries the gradient table inside the image header instead of in sidecar files. Converting once up front means none of the later commands need `-fslgrad` repeated.

```bash
# ──────────────────────────────────────────────
# Convert DWI + gradient table into a single .mif
# ──────────────────────────────────────────────
mrconvert "$subj_dir/data.nii.gz" \
          "$subj_dir/dwi.mif" \
          -fslgrad "$subj_dir/bvecs" "$subj_dir/bvals"

# ──────────────────────────────────────────────
# Convert the brain mask too
# ──────────────────────────────────────────────
mrconvert "$subj_dir/nodif_brain_mask.nii.gz" \
          "$subj_dir/mask.mif"
```

| Flag | Description |
|---|---|
| `-fslgrad` | Reads FSL-style `bvecs`/`bvals` and embeds them in the `.mif` header. Order matters: bvecs first, then bvals. |

### Estimate Per-Subject Response Functions

```bash
dwi2response dhollander \
  "$subj_dir/dwi.mif" \
  "$subj_dir/wm_response.txt" \
  "$subj_dir/gm_response.txt" \
  "$subj_dir/csf_response.txt" \
  -mask "$subj_dir/mask.mif"
```

| Argument | Description |
|---|---|
| `dhollander` | The estimation algorithm. Unsupervised and multi-tissue; no T1 segmentation needed. |
| Output 1–3 | Text files for white matter, gray matter, and CSF respectively. **Order is fixed** — WM, GM, CSF. |
| `-mask` | Restricts voxel selection to inside the brain. Without it the algorithm may pick up background noise. |

### Average Across Participants

Once every participant has responses, collapse them into one group reference per tissue:

```bash
# ──────────────────────────────────────────────
# One group response per tissue type
# ──────────────────────────────────────────────
responsemean "$project_dir"/*/wm_response.txt  "$project_dir/group_wm_response.txt"
responsemean "$project_dir"/*/gm_response.txt  "$project_dir/group_gm_response.txt"
responsemean "$project_dir"/*/csf_response.txt "$project_dir/group_csf_response.txt"
```

:::caution
The glob must match **only** the participants you intend to include. If a participant is later excluded for quality reasons, regenerate the group responses without them and recompute the FODs — otherwise the excluded participant still influences everyone else's results through the shared reference.
:::

## Batch Processing Script

```bash
#!/bin/bash
# response_functions.sh — Estimate per-subject responses, then group-average

base_dir="/path/to/project"
dwi_dir="$base_dir/dwi"
max_jobs=8

subjects=$(ls -d "$dwi_dir"/sub-* 2>/dev/null | xargs -n1 basename)

# ──────────────────────────────────────────────
# Phase 1: per-subject responses (parallel)
# ──────────────────────────────────────────────
for subj in $subjects; do
    (
        d="$dwi_dir/$subj"

        for f in data.nii.gz bvals bvecs nodif_brain_mask.nii.gz; do
            if [ ! -f "$d/$f" ]; then
                echo "  WARNING: $subj missing $f — skipping"
                exit 0
            fi
        done

        if [ -f "$d/wm_response.txt" ]; then
            echo "  $subj: responses already exist — skipping"
            exit 0
        fi

        echo "  $subj: converting to .mif"
        mrconvert "$d/data.nii.gz" "$d/dwi.mif" \
                  -fslgrad "$d/bvecs" "$d/bvals" -force -quiet
        mrconvert "$d/nodif_brain_mask.nii.gz" "$d/mask.mif" -force -quiet

        echo "  $subj: estimating response functions"
        dwi2response dhollander "$d/dwi.mif" \
            "$d/wm_response.txt" "$d/gm_response.txt" "$d/csf_response.txt" \
            -mask "$d/mask.mif" -force -quiet
    ) &

    while [ "$(jobs -r | wc -l)" -ge "$max_jobs" ]; do sleep 2; done
done
wait

# ──────────────────────────────────────────────
# Phase 2: group averages (must follow phase 1)
# ──────────────────────────────────────────────
for tissue in wm gm csf; do
    responsemean "$dwi_dir"/*/"${tissue}_response.txt" \
                 "$dwi_dir/group_${tissue}_response.txt" -force -quiet
done

echo "Response function estimation complete."
```

## Expected Output

Per participant:

```
dwi/sub-001/
├── dwi.mif              # DWI with gradient table embedded
├── mask.mif             # brain mask in MRtrix format
├── wm_response.txt      # white matter response
├── gm_response.txt      # gray matter response
└── csf_response.txt     # CSF response
```

And once, at the project level:

```
dwi/
├── group_wm_response.txt
├── group_gm_response.txt
└── group_csf_response.txt
```

A response file is small — a handful of rows of numbers, one row per b-value shell, each row holding spherical harmonic coefficients.

## Quality Check

### Inspect the Response Functions

```bash
shview "$dwi_dir/group_wm_response.txt"
```

The white matter response should look like a **flattened disc** — wide perpendicular to the fiber direction and narrow along it — and it should get progressively flatter at higher b-values. Gray matter and CSF responses should look approximately spherical.

### Compare Across Participants

```bash
# Print the first data row of each subject's WM response
for f in "$dwi_dir"/*/wm_response.txt; do
    echo "$(basename "$(dirname "$f")")  $(sed -n '1p' "$f")"
done
```

Values should be in the same ballpark across participants. One participant whose numbers differ by an order of magnitude usually indicates a problem earlier in preprocessing — a bad mask, a failed eddy correction, or a mismatched gradient table — not a real biological difference.

### Confirm the Shell Count

```bash
mrinfo "$subj_dir/dwi.mif" -shell_bvalues
```

The listed shells should match your acquisition. If b=0 is missing or a shell you expected is absent, the conversion picked up the wrong gradient files.

## Common Issues

| Symptom | Likely cause | Fix |
|---|---|---|
| `dwi2response` fails with "insufficient voxels" | Mask too small, or data is single-shell | Check mask coverage; confirm 2+ non-zero shells with `mrinfo -shell_bvalues` |
| Response values wildly different in one participant | Wrong bvecs (unrotated), or failed eddy | Re-check that Step 8's rotated bvecs were used |
| `responsemean` glob matches nothing | Wrong path, or phase 1 did not finish | Confirm `wm_response.txt` exists for each participant before averaging |
| WM response looks spherical in `shview` | Gradient table mismatched to the data | Verify bvecs/bvals row counts match the volume count |

## References

- Dhollander, T., Raffelt, D., & Connelly, A. (2016). Unsupervised 3-tissue response function estimation from single-shell or multi-shell diffusion MR data without a co-registered T1 image. *ISMRM Workshop on Breaking the Barriers of Diffusion MRI*.
- Jeurissen, B., Tournier, J.-D., Dhollander, T., Connelly, A., & Sijbers, J. (2014). Multi-tissue constrained spherical deconvolution for improved analysis of multi-shell diffusion MRI data. *NeuroImage*, 103, 411–426.
- [MRtrix3 `dwi2response` documentation](https://mrtrix.readthedocs.io/en/latest/reference/commands/dwi2response.html)

## Next Step

Proceed to **[Step 12: Fiber Orientation Distributions](./fod-estimation)** to deconvolve these responses out of the diffusion signal and produce the FOD images that tractography actually tracks through.
