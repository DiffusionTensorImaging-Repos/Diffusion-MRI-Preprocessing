---
sidebar_position: 24
title: "BIDS & pyAFQ (optional)"
---

# BIDS Organization and Automated Fiber Quantification

## Overview

The final step organizes all preprocessed outputs into the **Brain Imaging Data Structure (BIDS)** format and runs **pyAFQ** for automated white matter tract identification and profiling. BIDS is a standardized directory structure that ensures your data is compatible with a wide ecosystem of neuroimaging analysis tools.

## Conceptual Background

### BIDS

BIDS (Brain Imaging Data Structure) is a community standard for organizing neuroimaging data. Instead of every lab inventing their own directory structure, BIDS provides a consistent convention that:

- Makes data immediately usable by BIDS-aware tools (no reformatting needed)
- Makes datasets shareable and reproducible
- Provides clear naming conventions so anyone can understand the data organization

For preprocessed (derivative) data, BIDS requires:
- A specific directory hierarchy (`derivatives/pipeline_name/sub-XXX/dwi/`)
- Standardized file naming (`sub-001_dwi.nii.gz`, `sub-001_dwi.bvec`, etc.)
- A `dataset_description.json` file describing the pipeline

### pyAFQ

pyAFQ (Automated Fiber Quantification) takes your preprocessed, BIDS-organized diffusion data and:

1. **Identifies major white matter tracts** — 24 bundles by default (corticospinal tract, arcuate fasciculus, etc.)
2. **Profiles diffusion metrics along each tract** — sampling FA, MD, RD, AD at 100 points along each bundle
3. **Produces analysis-ready output** — CSV tables and visualizations for statistical testing

See the [pyAFQ tool page](../tools/pyafq) for installation and configuration details.

## Prerequisites

| Input | Source | Description |
|-------|--------|-------------|
| Eddy-corrected DWI | [Step 8: Eddy](./eddy) | Preprocessed diffusion data |
| Rotated bvecs | [Step 8: Eddy](./eddy) | Motion-corrected gradient directions |
| b-values | [Step 1: DICOM to NIfTI](./dicom-to-nifti) | Original b-value file |
| Brain mask | [Step 6: Brain Masking](./brain-masking) | Binary mask in diffusion space |
| T1 structural | [Step 1](./dicom-to-nifti) | Original structural image |
| Brain-extracted T1 | [Step 2: Skull Stripping](./skull-stripping) | Skull-stripped T1 |

## Step 1: Create BIDS Directory Structure

```bash
# ──────────────────────────────────────────────
# Define paths
# ──────────────────────────────────────────────
project_dir="/path/to/project"
bids_dir="$project_dir/derivatives/dmriprep"

mkdir -p "$bids_dir"

# ──────────────────────────────────────────────
# Create dataset_description.json (required by BIDS)
# ──────────────────────────────────────────────
cat > "$bids_dir/dataset_description.json" << 'EOF'
{
  "Name": "DTI Preprocessing Pipeline",
  "BIDSVersion": "1.6.0",
  "PipelineDescription": {
    "Name": "custom-dti-pipeline",
    "Version": "1.0.0",
    "Description": "FSL/ANTs/MRtrix3-based DTI preprocessing"
  }
}
EOF
```

## Step 2: Copy Preprocessed Data

```bash
# ──────────────────────────────────────────────
# For each subject, copy files into BIDS structure
# ──────────────────────────────────────────────
eddy_dir="$project_dir/eddy/$subj"
nifti_dir="$project_dir/nifti/$subj"
mask_dir="$project_dir/topup/$subj"
ants_dir="$project_dir/ants/$subj"

mkdir -p "$bids_dir/$subj/dwi" "$bids_dir/$subj/anat"

# DWI data
cp "$eddy_dir/${subj}_eddy.nii.gz" \
   "$bids_dir/$subj/dwi/${subj}_dwi.nii.gz"

cp "$eddy_dir/${subj}_eddy.eddy_rotated_bvecs" \
   "$bids_dir/$subj/dwi/${subj}_dwi.bvec"

cp "$nifti_dir/dti/${subj}_dti.bval" \
   "$bids_dir/$subj/dwi/${subj}_dwi.bval"

cp "$mask_dir/${subj}_topup_Tmean_brain_mask.nii.gz" \
   "$bids_dir/$subj/dwi/${subj}_space-dwi_desc-brain_mask.nii.gz"

# Anatomical data
cp "$nifti_dir/struct/${subj}_struct.nii.gz" \
   "$bids_dir/$subj/anat/${subj}_T1w.nii.gz"

cp "$ants_dir/${subj}_BrainExtractionBrain.nii.gz" \
   "$bids_dir/$subj/anat/${subj}_desc-brain_T1w.nii.gz"
```

## Step 3: Run pyAFQ

### Python API

```python
import AFQ.api.group as afq

myafq = afq.GroupAFQ(
    bids_path="/path/to/project",
    preproc_pipeline="dmriprep",
)

myafq.export_all()
```

### Command Line

```bash
pyAFQ config --output afq_config.toml
# Edit afq_config.toml, then:
pyAFQ run afq_config.toml
```

## pyAFQ Output

| Output | Description |
|--------|-------------|
| `combined_tract_profiles.csv` | All subjects' tract profiles — primary analysis output |
| `*_tractography.trk` | Streamline files per bundle |
| `*_viz.html` | Interactive 3D visualizations |

## Quality Check

1. **Validate BIDS**: run `bids-validator` or use the [online validator](https://bids-standard.github.io/bids-validator/)
2. **Review visualizations**: open HTML files in a browser to verify tract segmentations
3. **Check profile completeness**: ensure all subjects have all expected tracts

## References

- Gorgolewski KJ, et al. (2016). The brain imaging data structure. *Scientific Data*, 3, 160044.
- Yeatman JD, et al. (2012). Tract profiles of white matter properties. *PLoS One*, 7(11), e49790.
- [BIDS Specification](https://bids-specification.readthedocs.io/)
- [pyAFQ Documentation](https://yeatmanlab.github.io/pyAFQ/)
