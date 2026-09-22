---
sidebar_position: 11
title: "Step 10: Registration (FLIRT)"
---

# Step 10: Registration and Spatial Alignment

## Overview

Registration aligns images from different spaces so that the same brain structures overlap. In DTI preprocessing, you need to create a chain of transformations that connect three spaces:

1. **Diffusion space** — where your DTI data lives
2. **Structural (T1) space** — the high-resolution anatomical image
3. **Standard (MNI) space** — a common template used for group comparisons

This step computes six transformation matrices that let you move images and coordinates freely between these spaces.

**Further reading:** [FSL Registration Practical](https://fsl.fmrib.ox.ac.uk/fslcourse/graduate/lectures/practicals/registration/) — FSL Course covering the two-step diffusion-to-structural-to-standard registration pathway

## Conceptual Background

### Why Register?

Different MRI sequences produce images in different spaces — they have different resolutions, fields of view, and geometric distortions. Registration is needed to:

- **Overlay DTI metrics on anatomy**: FA maps (in diffusion space) onto T1 images (in structural space)
- **Compare across subjects**: transform all subjects' DTI data into MNI space for group statistics
- **Apply atlas ROIs**: atlas parcellations are defined in MNI space; you need to bring them back to each subject's diffusion space for tractography seeding or region-of-interest analysis

### Degrees of Freedom (DOF)

FLIRT performs **linear registration** — it finds the best spatial transformation using a limited set of parameters:

| DOF | Name | What It Allows | When to Use |
|-----|------|---------------|-------------|
| **6** | Rigid body | 3 translations + 3 rotations | Same brain, different contrast (diffusion → structural) |
| **12** | Affine | 6 rigid + 3 scales + 3 shears | Different brains, similar shape (structural → MNI template) |

**Why 6 DOF for diffusion → structural?** These are images of the same person's brain acquired in the same session. The brain did not change shape — it just moved slightly between acquisitions and has different contrast. Only rigid alignment (translation + rotation) is needed.

**Why 12 DOF for structural → MNI?** Different people have different brain sizes and shapes. The affine transformation allows scaling and shearing to account for these individual differences.

### The Transformation Chain

```
Diffusion ──(6 DOF)──> Structural ──(12 DOF)──> Standard (MNI)
```

By concatenating these two transforms, you get a direct diffusion → standard mapping. You also compute the inverse transforms to go in the opposite direction.

### Template Selection

| Population | Recommended Template | Source |
|-----------|---------------------|--------|
| Adults (18–65) | MNI152_T1_2mm_brain | Included with FSL (`$FSLDIR/data/standard/`) |
| Older adults (65+) | OASIS template | [ANTs templates](https://figshare.com/articles/dataset/ANTs_ANTsR_Brain_Templates/915436) |
| Children (4–18) | NIH Pediatric template | [NIH Pediatric Database](https://www.bmap.ucla.edu/portfolio/atlases/NIH_Pediatric/) |
| Infants | Age-specific atlas | [dHCP atlas](https://brain-development.org/brain-atlases/) |
| Study-specific | Build your own | `antsMultivariateTemplateConstruction2.sh` from ANTs |

:::tip MNI152 Is the Default
If your participants are healthy adults, the MNI152_T1_2mm_brain template included with FSL is the standard choice. It is used by most DTI studies and is compatible with all major atlases (JHU, Harvard-Oxford, AAL, etc.).
:::

## Prerequisites

| Input | Source | Description |
|-------|--------|-------------|
| FA map | [Step 9: DTIFIT](./dtifit) | Fractional anisotropy image in diffusion space |
| Brain-extracted T1 | [Step 2: Skull Stripping](./skull-stripping) | ANTs skull-stripped structural image |
| MNI template | FSL installation | `$FSLDIR/data/standard/MNI152_T1_2mm_brain` |

## Commands

### Step 1: Diffusion → Structural (6 DOF)

```bash
# ──────────────────────────────────────────────
# Define paths
# ──────────────────────────────────────────────
dtifit_dir="$base_dir/dtifit/$subj"
ants_dir="$base_dir/ants/$subj"
output_dir="$base_dir/registration/$subj"

mkdir -p "$output_dir"

# ──────────────────────────────────────────────
# Register FA map to skull-stripped T1
# ──────────────────────────────────────────────
flirt -in "$dtifit_dir/${subj}_DTI_FA" \
      -ref "$ants_dir/${subj}_BrainExtractionBrain" \
      -out "$output_dir/${subj}_diff2str" \
      -omat "$output_dir/${subj}_diff2str.mat" \
      -dof 6
```

### Step 2: Structural → Standard (12 DOF)

```bash
flirt -in "$ants_dir/${subj}_BrainExtractionBrain" \
      -ref "$FSLDIR/data/standard/MNI152_T1_2mm_brain" \
      -out "$output_dir/${subj}_str2standard" \
      -omat "$output_dir/${subj}_str2standard.mat" \
      -dof 12
```

### Step 3: Compute Inverse Transforms

```bash
convert_xfm -omat "$output_dir/${subj}_str2diff.mat" \
            -inverse "$output_dir/${subj}_diff2str.mat"

convert_xfm -omat "$output_dir/${subj}_standard2str.mat" \
            -inverse "$output_dir/${subj}_str2standard.mat"
```

### Step 4: Concatenate Diffusion → Standard

```bash
convert_xfm -omat "$output_dir/${subj}_diff2standard.mat" \
            -concat "$output_dir/${subj}_str2standard.mat" \
                    "$output_dir/${subj}_diff2str.mat"
```

:::caution Concatenation Order
The `-concat` flag applies transforms in right-to-left order. So `-concat A B` means "apply B first, then A." In this case: diffusion→structural (B) then structural→standard (A) = diffusion→standard.
:::

### Step 5: Inverse of Concatenated

```bash
convert_xfm -omat "$output_dir/${subj}_standard2diff.mat" \
            -inverse "$output_dir/${subj}_diff2standard.mat"
```

## Batch Processing Script

```bash
#!/bin/bash
# registration.sh — Compute all registration transforms for all subjects

base_dir="/path/to/project"
standard="$FSLDIR/data/standard/MNI152_T1_2mm_brain"

subjects=$(ls -d "$base_dir/dtifit"/sub-* 2>/dev/null | xargs -n1 basename)

for subj in $subjects; do
    echo "Processing: $subj"

    dtifit_dir="$base_dir/dtifit/$subj"
    ants_dir="$base_dir/ants/$subj"
    output_dir="$base_dir/registration/$subj"
    mkdir -p "$output_dir"

    flirt -in "$dtifit_dir/${subj}_DTI_FA" \
          -ref "$ants_dir/${subj}_BrainExtractionBrain" \
          -out "$output_dir/${subj}_diff2str" \
          -omat "$output_dir/${subj}_diff2str.mat" -dof 6

    flirt -in "$ants_dir/${subj}_BrainExtractionBrain" \
          -ref "$standard" \
          -out "$output_dir/${subj}_str2standard" \
          -omat "$output_dir/${subj}_str2standard.mat" -dof 12

    convert_xfm -omat "$output_dir/${subj}_str2diff.mat" \
                -inverse "$output_dir/${subj}_diff2str.mat"
    convert_xfm -omat "$output_dir/${subj}_standard2str.mat" \
                -inverse "$output_dir/${subj}_str2standard.mat"
    convert_xfm -omat "$output_dir/${subj}_diff2standard.mat" \
                -concat "$output_dir/${subj}_str2standard.mat" \
                        "$output_dir/${subj}_diff2str.mat"
    convert_xfm -omat "$output_dir/${subj}_standard2diff.mat" \
                -inverse "$output_dir/${subj}_diff2standard.mat"

    echo "  Done: $subj"
done
echo "Registration complete."
```

## Expected Output

Six transformation matrices per subject:

| File | Direction | Purpose |
|------|-----------|---------|
| `diff2str.mat` | Diffusion → Structural | Overlay DTI on anatomy |
| `str2diff.mat` | Structural → Diffusion | Bring structural ROIs to diffusion space |
| `str2standard.mat` | Structural → MNI | Normalize structural to template |
| `standard2str.mat` | MNI → Structural | Bring atlas labels to subject space |
| `diff2standard.mat` | Diffusion → MNI | Group analysis in standard space |
| `standard2diff.mat` | MNI → Diffusion | Bring atlas ROIs to diffusion space |

## Quality Check

Apply the diffusion→standard transform and visually verify alignment:

```bash
flirt -in "$dtifit_dir/${subj}_DTI_FA" \
      -ref "$FSLDIR/data/standard/MNI152_T1_2mm_brain" \
      -applyxfm -init "$output_dir/${subj}_diff2standard.mat" \
      -out "$output_dir/${subj}_FA_in_MNI"

fsleyes "$FSLDIR/data/standard/MNI152_T1_2mm_brain" \
        "$output_dir/${subj}_FA_in_MNI" -cm red-yellow -a 50 &
```

**Good**: FA map aligns with the template — major tracts overlap with expected anatomy.
**Bad**: Obvious misalignment, brain shifted or rotated.

### When FLIRT Is Not Enough

FLIRT performs **linear** registration. For analyses requiring more precise alignment (TBSS, VBA), consider **FNIRT** (FSL's nonlinear registration) which deforms the image to match the template more precisely.

## Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Poor diff→str alignment | FA map has low contrast | Check DTIFIT output quality |
| Poor str→standard alignment | Template mismatch for population | Use age-appropriate template |
| FA in MNI looks stretched | Normal for affine registration | Slight differences expected; use FNIRT if needed |

## References

- Jenkinson M, Smith SM (2001). A global optimisation method for robust affine registration of brain images. *Medical Image Analysis*, 5(2), 143-156.
- FSL FLIRT: [https://fsl.fmrib.ox.ac.uk/fsl/fslwiki/FLIRT](https://fsl.fmrib.ox.ac.uk/fsl/fslwiki/FLIRT)

## Next Step

Proceed to **[Step 11: Response Function Estimation](./response-functions)** to begin the CSD modeling chain.

If you also want intracranial volume as a covariate, [ICV Calculation](./icv-calculation) is optional and can be run at any point after Step 2.
