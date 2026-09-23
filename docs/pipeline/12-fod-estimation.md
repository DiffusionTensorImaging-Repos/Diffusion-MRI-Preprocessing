---
sidebar_position: 13
title: "Step 12: Fiber Orientation Distributions"
---

# Step 12: Fiber Orientation Distributions (MSMT-CSD)

## Overview

This step turns the diffusion signal into a fiber orientation distribution (FOD) at every voxel: a function on the sphere whose peaks point along the fiber bundles passing through that voxel. Tractography follows those peaks, so the FOD image is the direct input to every tracking algorithm downstream.

It is the last modeling step before tractography.

## Conceptual Background

### The Tensor Is Not Enough

The diffusion tensor from [Step 9](./dtifit) describes each voxel with a single ellipsoid, which means a single dominant direction. That is a reasonable summary in the middle of a large coherent tract, but it fails wherever bundles cross, fan, or kiss, which is most of the white matter. Estimates commonly put crossing-fiber voxels at 60–90% of white matter.

An FOD has no such limit. It can represent two, three, or more distinct orientations in one voxel, which is what makes it possible to track through crossings instead of stopping or turning at them.

### Deconvolution

[Step 11](./response-functions) established the response function: the signal a single coherent fiber bundle produces. The measured signal in a voxel is that response convolved with however the fibers are actually arranged.

Constrained spherical deconvolution (CSD) inverts that operation. Knowing the response and the measured signal, it solves for the orientation distribution that must have produced them. The constraint is that the resulting distribution is non-negative; fiber density cannot be negative, and imposing that suppresses the spurious ringing that unconstrained deconvolution produces.

### Multi-Shell Multi-Tissue

Single-tissue CSD assumes every voxel is pure white matter. At tissue boundaries that assumption breaks: partial-volume CSF or gray matter gets deconvolved as if it were fiber signal, producing spurious peaks and, downstream, streamlines that leak into ventricles and cortex.

MSMT-CSD uses the different b-value behavior of the three tissues (established in Step 11) to split each voxel's signal into white matter, gray matter, and CSF compartments, and deconvolves only the white matter part. The result is much cleaner FODs at boundaries, which matters for small subcortical targets sitting near CSF.

### Normalization Is Not Optional

`mtnormalise` corrects the overall intensity scaling of the FODs so that tissue compartments sum sensibly and so that amplitudes are comparable across participants.

Without it, a participant scanned with slightly different coil loading or receive gain has globally larger or smaller FOD amplitudes than everyone else. Since tractography stops when FOD amplitude falls below a cutoff, that participant is effectively tracked at a different threshold, producing systematically more or fewer streamlines for a reason that has nothing to do with their brain.

The normalized white-matter FOD, `wm_fod_norm.mif`, is the file tractography should use. The un-normalized `wm_fod.mif` is an intermediate, and mixing the two across participants reintroduces the scaling problem normalization exists to remove.

## Prerequisites

| Requirement | Source |
|---|---|
| `dwi.mif` with embedded gradient table | [Step 11](./response-functions) |
| `mask.mif` brain mask | [Step 11](./response-functions) |
| Group response functions (WM, GM, CSF) | [Step 11](./response-functions) |
| MRtrix3 installed | [Tool setup](../tools/mrtrix3) |

Every participant must be deconvolved against the same group response files. That is the reason Step 11 averages them.

## Commands

### Estimate the FODs

```bash
dwi2fod msmt_csd \
  "$subj_dir/dwi.mif" \
  "$project_dir/group_wm_response.txt"  "$subj_dir/wm_fod.mif" \
  "$project_dir/group_gm_response.txt"  "$subj_dir/gm_fod.mif" \
  "$project_dir/group_csf_response.txt" "$subj_dir/csf_fod.mif" \
  -mask "$subj_dir/mask.mif"
```

| Argument | Description |
|---|---|
| `msmt_csd` | The multi-shell multi-tissue algorithm. Requires 2+ non-zero shells. |
| response / output pairs | Each tissue is given as a pair: its response file, then the FOD image to write. Order is WM, GM, CSF. |
| `-mask` | Restricts fitting to inside the brain. Substantially reduces runtime. |

The response/output arguments are positional pairs. Swapping the WM and CSF responses runs without error and produces nonsense; the command has no way to know which file is which.

### Normalize

```bash
mtnormalise \
  "$subj_dir/wm_fod.mif"  "$subj_dir/wm_fod_norm.mif" \
  "$subj_dir/gm_fod.mif"  "$subj_dir/gm_fod_norm.mif" \
  "$subj_dir/csf_fod.mif" "$subj_dir/csf_fod_norm.mif" \
  -mask "$subj_dir/mask.mif"
```

All three tissues are passed together because normalization is a joint operation: it solves for a spatially smooth scaling that makes the three compartments sum coherently. Normalizing white matter alone is not equivalent and is not supported.

Normalization is only as good as the brain mask. A mask that includes non-brain tissue, or that clips the temporal poles, biases the fit without failing; the command completes normally and the output looks plausible. The symptom surfaces much later, as one participant whose tractography behaves differently from everyone else's at the same settings. If a participant looks like an outlier downstream, re-check their mask from [Step 6](./brain-masking) before adjusting tracking parameters.

### Single-Shell Data

Three-tissue estimation needs at least two non-zero shells. With single-shell data only two compartments can be separated, so the gray matter arguments are dropped from both commands:

```bash
# Two-tissue CSD: white matter + CSF only
dwi2fod msmt_csd \
  "$subj_dir/dwi.mif" \
  "$project_dir/group_wm_response.txt"  "$subj_dir/wm_fod.mif" \
  "$project_dir/group_csf_response.txt" "$subj_dir/csf_fod.mif" \
  -mask "$subj_dir/mask.mif"

mtnormalise \
  "$subj_dir/wm_fod.mif"  "$subj_dir/wm_fod_norm.mif" \
  "$subj_dir/csf_fod.mif" "$subj_dir/csf_fod_norm.mif" \
  -mask "$subj_dir/mask.mif"
```

The gray matter response from [Step 11](./response-functions) is left unused. Everything downstream is unchanged; `wm_fod_norm.mif` is still the output that matters.

Two-tissue FODs are more affected by partial volume at gray matter boundaries than three-tissue FODs. If you are targeting small structures near cortex or deep gray matter, this is a limitation of single-shell acquisition rather than something the processing can recover.

## Batch Processing Script

FOD estimation is memory-hungry. Total load is roughly `max_jobs × nthreads`, so size both against your machine rather than maximizing either alone.

```bash
#!/bin/bash
# fod_estimation.sh — MSMT-CSD and intensity normalization for all subjects

base_dir="/path/to/project"
dwi_dir="$base_dir/dwi"
nthreads=4
max_jobs=4

subjects=$(ls -d "$dwi_dir"/sub-* 2>/dev/null | xargs -n1 basename)

# Group responses must already exist (Step 11, phase 2)
for tissue in wm gm csf; do
    if [ ! -f "$dwi_dir/group_${tissue}_response.txt" ]; then
        echo "ERROR: missing group_${tissue}_response.txt — run Step 11 first"
        exit 1
    fi
done

for subj in $subjects; do
    (
        d="$dwi_dir/$subj"

        if [ ! -f "$d/dwi.mif" ]; then
            echo "  WARNING: $subj missing dwi.mif — skipping"
            exit 0
        fi

        if [ -f "$d/wm_fod_norm.mif" ]; then
            echo "  $subj: FODs already exist — skipping"
            exit 0
        fi

        echo "  $subj: estimating FODs"
        dwi2fod msmt_csd "$d/dwi.mif" \
            "$dwi_dir/group_wm_response.txt"  "$d/wm_fod.mif" \
            "$dwi_dir/group_gm_response.txt"  "$d/gm_fod.mif" \
            "$dwi_dir/group_csf_response.txt" "$d/csf_fod.mif" \
            -mask "$d/mask.mif" -nthreads "$nthreads" -force -quiet

        # Write to a temporary name so an interrupted run cannot leave a
        # truncated wm_fod_norm.mif that later steps would silently trust.
        echo "  $subj: normalizing"
        if mtnormalise \
            "$d/wm_fod.mif"  "$d/wm_fod_norm.partial.mif" \
            "$d/gm_fod.mif"  "$d/gm_fod_norm.mif" \
            "$d/csf_fod.mif" "$d/csf_fod_norm.mif" \
            -mask "$d/mask.mif" -force -quiet; then
            mv -f "$d/wm_fod_norm.partial.mif" "$d/wm_fod_norm.mif"
        else
            rm -f "$d/wm_fod_norm.partial.mif"
            echo "  ERROR: $subj normalization failed"
        fi
    ) &

    while [ "$(jobs -r | wc -l)" -ge "$max_jobs" ]; do sleep 2; done
done
wait

echo "FOD estimation complete."
```

## Expected Output

```
dwi/sub-001/
├── wm_fod.mif            # white matter FOD (intermediate)
├── gm_fod.mif            # gray matter compartment
├── csf_fod.mif           # CSF compartment
├── wm_fod_norm.mif       # normalized WM FOD: the tractography input
├── gm_fod_norm.mif
└── csf_fod_norm.mif
```

`wm_fod_norm.mif` is the file that matters downstream. The others are kept for QC and because normalization needs all three.

## Quality Check

### Build a Tissue-Composition Image

A standard MRtrix QC check is to combine the three compartments into one RGB-style volume, where white matter, gray matter, and CSF each drive a channel:

```bash
# Take the l=0 term of the WM FOD, then stack CSF / GM / WM into one image
mrconvert -coord 3 0 "$subj_dir/wm_fod_norm.mif" - | \
  mrcat "$subj_dir/csf_fod_norm.mif" "$subj_dir/gm_fod_norm.mif" - \
        "$subj_dir/vf_norm.mif"

mrview "$subj_dir/vf_norm.mif"
```

The result should look like a clean tissue segmentation: white matter bright in one channel, cortical ribbon in another, ventricles in the third. If the compartments are visibly mixed, with CSF signal spread through white matter for instance, the response functions or the mask are suspect.

### Inspect the FODs Directly

```bash
mrview "$subj_dir/vf_norm.mif" -odf.load_sh "$subj_dir/wm_fod_norm.mif"
```

Zoom into a region with known crossings, the centrum semiovale being the usual choice, and confirm you can see multiple distinct lobes per voxel. In the corpus callosum the FODs should be single, sharp, and left-right oriented. Outside the brain there should be essentially nothing.

### Confirm Every Participant Finished

```bash
for d in "$dwi_dir"/sub-*; do
    if [ -f "$d/wm_fod_norm.mif" ]; then s="ok"; else s="MISSING"; fi
    echo "$(basename "$d")  $s"
done
```

## Common Issues

| Symptom | Likely cause | Fix |
|---|---|---|
| `dwi2fod` reports "not enough shells" | Data is single-shell | Use the two-tissue variant above |
| FODs look noisy everywhere | Wrong response order, or unrotated bvecs | Confirm WM/GM/CSF ordering; re-check Step 8 rotated bvecs |
| Tissue image shows CSF inside white matter | Poor response estimation | Re-inspect Step 11 responses in `shview` |
| `mtnormalise` fails or produces flat output | Mask includes non-brain, or a compartment is empty | Tighten the mask; confirm all three FODs were written |
| Out-of-memory during batch run | `max_jobs × nthreads` too high | Lower both; FODs are large in memory |

## References

- Jeurissen, B., Tournier, J.-D., Dhollander, T., Connelly, A., & Sijbers, J. (2014). Multi-tissue constrained spherical deconvolution for improved analysis of multi-shell diffusion MRI data. *NeuroImage*, 103, 411–426.
- Tournier, J.-D., Calamante, F., & Connelly, A. (2007). Robust determination of the fibre orientation distribution in diffusion MRI: non-negativity constrained super-resolved spherical deconvolution. *NeuroImage*, 35(4), 1459–1472.
- Raffelt, D., et al. (2017). Bias field correction and intensity normalisation for quantitative analysis of apparent fibre density. *ISMRM*, 25, 3541.
- [MRtrix3 `dwi2fod` documentation](https://mrtrix.readthedocs.io/en/latest/reference/commands/dwi2fod.html)

## Next Step

The modeling is finished. Proceed to the [Tractography Handoff](./output-contract) to verify that your outputs match what a tractography workflow expects before you start tracking.
