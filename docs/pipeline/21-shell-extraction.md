---
sidebar_position: 21
title: "Shell Extraction (optional)"
---

# Shell Extraction — Removing Very Low Shells

If your acquisition includes a low b-value shell (e.g., b=250 s/mm²), this step removes it. At b-values below ~300 s/mm², microvascular perfusion contaminates the diffusion signal through a phenomenon called **intravoxel incoherent motion (IVIM)**. This pseudo-diffusion from capillary blood flow inflates apparent diffusivity estimates by 4–8% and can cause instability in tensor fitting.

Most modern diffusion protocols do not collect b=250 at all — the Human Connectome Project uses b=1000/2000/3000, UK Biobank uses b=1000/2000, and ABCD uses b=500/1000/2000/3000. Very low non-zero shells such as b=250 sit close to the noise floor for tensor and multi-tissue fitting, and including them can destabilize downstream modeling.

If your data does not include a low b-value shell like b=250, skip this step.

**Further reading:** [FSL Diffusion Toolbox Practical](https://fsl.fmrib.ox.ac.uk/fslcourse/2019_Beijing/lectures/FDT/fdt1.html) — FSL Course (Beijing 2019)

## Inspecting Your Shells

Before extracting, check what shells you have:

```bash
# Read the .bval file directly
cat "$input_dir/${subj}_dti.bval"
# Example: 0 0 250 250 1000 1000 1000 2000 2000 2000 3250 3250 5000 5000 ...

# Use MRtrix3 to identify detected shells
mrinfo "$input_dir/${subj}_eddy.nii.gz" \
    -fslgrad "$input_dir/${subj}_eddy.eddy_rotated_bvecs" "$input_dir/${subj}_dti.bval" \
    -shell_bvalues
# Example output: 0 250 1000 2000 3250 5000
```

Scanners often produce b-values like 248, 1003, or 2005 instead of exactly 250, 1000, or 2000. MRtrix3 handles this automatically by grouping b-values within a tolerance (default ±100).

## Prerequisites

| Input | Source | Description |
|-------|--------|-------------|
| Eddy-corrected DWI | [Step 8: Eddy](./eddy) | 4D diffusion volume |
| Rotated bvecs | [Step 8: Eddy](./eddy) | Gradient directions corrected for head rotation |
| b-values | [Step 1: DICOM to NIfTI](./dicom-to-nifti) | Original b-value file |

Use the rotated bvecs from eddy (`eddy_rotated_bvecs`), not the original bvecs from DICOM conversion. Eddy corrects for head rotation during the scan and updates the gradient directions accordingly. Using the original bvecs means your gradient directions no longer match the data.

## Command

Remove b=250 by extracting only the shells you want to keep:

```bash
# ──────────────────────────────────────────────
# Define paths
# ──────────────────────────────────────────────
eddy_dir="$base_dir/eddy/$subj"
nifti_dir="$base_dir/nifti/$subj/dti"
output_dir="$base_dir/shells/$subj"

mkdir -p "$output_dir"

# ──────────────────────────────────────────────
# Remove b=250, keep all other shells
# ──────────────────────────────────────────────
dwiextract "$eddy_dir/${subj}_eddy.nii.gz" \
    "$output_dir/${subj}_dwi_no_b250.nii.gz" \
    -fslgrad "$eddy_dir/${subj}_eddy.eddy_rotated_bvecs" \
             "$nifti_dir/${subj}_dti.bval" \
    -shells 0,1000,2000,3250,5000 \
    -export_grad_fsl "$output_dir/${subj}_dwi_no_b250.bvec" \
                     "$output_dir/${subj}_dwi_no_b250.bval"
```

Adjust the `-shells` values to match your acquisition. The key is to list every shell you want to **keep**, omitting b=250.

## Batch Processing

```bash
#!/bin/bash
# shell_extraction.sh — Remove b=250 shell for all subjects

base_dir="/path/to/project"

for subj_dir in "$base_dir"/eddy/sub-*; do
    subj=$(basename "$subj_dir")
    echo "Processing: $subj"

    mkdir -p "$base_dir/shells/$subj"

    dwiextract "$subj_dir/${subj}_eddy.nii.gz" \
        "$base_dir/shells/$subj/${subj}_dwi_no_b250.nii.gz" \
        -fslgrad "$subj_dir/${subj}_eddy.eddy_rotated_bvecs" \
                 "$base_dir/nifti/$subj/dti/${subj}_dti.bval" \
        -shells 0,1000,2000,3250,5000 \
        -export_grad_fsl "$base_dir/shells/$subj/${subj}_dwi_no_b250.bvec" \
                         "$base_dir/shells/$subj/${subj}_dwi_no_b250.bval"

    echo "  Done: $subj"
done
```

## Quality Check

### Verify Volume Count

The number of volumes should decrease by the number of b=250 volumes that were removed:

```bash
# Compare volume counts
fslnvols "$eddy_dir/${subj}_eddy.nii.gz"
# Example: 198 (original)

fslnvols "$output_dir/${subj}_dwi_no_b250.nii.gz"
# Example: 186 (after removing 12 b=250 volumes)
```

### Verify Correct B-Values

```bash
cat "$output_dir/${subj}_dwi_no_b250.bval"
# Should contain only values near 0, 1000, 2000, 3250, 5000
# No values near 250
```

## References

- Federau C, O'Brien K, Meuli R, et al. (2014). Measuring brain perfusion with intravoxel incoherent motion (IVIM): initial clinical experience. *Journal of Magnetic Resonance Imaging*, 39(3), 624-632.
- Pasternak O, Sochen N, Gur Y, Intrator N, Assaf Y (2009). Free water elimination and mapping from diffusion MRI. *Magnetic Resonance in Medicine*, 62(3), 717-730.
- MRtrix3 dwiextract: [https://mrtrix.readthedocs.io/en/latest/reference/commands/dwiextract.html](https://mrtrix.readthedocs.io/en/latest/reference/commands/dwiextract.html)

## Next Step

Proceed to **[Step 9: Tensor Fitting (DTIFIT)](./dtifit)** to fit the diffusion tensor model and compute FA, MD, AD, and RD maps.
