---
sidebar_position: 20
title: "BedpostX (optional)"
---

# BedpostX — Fiber Orientation Estimation

## Overview

BedpostX (Bayesian Estimation of Diffusion Parameters Obtained using Sampling Techniques) estimates the number and orientation of **crossing fiber populations** at each voxel using Markov Chain Monte Carlo (MCMC) sampling. Unlike the single-tensor model used in DTIFIT, BedpostX can resolve up to 3 crossing fibers per voxel.

BedpostX output is required for **probabilistic tractography** (`probtrackx2`). If you only need DTI scalar maps (FA, MD, RD, AD) and are not planning to do tractography, you can skip this step.

**Further reading:** [FDT Tractography Practical](https://fsl.fmrib.ox.ac.uk/fslcourse/2019_Beijing/lectures/FDT/fdt2.html) — FSL Course walkthrough of BedpostX outputs and how they feed into probtrackx2

## Conceptual Background

### Single-Tensor Models Are Not Enough

The diffusion tensor model used in [Step 9: DTIFIT](./dtifit) assumes that water diffusion at each voxel can be described by a single ellipsoid — one principal direction of diffusion. This assumption works well in regions where fibers are coherently organized in one direction.

However, 60–90% of white matter voxels contain crossing, kissing, or fanning fibers. In these regions, a single tensor cannot accurately represent the fiber architecture. For example, at the intersection of the corpus callosum (left-right) and the corticospinal tract (superior-inferior), water diffuses along both tracts simultaneously — a single tensor averages these two directions into a misleading intermediate orientation.

### BedpostX Outputs

At each voxel, BedpostX estimates:

1. **Number of fiber populations** — typically models up to 2 or 3 crossing fibers
2. **Orientation** of each fiber population (theta and phi angles)
3. **Volume fraction** of each fiber population — how much of the voxel's signal is explained by each fiber
4. **Uncertainty** in all estimates — via MCMC sampling, BedpostX produces distributions (not just point estimates)

The volume fractions sum to ≤ 1, with the remainder attributed to isotropic (non-directional) diffusion.

### When to Run BedpostX

| Plan | Run BedpostX? | Why |
|------|--------------|-----|
| Probabilistic tractography (`probtrackx2`) | **Yes** — required | probtrackx2 uses BedpostX fiber orientation distributions |
| DTI scalar maps only (FA, MD, RD) | **No** — skip to [Shell Extraction](./shell-extraction) | DTIFIT is sufficient for scalar maps |
| Connectome analysis | **Yes** — required | Tractography-based connectivity requires BedpostX |

## Prerequisites

| Input | Source | Description |
|-------|--------|-------------|
| Eddy-corrected DWI | [Step 8: Eddy](./eddy) | 4D diffusion volume after eddy/motion correction |
| Rotated bvecs | [Step 8: Eddy](./eddy) | Gradient directions corrected for head rotation |
| b-values | [Step 1: DICOM to NIfTI](./dicom-to-nifti) | Original b-value file |
| Brain mask | [Step 6: Brain Masking](./brain-masking) | Binary brain mask in diffusion space |

## Directory Structure

BedpostX has a strict directory structure requirement. It expects a directory containing exactly these files with these exact names:

```
bedpostx_input/
  data.nii.gz              # Eddy-corrected DWI data
  bvecs                    # Gradient directions (rotated from eddy)
  bvals                    # B-values
  nodif_brain_mask.nii.gz  # Brain mask
```

BedpostX will fail silently or produce errors if the files are not named exactly `data.nii.gz`, `bvecs`, `bvals`, and `nodif_brain_mask.nii.gz`. You must copy/rename your files to match.

## Commands

### Step 1: Prepare Input Directory

```bash
# ──────────────────────────────────────────────
# Define paths
# ──────────────────────────────────────────────
eddy_dir="$base_dir/eddy/$subj"
mask_dir="$base_dir/topup/$subj"
nifti_dir="$base_dir/nifti/$subj/dti"
bedpostx_dir="$base_dir/bedpostx/$subj"

# ──────────────────────────────────────────────
# Create BedpostX input directory with required files
# ──────────────────────────────────────────────
mkdir -p "$bedpostx_dir"

cp "$eddy_dir/${subj}_eddy.nii.gz" \
   "$bedpostx_dir/data.nii.gz"

cp "$eddy_dir/${subj}_eddy.eddy_rotated_bvecs" \
   "$bedpostx_dir/bvecs"

cp "$nifti_dir/${subj}_dti.bval" \
   "$bedpostx_dir/bvals"

cp "$mask_dir/${subj}_topup_Tmean_brain_mask.nii.gz" \
   "$bedpostx_dir/nodif_brain_mask.nii.gz"
```

### Step 2: Run BedpostX

```bash
# CPU version (slow but always available)
bedpostx "$bedpostx_dir"

# GPU version (5-10x faster, requires CUDA)
bedpostx_gpu "$bedpostx_dir"
```

## Resource Planning

BedpostX is the most computationally expensive step in the pipeline:

| Resource | CPU Version | GPU Version |
|----------|-------------|-------------|
| **Time per subject** | 6–24 hours | 30 min – 2 hours |
| **RAM** | 4–8 GB | 4–8 GB |
| **GPU VRAM** | N/A | 2–4 GB |
| **Disk space** | 2–5 GB per subject | 2–5 GB per subject |

If you have access to an NVIDIA GPU with CUDA, `bedpostx_gpu` is strongly recommended. It produces identical results to the CPU version but finishes in a fraction of the time. See [Environment Setup](../tools/environment-setup#gpu-setup-for-eddy_cuda) for CUDA setup instructions.

### Parallelization

For large studies, process multiple subjects simultaneously:

```bash
# Run 4 subjects in parallel using GNU parallel
ls -d "$base_dir"/bedpostx/sub-* | \
    parallel -j 4 "bedpostx {}"
```

## Expected Output

BedpostX creates a `.bedpostX` directory alongside your input:

```
bedpostx_dir.bedpostX/
  # Primary outputs
  dyads1.nii.gz              # Principal fiber direction (mean orientation of fiber 1)
  dyads2.nii.gz              # Second fiber direction (if detected)
  mean_f1samples.nii.gz      # Volume fraction of fiber 1 (0-1)
  mean_f2samples.nii.gz      # Volume fraction of fiber 2
  mean_d_stdsamples.nii.gz   # Standard deviation of diffusivity

  # MCMC samples (used by probtrackx2)
  merged_f1samples.nii.gz    # Full MCMC samples for fiber 1 fraction
  merged_f2samples.nii.gz    # Full MCMC samples for fiber 2 fraction
  merged_th1samples.nii.gz   # Theta angle samples, fiber 1
  merged_ph1samples.nii.gz   # Phi angle samples, fiber 1
  merged_th2samples.nii.gz   # Theta angle samples, fiber 2
  merged_ph2samples.nii.gz   # Phi angle samples, fiber 2

  # Other
  mean_dsamples.nii.gz       # Mean diffusivity estimate
  nodif_brain_mask.nii.gz    # Copy of input mask
```

### Output Files

- **dyads**: The mean fiber orientation at each voxel. `dyads1` is the primary fiber, `dyads2` is the second crossing fiber (if present). These are 4D volumes where each voxel has a 3D vector.
- **mean_fNsamples**: The fraction of signal at each voxel explained by fiber N. A high `mean_f1samples` (close to 1.0) means a single fiber dominates; if `mean_f2samples` is also substantial, there are crossing fibers.
- **merged_*samples**: Full MCMC posterior samples — these capture uncertainty and are used by `probtrackx2` for probabilistic tractography.

## Quality Check

### 1. Check That BedpostX Completed

```bash
# The .bedpostX directory should exist
ls -la "$bedpostx_dir.bedpostX/"

# Check for the key output files
ls "$bedpostx_dir.bedpostX/dyads1.nii.gz"
ls "$bedpostx_dir.bedpostX/mean_f1samples.nii.gz"
```

### 2. Visualize Fiber Orientations

```bash
# View the primary fiber orientation overlaid on FA
fsleyes "$bedpostx_dir.bedpostX/mean_f1samples" \
        "$bedpostx_dir.bedpostX/dyads1" -ot linevector &
```

### 3. Inspect Volume Fractions

```bash
# The volume fraction of fiber 1 should be high in coherent WM regions
fsleyes "$bedpostx_dir.bedpostX/mean_f1samples" -cm hot &

# Fiber 2 fraction should be elevated at crossing regions
fsleyes "$bedpostx_dir.bedpostX/mean_f2samples" -cm hot &
```

## Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| BedpostX fails immediately | Files not named correctly in input directory | Check that files are exactly: `data.nii.gz`, `bvecs`, `bvals`, `nodif_brain_mask.nii.gz` |
| "Dimension mismatch" error | Mask, data, and bvecs/bvals have inconsistent dimensions | Verify with `fslinfo data.nii.gz` and `wc -w bvals` — volume count must match |
| BedpostX hangs or takes days | Normal for CPU version with large data | Use `bedpostx_gpu` if possible; check progress in the log files |
| `bedpostx_gpu` crashes | CUDA version mismatch or insufficient GPU memory | Check `nvidia-smi`; see [Environment Setup](../tools/environment-setup#gpu-setup-for-eddy_cuda) |
| Output directory is empty | BedpostX was interrupted | Delete the `.bedpostX` directory and re-run |

## References

- Behrens TEJ, Woolrich MW, Jenkinson M, et al. (2003). Characterization and propagation of uncertainty in diffusion-weighted MR imaging. *Magnetic Resonance in Medicine*, 50(5), 1077-1088.
- Behrens TEJ, Berg HJ, Jbabdi S, Rushworth MFS, Woolrich MW (2007). Probabilistic diffusion tractography with multiple fibre orientations: What can we gain? *NeuroImage*, 34(1), 144-155.
- Hernandez-Fernandez M, et al. (2019). Using GPUs to accelerate computational diffusion MRI: From microstructure estimation to tractography and connectomes. *NeuroImage*, 188, 598-615.
- FSL BedpostX: [https://fsl.fmrib.ox.ac.uk/fsl/fslwiki/FDT/UserGuide](https://fsl.fmrib.ox.ac.uk/fsl/fslwiki/FDT/UserGuide)

## Next Step

BedpostX sits outside the main path — nothing later in this tutorial reads its output. Return to **[Step 9: Tensor Fitting](./dtifit)** to continue toward the [tractography handoff](./output-contract), or see [Shell Extraction](./shell-extraction) if you need a single shell isolated.
