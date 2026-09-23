---
sidebar_position: 4
title: "Multi-Shell Analysis"
---

# Multi-Shell Diffusion MRI

Standard DTI uses a single b-value shell (typically b=1000 s/mm$^2$) and fits a single tensor at each voxel. This is sufficient for computing FA, MD, AD, and RD, but it cannot resolve crossing fibers or separate different tissue compartments.

Multi-shell acquisitions collect DWI data at **multiple b-values** (e.g., b=0, 1000, 2000, 3000), enabling advanced diffusion models that go beyond the limitations of the single tensor.

## The Case for Multi-Shell

The single-tensor model assumes that diffusion is Gaussian — that the signal decay follows a simple exponential. This assumption holds reasonably well at low b-values (b=1000), but breaks down at higher b-values where non-Gaussian diffusion effects become prominent.

Multi-shell data provides additional information because:

1. **Different b-values weight different tissue compartments differently** — at b=1000, signal comes from both intra- and extracellular water; at b=3000, intracellular (restricted) water dominates
2. **Higher b-values provide stronger angular contrast** — making it easier to resolve crossing fibers
3. **Multiple measurements constrain multi-compartment models** — you need more data points to estimate more parameters

## Multi-Shell Analyses

| Model | Required Shells | What It Measures | Key Output |
|-------|----------------|-----------------|------------|
| **DTI** | 1 shell (b=1000) | Bulk diffusion anisotropy | FA, MD, AD, RD |
| **DKI** (Diffusion Kurtosis) | 2+ shells (e.g., b=1000, 2000) | Deviation from Gaussian diffusion | Mean kurtosis, axial/radial kurtosis |
| **CSD** (Constrained Spherical Deconvolution) | 1–2+ shells | Fiber orientation distribution | FOD (fiber orientation distribution) |
| **MSMT-CSD** (Multi-Shell Multi-Tissue CSD) | 2+ shells | Tissue-specific fiber distributions | WM, GM, CSF FODs |
| **NODDI** | 2+ shells (e.g., b=1000, 2000) | Neurite density and dispersion | ICVF, ODI, ISO |
| **CHARMED** | 3+ shells | Restricted and hindered compartments | Restricted volume fraction |
| **Free water elimination** | 2+ shells | Separate free water from tissue | Corrected FA, free water fraction |

## Multi-Shell Preprocessing

The preprocessing pipeline described in this tutorial handles multi-shell data with minimal modifications. Most steps work identically regardless of the number of shells:

### Steps That Are Identical

| Step | Multi-Shell Notes |
|------|------------------|
| 1. DICOM to NIfTI | Same — all shells are in a single 4D file |
| 2. Skull Stripping | Same — uses the T1 structural |
| 3. B0 Concatenation | Same — uses b=0 volumes only |
| 4. TOPUP | Same — uses b=0 fieldmaps |
| 5. Mean B0 | Same |
| 6. Brain Masking | Same |
| 7. Denoising | Same — MP-PCA works on all volumes together |
| 8. Eddy | Same — eddy handles all shells simultaneously |
| 12. Registration | Same |

### Steps That Change

**Shell Extraction** — This is where multi-shell data diverges. Instead of extracting a single shell, you select the shells needed for your analysis:

```bash
# For DTI: extract b=0 + b=1000
dwiextract input.nii.gz output_b1000.nii.gz \
    -fslgrad bvecs bvals -shells 0,1000 \
    -export_grad_fsl out.bvec out.bval

# For CSD: extract b=0 + b=2000
dwiextract input.nii.gz output_b2000.nii.gz \
    -fslgrad bvecs bvals -shells 0,2000 \
    -export_grad_fsl out.bvec out.bval

# For NODDI: extract b=0 + b=1000 + b=2000
dwiextract input.nii.gz output_multishell.nii.gz \
    -fslgrad bvecs bvals -shells 0,1000,2000 \
    -export_grad_fsl out.bvec out.bval
```

**Step 9: Tensor Fitting** — DTIFIT still uses only the b=0 + b=1000 data. Higher shells are used for the advanced models below.

## Constrained Spherical Deconvolution (CSD)

CSD estimates the **fiber orientation distribution (FOD)** at each voxel — a continuous function on the sphere that describes how much fiber runs in each direction. Unlike the tensor (which gives one direction), the FOD can represent multiple crossing fibers.

### Single-Shell CSD (MRtrix3)

```bash
# Step 1: Estimate the response function
# (the signal profile of a single coherent fiber)
dwi2response tournier dwi.nii.gz response.txt \
    -fslgrad bvecs bvals

# Step 2: Compute the FOD
dwi2fod csd dwi.nii.gz response.txt fod.mif \
    -fslgrad bvecs bvals -mask brain_mask.nii.gz
```

### Multi-Shell Multi-Tissue CSD (MSMT-CSD)

MSMT-CSD uses multiple shells to separately estimate FODs for white matter, gray matter, and CSF. This provides cleaner results because the CSF and GM signals are modeled explicitly rather than contaminating the WM FOD.

```bash
# Step 1: Estimate tissue-specific response functions
dwi2response dhollander dwi.nii.gz \
    response_wm.txt response_gm.txt response_csf.txt \
    -fslgrad bvecs bvals

# Step 2: Compute multi-tissue FODs
dwi2fod msmt_csd dwi.nii.gz \
    response_wm.txt fod_wm.mif \
    response_gm.txt fod_gm.mif \
    response_csf.txt fod_csf.mif \
    -fslgrad bvecs bvals -mask brain_mask.nii.gz
```

## NODDI (Neurite Orientation Dispersion and Density Imaging)

NODDI separates the diffusion signal into three compartments:

- **Intracellular volume fraction (ICVF)**: The fraction of the voxel occupied by neurites (axons and dendrites) — a measure of neurite density
- **Orientation dispersion index (ODI)**: How dispersed (fanning) the neurites are — ranges from 0 (perfectly aligned) to 1 (completely random)
- **Isotropic volume fraction (ISO)**: Free water fraction (CSF contamination)

NODDI requires at least **two non-zero b-value shells** and is typically run using the **AMICO** toolbox (Accelerated Microstructure Imaging via Convex Optimization):

```python
# Python — AMICO
import amico

amico.setup()

ae = amico.Evaluation("study_dir", "subject_id")
ae.load_data(dwi_filename="dwi.nii.gz",
             scheme_filename="protocol.scheme",
             mask_filename="brain_mask.nii.gz")
ae.set_model("NODDI")
ae.generate_kernels()
ae.load_kernels()
ae.fit()
ae.save_results()
```

## Diffusion Kurtosis Imaging (DKI)

DKI extends the tensor model by adding a **kurtosis tensor** that captures non-Gaussian diffusion. The kurtosis is particularly sensitive to tissue complexity and heterogeneity.

Key metrics:
- **Mean kurtosis (MK)**: Average kurtosis across all directions
- **Axial kurtosis (AK)**: Kurtosis along the principal diffusion direction
- **Radial kurtosis (RK)**: Kurtosis perpendicular to the principal direction

DKI requires **at least two non-zero b-value shells** (typically b=1000 and b=2000) and can be computed using **DIPY**:

```python
# Python — DIPY
import dipy.reconst.dki as dki
from dipy.io.image import load_nifti
from dipy.core.gradients import gradient_table

data, affine = load_nifti("dwi.nii.gz")
gtab = gradient_table("dwi.bval", "dwi.bvec")

dki_model = dki.DiffusionKurtosisModel(gtab)
dki_fit = dki_model.fit(data)

mk = dki_fit.mk()   # Mean kurtosis
ak = dki_fit.ak()   # Axial kurtosis
rk = dki_fit.rk()   # Radial kurtosis
```

### pyAFQ and DKI

When pyAFQ is given multi-shell data (two or more non-zero b-value shells), it automatically fits a DKI model alongside the standard DTI model. The tract profile output will include DKI-derived versions of FA and MD (`dki_fa`, `dki_md`) in addition to the standard DTI versions (`dti_fa`, `dti_md`). No extra configuration is needed — pyAFQ detects the available shells and fits both models.

Since the DKI model accounts for non-Gaussian diffusion, the DKI-derived FA and MD values are generally considered more accurate estimates when multi-shell data is available. If your data has multiple shells, these are worth using as your primary FA and MD measures.

## Shell Selection Guidelines

When you have multi-shell data, choosing the right shells for each analysis matters:

| Analysis | Recommended Shells | Why |
|----------|-------------------|-----|
| DTI (FA, MD) | b=0 + b=1000 | Gaussian assumption holds best at moderate b-values |
| Single-shell CSD | b=0 + b=2000–3000 | Higher b-values give stronger angular contrast |
| MSMT-CSD | b=0 + b=1000 + b=2000–3000 | Multiple shells separate tissue types |
| NODDI | b=0 + b=1000 + b=2000 | Two non-zero shells constrain the model |
| DKI | b=0 + b=1000 + b=2000 | Kurtosis estimation needs multiple b-values |

Always run eddy on the complete multi-shell dataset (all b-values together). Eddy uses information across all shells to estimate motion and eddy current parameters more accurately. Extract specific shells after eddy correction in [Shell Extraction](../pipeline/shell-extraction).

## References

- Tournier JD, Calamante F, Connelly A (2007). Robust determination of the fibre orientation distribution in diffusion MRI: Non-negativity constrained super-resolved spherical deconvolution. *NeuroImage*, 35(4), 1459-1472.
- Jeurissen B, Tournier JD, Dhollander T, Connelly A, Sijbers J (2014). Multi-tissue constrained spherical deconvolution for improved analysis of multi-shell diffusion MRI data. *NeuroImage*, 103, 411-426.
- Zhang H, Schneider T, Wheeler-Kingshott CA, Alexander DC (2012). NODDI: Practical in vivo neurite orientation dispersion and density imaging of the human brain. *NeuroImage*, 61(4), 1000-1016.
- Jensen JH, Helpern JA, Ramani A, Lu H, Kaczynski K (2005). Diffusional kurtosis imaging: The quantification of non-Gaussian water diffusion by means of magnetic resonance imaging. *Magnetic Resonance in Medicine*, 53(6), 1432-1440.
- Daducci A, Canales-Rodriguez EJ, Zhang H, Dyrby TB, Alexander DC, Thiran JP (2015). Accelerated microstructure imaging via convex optimization (AMICO) from diffusion MRI data. *NeuroImage*, 105, 32-44.
