---
sidebar_position: 10
title: "Step 9: Tensor Fitting (DTIFIT)"
---

# Step 9: Tensor Fitting (DTIFIT)

## Overview

This step fits the diffusion tensor model to the corrected DWI data, producing voxelwise maps of the core DTI metrics: **Fractional Anisotropy (FA)**, **Mean Diffusivity (MD)**, **Axial Diffusivity (AD)**, and **Radial Diffusivity (RD)**. These scalar maps are the primary output of most DTI studies and form the basis for group-level statistical analyses, tract-based spatial statistics (TBSS), and tractography-based analyses.

**Further reading:** [TBSS #5: Fitting the Tensors](https://andysbrainbook.readthedocs.io/en/latest/TBSS/TBSS_Course/TBSS_05_FittingTensors.html) — Andy's Brain Book explanation of eigenvalue decomposition and how FA, MD, AD, RD are derived from the tensor

## Conceptual Background

### The Diffusion Tensor

At each voxel, the diffusion tensor is a **3x3 symmetric positive-definite matrix** that describes the magnitude and preferred orientation of water diffusion. Because the matrix is symmetric, it has six unique elements, which means at least six diffusion-weighted measurements (plus one b=0 image) are required to estimate it.

### Tensor Estimation

FSL's `dtifit` uses **weighted least squares (WLS)** regression to fit the tensor to the log-transformed DWI signal at each voxel. The relationship between the DWI signal and the tensor is described by the Stejskal-Tanner equation:

```
S(g) = S0 * exp(-b * g^T * D * g)
```

where `S(g)` is the signal for gradient direction `g`, `S0` is the non-diffusion-weighted signal, `b` is the b-value, and `D` is the diffusion tensor.

### Only the b=1000 Shell Is Used

The single-tensor model assumes **Gaussian diffusion**, which holds best at moderate b-values (typically b=1000 s/mm^2). At higher b-values, the DWI signal reveals non-Gaussian effects such as diffusion kurtosis and signal contributions from crossing fibers, which violate the assumptions of the single-tensor model. Including higher b-value shells in the tensor fit can bias the resulting scalar maps. For this reason, we extract only the b=0 and b=1000 volumes prior to running `dtifit`.

### From Eigenvalues to DTI Metrics

The tensor is decomposed into three **eigenvalues** (L1 >= L2 >= L3) and their corresponding **eigenvectors** (V1, V2, V3). The eigenvalues represent the magnitude of diffusion along each principal axis. The DTI scalar metrics are derived directly from these eigenvalues:

- **Fractional Anisotropy (FA)** quantifies how directionally constrained the diffusion is, ranging from 0 (perfectly isotropic) to 1 (perfectly anisotropic):

  ```
  FA = sqrt(3/2) * sqrt(((L1 - MD)^2 + (L2 - MD)^2 + (L3 - MD)^2) / (L1^2 + L2^2 + L3^2))
  ```

- **Mean Diffusivity (MD)** is the average diffusion across all three axes:

  ```
  MD = (L1 + L2 + L3) / 3
  ```

- **Axial Diffusivity (AD)** is diffusion along the principal axis (the direction of the primary eigenvector):

  ```
  AD = L1
  ```

- **Radial Diffusivity (RD)** is the average diffusion perpendicular to the principal axis:

  ```
  RD = (L2 + L3) / 2
  ```

## Prerequisites

Before running this step, you should have completed:

| Requirement | Source |
|---|---|
| Eddy-corrected DWI data | Step 8 (Eddy Correction) |
| b=0 and b=1000 volumes | [Shell Extraction](./shell-extraction) (optional) |
| Brain mask | Step 5 or Step 8 |
| Rotated bvecs from eddy | Step 8 (Eddy Correction) |

Use the rotated bvecs output by `eddy`, not the original bvecs. Eddy correction involves volume-by-volume rotations, and the gradient directions must be rotated accordingly. Using the original bvecs will produce incorrect tensor estimates and corrupted FA/MD maps.

## Tool & Command Reference

### Running DTIFIT

**Tool:** FSL `dtifit`

```bash
dtifit \
  --data="$input_dir/${subj}_data_1000.nii.gz" \
  --out="$output_dir/${subj}_DTI" \
  --mask="$mask_dir/${subj}_brain_mask.nii.gz" \
  --bvecs="$input_dir/${subj}_data_1000.bvec" \
  --bvals="$input_dir/${subj}_data_1000.bval"
```

**Flag explanations:**

| Flag | Description |
|---|---|
| `--data` | The input 4D DWI file. Tensor fitting conventionally uses only the b=0 and b=1000 volumes, which [Shell Extraction](./shell-extraction) produces. |
| `--out` | The output basename. DTIFIT appends suffixes like `_FA`, `_MD`, `_L1`, etc. to this prefix. |
| `--mask` | A binary brain mask. Tensor fitting is performed only within this mask, which speeds up computation and prevents noisy fits outside the brain. |
| `--bvecs` | The b-vector file corresponding to the extracted shell. These must be the **rotated** bvecs from eddy correction. |
| `--bvals` | The b-value file corresponding to the extracted shell. |

### Computing Radial Diffusivity

DTIFIT does not output an RD map directly. RD is computed as the average of the second and third eigenvalues:

```bash
fslmaths "$output_dir/${subj}_DTI_L2" \
  -add "$output_dir/${subj}_DTI_L3" \
  -div 2 \
  "$output_dir/${subj}_DTI_RD"
```

This takes the L2 eigenvalue map, adds the L3 eigenvalue map, and divides by 2 to produce the mean radial diffusivity at each voxel.

## Expected Output

After running `dtifit` and computing RD, your output directory should contain the following files:

| File | Description |
|---|---|
| `${subj}_DTI_FA.nii.gz` | Fractional Anisotropy map (range 0-1) |
| `${subj}_DTI_MD.nii.gz` | Mean Diffusivity map |
| `${subj}_DTI_L1.nii.gz` | First eigenvalue (equivalent to Axial Diffusivity) |
| `${subj}_DTI_L2.nii.gz` | Second eigenvalue |
| `${subj}_DTI_L3.nii.gz` | Third eigenvalue |
| `${subj}_DTI_RD.nii.gz` | Radial Diffusivity map (computed via `fslmaths`) |
| `${subj}_DTI_V1.nii.gz` | Primary eigenvector (direction of maximum diffusion) |
| `${subj}_DTI_V2.nii.gz` | Second eigenvector |
| `${subj}_DTI_V3.nii.gz` | Third eigenvector |
| `${subj}_DTI_MO.nii.gz` | Mode of anisotropy (describes tensor shape: planar vs. linear) |
| `${subj}_DTI_S0.nii.gz` | Estimated baseline signal (S0) with no diffusion weighting |

## Quality Check

### Visual Inspection of the FA Map

Open the FA map in FSLeyes:

```bash
fsleyes "$output_dir/${subj}_DTI_FA.nii.gz" -cm hot
```

**What to look for:**

- **White matter** should appear **bright** (high FA, typically 0.3-0.8), reflecting the highly directional diffusion along myelinated axon bundles.
- **Gray matter** should appear **moderate to dark** (lower FA, typically 0.1-0.3).
- **CSF** should appear **very dark** (FA near 0), reflecting free isotropic diffusion.
- The **corpus callosum**, **internal capsule**, and **corona radiata** should be clearly visible as high-FA structures.

### Checking Value Ranges

Verify that FA and MD values fall within physiologically reasonable ranges:

| Metric | Expected Range | Tissue |
|---|---|---|
| FA | 0.0 - 1.0 | Full brain |
| FA | 0.3 - 0.8 | White matter |
| MD | ~0.7 - 1.0 x 10^-3 mm^2/s | White matter |
| MD | ~1.5 - 3.0 x 10^-3 mm^2/s | CSF |

You can check the range with:

```bash
fslstats "$output_dir/${subj}_DTI_FA.nii.gz" -R
fslstats "$output_dir/${subj}_DTI_MD.nii.gz" -R
```

### Inspect the V1 (Eigenvector) Map

In FSLeyes, load the V1 map as a directionally encoded color (DEC) map to verify anatomical plausibility:

- **Red** = left-right (e.g., corpus callosum)
- **Green** = anterior-posterior (e.g., cingulum, IFOF)
- **Blue** = superior-inferior (e.g., corticospinal tract)

## Common Issues

| Issue | Likely Cause | Solution |
|---|---|---|
| FA values greater than 1 | Masking problem — tensor fitted to voxels outside the brain or in noisy regions | Re-generate or tighten the brain mask; ensure the mask matches the DWI data geometry |
| Negative eigenvalues | Non-positive-definite tensor estimates, often in low-SNR voxels | This is expected in a small number of voxels. If widespread, check data quality and mask |
| FA map looks noisy or blurred | Using wrong bvecs (not the rotated ones from eddy) | Confirm you are using the bvecs rotated by eddy, not the original acquisition bvecs |
| Unexpected bright spots in CSF | Poor brain extraction or susceptibility artifacts | Check the mask overlay on the DWI data; re-run BET if needed |
| MD values unreasonably high or low | Incorrect b-value file or data scaling issues | Verify that the bval file matches the extracted shell data |

## References

- Basser, P. J., Mattiello, J., & LeBihan, D. (1994). MR diffusion tensor spectroscopy and imaging. *Biophysical Journal*, 66(1), 259-267. DOI: [10.1016/S0006-3495(94)80775-1](https://doi.org/10.1016/S0006-3495(94)80775-1)
- FSL DTIFIT documentation: [https://fsl.fmrib.ox.ac.uk/fsl/fslwiki/FDT/UserGuide#DTIFIT](https://fsl.fmrib.ox.ac.uk/fsl/fslwiki/FDT/UserGuide#DTIFIT)

## Next Step

Proceed to **[Step 10: Registration (FLIRT)](./flirt-registration)** to register your DTI maps to a standard space template for group-level analyses.
