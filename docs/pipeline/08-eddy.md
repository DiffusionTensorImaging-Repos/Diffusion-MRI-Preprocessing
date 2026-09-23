---
sidebar_position: 9
title: "Step 8: Eddy Current & Motion Correction"
---

# Step 8: Eddy Current & Motion Correction

## Overview

Eddy current correction is the single most critical preprocessing step in a diffusion MRI pipeline. Every diffusion-weighted volume is acquired with a different gradient direction, and the rapidly switching magnetic field gradients required for diffusion encoding induce **eddy currents** in the conducting structures of the scanner (the cryostat, gradient coils, and RF shields). These eddy currents produce secondary magnetic fields that distort each image differently, introducing volume-specific shearing, scaling, and translational artifacts. Simultaneously, subjects inevitably move during the long diffusion acquisition (typically 10-20 minutes), and even sub-millimeter head motion degrades diffusion metric estimates.

**Further reading:** [FSL eddy documentation](https://fsl.fmrib.ox.ac.uk/fsl/docs/diffusion/eddy/index.html) — Covers how eddy models distortions as a function of gradient direction and estimates motion parameters

FSL's `eddy` corrects both eddy-current distortions and subject motion in a single, integrated framework. It models eddy-current-induced distortions as a function of the applied diffusion gradient direction and strength, while simultaneously estimating six rigid-body motion parameters (three translations, three rotations) for each volume. When TOPUP output is provided, `eddy` also applies susceptibility-induced distortion correction. Optionally, `eddy` can detect and replace outlier slices rather than discarding entire volumes, preserving as much data as possible.

## Conceptual Background

### Eddy Currents

When a magnetic field gradient is switched on or off rapidly, the change in magnetic flux induces electrical currents (eddy currents) in nearby conducting materials according to Faraday's law of electromagnetic induction. In an MRI scanner, these conducting structures include the cryostat housing, the gradient coil assembly, and the radiofrequency shields. The induced eddy currents generate their own secondary magnetic fields that oppose the change that produced them. These secondary fields add to the imaging gradients, causing spatially varying perturbations to the magnetic field during image readout.

The net effect on the image is a geometric distortion. Depending on the orientation and magnitude of the eddy currents, the image may be sheared (parallelogram distortion), scaled (stretched or compressed), or translated (shifted) along the phase-encoding direction. These distortions are relatively small in magnitude (typically a few millimeters at most) but are large enough to misalign corresponding voxels across volumes, which corrupts the diffusion tensor fit.

### Eddy Currents Are Worse in Diffusion MRI

In standard fMRI or structural imaging, eddy currents are largely consistent across volumes because the same gradient waveforms are applied repeatedly. This makes them easier to handle -- any residual distortion is the same in every image.

Diffusion MRI is fundamentally different. Each volume is acquired with a **unique gradient direction and strength** to probe water diffusion along that particular axis. Because eddy currents depend on the gradient waveform that produced them, every diffusion-weighted volume has a **different distortion pattern**. A 64-direction diffusion acquisition produces 64 different eddy-current distortion fields, plus the distortion-free b=0 volumes. This means the misalignment between volumes is not a simple global shift -- it varies from volume to volume in a way that depends on the gradient direction.

If left uncorrected, this volume-specific misalignment means that a given voxel does not correspond to the same anatomical location across all diffusion directions. The diffusion tensor fit at that voxel location then mixes signal from different tissue types, degrading fractional anisotropy (FA), mean diffusivity (MD), and all other derived metrics.

### Head Motion

Diffusion MRI acquisitions are long. A typical clinical or research DTI scan with 64 directions takes 10-20 minutes. Subjects inevitably move during this time, and the problem is compounded in clinical populations (pediatric, elderly, neurological patients) where compliance is more difficult.

Even small movements matter. A 1 mm translation or a 1-degree rotation can shift a voxel across a tissue boundary (e.g., from white matter into CSF), introducing signal that does not belong in the diffusion model. Motion also causes **signal dropout** in individual slices when the head moves during the diffusion-encoding period, which disrupts the phase coherence of the diffusing spins.

Head motion introduces two distinct problems:

1. **Between-volume misalignment**: the brain is in a slightly different position and orientation in each volume.
2. **Within-volume signal loss**: rapid motion during the diffusion gradient pulse causes spin dephasing, leading to anomalously dark slices (signal dropout).

### Eddy Currents and Motion Are Corrected Together

Eddy-current distortions and head motion are not independent. The eddy-current model needs to know the true orientation of the diffusion gradient relative to the brain, but the true orientation depends on the head position, which is what the motion model is trying to estimate. Conversely, the motion model needs to register each volume to a reference, but volumes that are distorted differently by eddy currents cannot be accurately registered without first accounting for those distortions.

FSL's `eddy` solves this chicken-and-egg problem by iterating between the two models. In each iteration, it:

1. Estimates motion parameters assuming the current eddy-current model is correct.
2. Re-estimates eddy-current parameters assuming the current motion parameters are correct.
3. Repeats until convergence.

This integrated approach produces substantially better corrections than applying each correction independently and sequentially.

### Outlier Slice Replacement (--repol)

Even after motion correction, some slices may still exhibit signal dropout caused by rapid intra-volume motion. Traditionally, entire volumes containing corrupted slices would be excluded from analysis, reducing the number of gradient directions available for the tensor fit.

The `--repol` (replace outliers) flag in `eddy` takes a different approach. It uses a Gaussian process framework to predict what each slice *should* look like based on the diffusion signal model and the data from all other slices and volumes. If a slice deviates from its predicted value by more than 4 standard deviations, it is classified as an outlier and replaced with the Gaussian process prediction. This preserves the gradient direction in the dataset rather than discarding the entire volume.

The `--repol` flag is strongly recommended for all datasets. It is particularly valuable for high-motion populations and for datasets with relatively few gradient directions, where losing even a single volume meaningfully reduces the quality of the tensor fit.

### eddy and the TOPUP Output

When `eddy` receives the `--topup` flag, it incorporates the susceptibility-induced off-resonance field estimated by TOPUP into its distortion model. This means `eddy` simultaneously corrects for three sources of geometric distortion:

1. **Susceptibility-induced distortions** (from the TOPUP field map)
2. **Eddy-current-induced distortions** (modeled as a function of gradient direction)
3. **Subject motion** (rigid-body registration)

The TOPUP field coefficients tell `eddy` the static component of the distortion field that is the same for every volume. `eddy` then models the eddy-current component as the additional, volume-specific distortion on top of the susceptibility distortion.

## Prerequisites

Before running `eddy`, you need the following files from earlier pipeline steps:

| File | Source | Description |
|------|--------|-------------|
| Denoised, Gibbs-corrected DWI | Step 7 (Gibbs Ringing Correction) | 4D DWI volume with thermal noise and Gibbs ringing removed |
| Brain mask | Step 6 (Brain Mask Extraction) | Binary mask from BET on the mean b=0 image |
| TOPUP output files | Step 4 (TOPUP) | Field coefficients (`_topup_fieldcoef.nii.gz`) and corrected image (`_topup_iout.nii.gz`) |
| `acqp.txt` | Step 3 (Acquisition Parameters) | Acquisition parameters file specifying phase-encode direction and total readout time |
| `index.txt` | Created in this step | Volume-to-acquisition-parameter mapping file |
| `.bvec` and `.bval` files | Step 1 (DICOM to NIfTI) | Gradient direction and b-value tables |

## The index.txt File

The `index.txt` file tells `eddy` which row of the `acqp.txt` file applies to each volume in the DWI dataset. This is necessary because a single DWI acquisition can contain volumes acquired with different phase-encoding directions or different readout times, and `eddy` needs to know which acquisition parameters to apply when correcting each volume.

### Structure

The file contains a single row of integers, one per DWI volume. Each integer is the (1-based) row number from `acqp.txt` that describes the acquisition parameters for that volume.

### Single Phase-Encode Direction (Most Common Case)

If all your DWI volumes were acquired with the same phase-encoding direction (the typical case for a single-PE acquisition), every volume maps to the same row in `acqp.txt`. The `index.txt` file is simply a row of `1`s, one for each volume:

```bash
# Create index file with one entry per DWI volume
n_vols=$(fslnvols "$input_dir/${subj}_dwi_denoised_degibbs.nii.gz")
for i in $(seq 1 $n_vols); do echo -n "1 "; done > "$config_dir/index.txt"
```

For example, if your DWI dataset has 67 volumes (3 b=0 + 64 diffusion-weighted), `index.txt` would contain:

```
1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1
```

### Multiple Phase-Encode Directions

If your DWI data contains volumes acquired with different phase-encoding directions (e.g., interleaved AP and PA volumes), the `acqp.txt` file will have multiple rows, and the `index.txt` file must map each volume to the correct row. For instance, if odd volumes are AP (row 1) and even volumes are PA (row 2):

```
1 2 1 2 1 2 1 2 ...
```

Consult your acquisition protocol documentation to determine the correct mapping for your dataset.

## Tool & Command Reference

### FSL eddy

`eddy` is the core tool. FSL provides three variants:

| Variant | Description | When to Use |
|---------|-------------|-------------|
| `eddy_openmp` | CPU-based, multi-threaded via OpenMP | Default choice when no GPU is available |
| `eddy_cuda` | GPU-accelerated via NVIDIA CUDA | Preferred when a compatible NVIDIA GPU is available; significantly faster |
| `eddy` | Alias that typically points to `eddy_openmp` | Convenience alias on most FSL installations |

The GPU and CPU versions produce identical results. The only difference is speed: `eddy_cuda` is typically 5-10x faster than `eddy_openmp`, reducing per-subject runtime from ~1-2 hours to ~10-15 minutes depending on data size and hardware.

### Full Command

```bash
eddy \
  --imain="$input_dir/${subj}_dwi_denoised_degibbs.nii.gz" \
  --mask="$input_dir/${subj}_topup_Tmean_brain_mask.nii.gz" \
  --acqp="$config_dir/acqp.txt" \
  --index="$config_dir/index.txt" \
  --bvecs="$input_dir/${subj}_dwi.bvec" \
  --bvals="$input_dir/${subj}_dwi.bval" \
  --topup="$topup_dir/${subj}_topup" \
  --out="$output_dir/${subj}_eddy" \
  --repol \
  --verbose
```

### Flag-by-Flag Explanation

**`--imain="$input_dir/${subj}_dwi_denoised_degibbs.nii.gz"`**

The input 4D DWI dataset. This should be the fully preprocessed DWI volume from the preceding pipeline steps (denoised and Gibbs-corrected). The file must be a single 4D NIfTI image containing all b=0 and diffusion-weighted volumes concatenated along the fourth dimension.

**`--mask="$input_dir/${subj}_topup_Tmean_brain_mask.nii.gz"`**

A binary brain mask in the same space as the input DWI. `eddy` uses this mask to restrict its computations to brain voxels, which improves both speed and accuracy. The mask should come from BET applied to the mean b=0 image (typically the TOPUP-corrected temporal mean). The mask does not need to be perfect -- it is better to be slightly too generous (include some non-brain tissue) than too restrictive (clip brain tissue).

**`--acqp="$config_dir/acqp.txt"`**

The acquisition parameters file. Each row describes one unique acquisition configuration with four values: three numbers specifying the phase-encoding direction vector (e.g., `0 -1 0` for posterior-to-anterior along the y-axis) and one number specifying the total readout time in seconds. See Step 3 for detailed instructions on creating this file.

**`--index="$config_dir/index.txt"`**

The volume-to-acquisition-parameter mapping file. Contains one integer per DWI volume, indicating which row of `acqp.txt` applies to that volume. See the section above for how to create this file.

**`--bvecs="$input_dir/${subj}_dwi.bvec"`**

The gradient direction file. A text file with three rows (x, y, z components) and one column per volume, specifying the diffusion gradient direction applied for each volume. b=0 volumes should have direction `[0 0 0]`. These are the **original** bvecs from the DICOM conversion -- `eddy` will produce rotated bvecs as output.

**`--bvals="$input_dir/${subj}_dwi.bval"`**

The b-value file. A single row of numbers, one per volume, specifying the diffusion weighting (b-value) applied for each volume. b=0 volumes have a value of 0. Units are s/mm^2.

**`--topup="$topup_dir/${subj}_topup"`**

The basename of the TOPUP output files. `eddy` expects to find `${basename}_fieldcoef.nii.gz` (the spline coefficient representation of the off-resonance field) and `${basename}_movpar.txt` (TOPUP movement parameters) at this location. Providing TOPUP output allows `eddy` to simultaneously correct susceptibility-induced distortions alongside eddy-current and motion corrections.

**`--out="$output_dir/${subj}_eddy"`**

The output basename. `eddy` will produce multiple output files all starting with this basename (see Expected Output section below). The output directory must already exist.

**`--repol`**

Enable outlier slice replacement. When this flag is set, `eddy` identifies slices whose signal intensity deviates by more than 4 standard deviations from the model prediction and replaces them with values predicted by a Gaussian process. This is strongly recommended for all datasets. Without this flag, corrupted slices remain in the data and degrade downstream analyses.

**`--verbose`**

Enable detailed logging output. `eddy` will print progress information including the current iteration, the estimated eddy-current and motion parameters, and the number of outlier slices detected. This is useful for monitoring long-running jobs and for troubleshooting if something goes wrong.

### Additional Useful Flags

While the command above covers the standard use case, `eddy` offers several additional flags that may be useful in specific situations:

| Flag | Description |
|------|-------------|
| `--niter=N` | Number of iterations (default: 5). Increasing may help high-motion data. |
| `--fwhm=W1,W2,...` | Comma-separated FWHM (mm) for each iteration. Default starts high and decreases. |
| `--slm=linear` | Second-level model. Use `linear` for datasets with fewer than ~60 directions. |
| `--cnr_maps` | Write out contrast-to-noise ratio maps (enabled by default in recent FSL versions). |
| `--residuals` | Write out residual images for diagnostic purposes. |
| `--data_is_shelled` | Assert that the data are multi-shell. Skips the automatic check. |

## Parallelization

`eddy` is a single-subject tool -- each invocation processes one subject's DWI dataset. However, because it is computationally intensive (30 minutes to 2 hours per subject on CPU), processing a study with many subjects requires parallelization at the subject level.

### Approach: Background Jobs with nohup

For a system with sufficient RAM (128 GB or more), running 6-8 subjects in parallel is typically safe:

```bash
# Run eddy for multiple subjects in parallel
for subj in sub-001 sub-002 sub-003 sub-004 sub-005 sub-006; do
  nohup eddy \
    --imain="$input_dir/${subj}_dwi_denoised_degibbs.nii.gz" \
    --mask="$input_dir/${subj}_topup_Tmean_brain_mask.nii.gz" \
    --acqp="$config_dir/acqp.txt" \
    --index="$config_dir/index.txt" \
    --bvecs="$input_dir/${subj}_dwi.bvec" \
    --bvals="$input_dir/${subj}_dwi.bval" \
    --topup="$topup_dir/${subj}_topup" \
    --out="$output_dir/${subj}_eddy" \
    --repol \
    --verbose > "$log_dir/${subj}_eddy.log" 2>&1 &
done

echo "All eddy jobs submitted. Monitor with: jobs -l"
```

### Memory and CPU Considerations

- **CPU variant** (`eddy_openmp`): uses multiple threads. Set `OMP_NUM_THREADS` to control how many cores each instance uses. For parallel subjects, set this lower (e.g., 4 threads per subject with 6 subjects = 24 cores).
- **GPU variant** (`eddy_cuda`): offloads computation to the GPU. Multiple subjects can share a single GPU, but performance degrades with more than 2-3 concurrent jobs per GPU.
- **RAM**: each `eddy` instance typically requires 4-8 GB of RAM, depending on data dimensions and number of volumes.

## Expected Output

After `eddy` completes, the following files will be present in the output directory:

### Primary Output Files

| File | Description |
|------|-------------|
| `${subj}_eddy.nii.gz` | The corrected 4D DWI volume. All eddy-current distortions, motion, and (if TOPUP was provided) susceptibility distortions have been corrected. This is the primary input for all downstream processing. |
| `${subj}_eddy.eddy_rotated_bvecs` | Gradient directions rotated to account for subject motion. **This file is critical.** When the head rotates between volumes, the relationship between the applied gradient and the brain anatomy changes. These rotated bvecs reflect the effective gradient direction after accounting for head rotation. **You must use these rotated bvecs -- not the original bvecs -- for all downstream analysis (tensor fitting, tractography, TBSS, etc.).** Using the original bvecs after motion correction will produce incorrect diffusion metrics. |

### Quality Control Output Files

| File | Description |
|------|-------------|
| `${subj}_eddy.eddy_cnr_maps.nii.gz` | Contrast-to-noise ratio maps for each diffusion shell. Higher CNR indicates better data quality. Useful for identifying regions with poor signal. |
| `${subj}_eddy.eddy_outlier_map` | A binary text matrix indicating which slices in which volumes were classified as outliers. Rows correspond to slices, columns to volumes. A value of 1 indicates an outlier slice. |
| `${subj}_eddy.eddy_outlier_free_data.nii.gz` | The corrected 4D DWI data with outlier slices replaced by Gaussian process predictions. Only produced when `--repol` is used. In practice, this is the same as the main output file when `--repol` is enabled. |

### Motion and Parameter Files

| File | Description |
|------|-------------|
| `${subj}_eddy.eddy_movement_rms` | Root mean square (RMS) displacement over time. Two columns: absolute displacement (relative to the first volume) and relative displacement (relative to the previous volume). One row per volume. |
| `${subj}_eddy.eddy_restricted_movement_rms` | Same as above but restricted to translational movement only (no rotation component). Useful for distinguishing translational motion from rotational motion. |
| `${subj}_eddy.eddy_parameters` | Six motion parameters per volume (three translations in mm, three rotations in radians), plus eddy-current parameters. One row per volume. Analogous to the motion parameter files produced by `mcflirt` in fMRI processing. |

## Quality Check

Eddy correction QC is arguably the most important quality control step in the entire DTI pipeline. Poor eddy correction -- or severe motion that eddy cannot fully correct -- will propagate errors into every downstream metric (FA, MD, tractography, TBSS).

### Per-Subject QC: eddy_quad

`eddy_quad` (Quality Assessment for DMRI) generates a comprehensive HTML report for a single subject:

```bash
eddy_quad "$output_dir/${subj}_eddy" \
  -idx "$config_dir/index.txt" \
  -par "$config_dir/acqp.txt" \
  -m "$input_dir/${subj}_topup_Tmean_brain_mask.nii.gz" \
  -b "$input_dir/${subj}_dwi.bval"
```

This produces a directory `${subj}_eddy.qc/` containing:

- **`qc.pdf`** or **`qc.html`**: a visual report with the following sections:
  - **Motion plots**: absolute and relative displacement over time. Look for sudden jumps (indicative of abrupt head movements) and gradual drift.
  - **Outlier slice counts**: number of outlier slices per volume and per slice. A few outlier slices are normal; a large number suggests problematic data.
  - **CNR per shell**: contrast-to-noise ratio for each b-value shell. CNR should be reasonably consistent across the brain and across shells (within the expected decrease at higher b-values).
  - **Average motion summary statistics**: numerical values for mean absolute motion, mean relative motion, and outlier counts.

### Group-Level QC: eddy_squad

`eddy_squad` (Study-level Quality Assessment for DMRI) compares QC metrics across all subjects in a study:

```bash
# Create a text file listing all eddy_quad output directories
ls -d "$output_dir"/sub-*_eddy.qc > "$qc_dir/squad_list.txt"

# Run group-level QC
eddy_squad "$qc_dir/squad_list.txt"
```

This produces a group-level report that identifies statistical outlier subjects across multiple QC metrics. It is the most efficient way to flag subjects that may need exclusion before investing time in visual inspection of every subject.

### Key Metrics to Evaluate

**Average absolute motion (mm):**
The mean displacement of the brain from the first volume across the entire scan. Values below 1 mm are good. Values between 1-2 mm are acceptable but warrant visual inspection. Values above 2 mm are cause for concern and may require subject exclusion.

**Average relative motion (mm):**
The mean volume-to-volume displacement. This metric captures sudden jerky movements. Lower values are always better. High relative motion with low absolute motion suggests the subject made frequent small corrections rather than a single large shift.

**Percentage of outlier slices:**
The total number of slices flagged as outliers divided by the total number of slices across all volumes. A few percent is normal. A high percentage (>10%) suggests the data may be severely degraded even after outlier replacement.

**CNR by shell:**
The contrast-to-noise ratio should be consistent across subjects for the same acquisition protocol. A subject with substantially lower CNR than the group may have had a hardware problem, excessive motion, or other acquisition issue.

### Recommended Exclusion Criteria

The following thresholds are general guidelines. Adjust based on your study population, acquisition protocol, and research question:

| Metric | Threshold | Action |
|--------|-----------|--------|
| Average absolute motion | > 2 mm | Strongly consider exclusion |
| Average relative motion | > 1 mm | Visual inspection required; consider exclusion |
| Volumes with > 4 SD signal dropout | > 5 volumes | Visual inspection required |
| Outlier slice percentage | > 10% | Visual inspection required; consider exclusion |
| CNR far below group mean | > 2 SD below mean | Investigate cause; consider exclusion |

These are guidelines, not absolute rules. The decision to exclude a subject should consider the totality of the QC evidence, the sample size, and the research question. For small studies, excluding subjects has a larger impact on statistical power. For clinical studies with difficult-to-recruit populations, more lenient thresholds may be appropriate if the impact on data quality is documented.

## Visual Inspection

Automated QC metrics should always be supplemented with visual inspection. Load the eddy-corrected 4D data in FSLeyes:

```bash
fsleyes "$output_dir/${subj}_eddy.nii.gz" &
```

### What to Look For

1. **Scroll through all volumes** (use the volume slider or arrow keys). Each volume should show a brain with consistent geometry. Look for:
   - **Signal dropout**: individual slices or partial slices that are anomalously dark. A few may remain even after `--repol`.
   - **Excessive brightness**: slices that are much brighter than surrounding slices, which can indicate reconstruction artifacts.
   - **Residual geometric distortions**: if the brain shape changes noticeably between volumes, eddy correction may have been incomplete.

2. **Compare pre- and post-correction**. Load the uncorrected and corrected images side by side:

   ```bash
   fsleyes \
     "$input_dir/${subj}_dwi_denoised_degibbs.nii.gz" \
     "$output_dir/${subj}_eddy.nii.gz" &
   ```

   Toggle between them at the same volume index. You should see that edges are sharper and brain boundaries are more consistent across volumes in the corrected data.

3. **Check specific high-motion volumes**. Consult the motion plots from `eddy_quad` to identify volumes with the largest displacement, then inspect those volumes closely in FSLeyes.

## Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| **eddy fails silently or produces empty output** | Often caused by a mismatch between the number of volumes in the DWI file, the number of entries in `index.txt`, and the number of entries in the bvec/bval files | Verify with `fslnvols` that the DWI volume count matches the number of entries in `index.txt` and the number of columns in the bvec/bval files |
| **eddy crashes with a segmentation fault** | Mask is too small, corrupt input data, or insufficient memory | Try a more generous brain mask; check input data integrity with `fslinfo`; increase available RAM |
| **Very high motion subjects** | Subject moved excessively during acquisition | Review the `eddy_movement_rms` file and QC report. If average absolute motion exceeds 2 mm, the subject likely needs to be excluded. `--repol` can salvage some data, but cannot fully recover severely corrupted acquisitions |
| **GPU vs CPU results differ** | Should not happen with the same FSL version | Verify both variants are from the same FSL installation. Small floating-point differences (< 0.001) in the last decimal place are normal and due to differences in floating-point arithmetic between GPU and CPU |
| **Forgetting to use rotated bvecs** | Common mistake that silently produces incorrect results | **Always** use `${subj}_eddy.eddy_rotated_bvecs` for all downstream analysis. The original bvec file no longer correctly describes the gradient directions after motion correction has rotated the volumes. This error will not produce an obvious crash -- the pipeline will run, but FA, MD, and tractography results will be subtly wrong |
| **index.txt has wrong number of entries** | Mismatch between the DWI file used for TOPUP/earlier steps and the file passed to eddy | Re-count volumes with `fslnvols` and regenerate `index.txt` |
| **eddy runs extremely slowly** | Using `eddy_openmp` on a large dataset without GPU acceleration | Switch to `eddy_cuda` if a compatible GPU is available. Alternatively, reduce `--niter` (not recommended unless necessary) |
| **Negative or NaN voxels in output** | Can occur at the edges of the brain where the mask is borderline | Check the mask; a slightly more generous mask usually resolves this |

The most common and most consequential mistake after running eddy is to use the original `.bvec` file instead of the `eddy_rotated_bvecs` file for downstream analysis. When eddy corrects for head rotation, it physically rotates each volume back to the reference position. The gradient direction recorded in the original bvec file described the gradient relative to the head before rotation. After correction, the gradient direction relative to the (now-realigned) head is different. The `eddy_rotated_bvecs` file contains these updated directions. Using the original bvecs will produce systematically incorrect FA, MD, and tractography results with no error messages or warnings.

## References

- Andersson, J. L. R., & Sotiropoulos, S. N. (2016). An integrated approach to correction for off-resonance effects and subject movement in diffusion MR images. *NeuroImage*, 125, 1063-1078. [https://doi.org/10.1016/j.neuroimage.2015.10.019](https://doi.org/10.1016/j.neuroimage.2015.10.019)
- Andersson, J. L. R., Graham, M. S., Zsoldos, E., & Sotiropoulos, S. N. (2016). Incorporating outlier detection and replacement into a non-parametric framework for movement and distortion correction of diffusion MR images. *NeuroImage*, 141, 556-572. [https://doi.org/10.1016/j.neuroimage.2016.06.058](https://doi.org/10.1016/j.neuroimage.2016.06.058)
- Andersson, J. L. R., Graham, M. S., Drobnjak, I., Zhang, H., Filippini, N., & Bastiani, M. (2017). Towards a comprehensive framework for movement and distortion correction of diffusion MR images: Within volume movement. *NeuroImage*, 152, 450-466. [https://doi.org/10.1016/j.neuroimage.2017.02.085](https://doi.org/10.1016/j.neuroimage.2017.02.085)
- FSL eddy User Guide: [https://fsl.fmrib.ox.ac.uk/fsl/fslwiki/eddy](https://fsl.fmrib.ox.ac.uk/fsl/fslwiki/eddy)
- FSL eddy_quad User Guide: [https://fsl.fmrib.ox.ac.uk/fsl/fslwiki/eddyqc/UsersGuide](https://fsl.fmrib.ox.ac.uk/fsl/fslwiki/eddyqc/UsersGuide)

## Next Step

Proceed to **[Step 9: Tensor Fitting (DTIFIT)](./dtifit)** to compute FA and the other tensor metrics.

Eddy also marks the end of Part A. From here the path splits: tensor fitting (Step 9) and response function estimation (Step 11) are independent of each other and can run in parallel. Both are needed before the [handoff](./output-contract).
