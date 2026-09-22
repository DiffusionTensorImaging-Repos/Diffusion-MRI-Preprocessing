---
sidebar_position: 3
title: "BIDS Standard"
---

# The Brain Imaging Data Structure (BIDS)

## Overview

BIDS is a community standard for organizing and describing neuroimaging datasets. Adopting BIDS ensures your data is:
- **Self-describing**: Anyone can understand the dataset structure without asking the person who collected it
- **Compatible**: Works with a growing ecosystem of BIDS-aware tools (pyAFQ, QSIPrep, fMRIPrep, MRIQC)
- **Reproducible**: Standardized naming eliminates ambiguity about what each file contains
- **Shareable**: Platforms like OpenNeuro require BIDS format for data sharing

If you plan to use pyAFQ for tract profiling (see [BIDS & pyAFQ](../pipeline/pyafq-bids)), your data must be in BIDS format.

## BIDS Directory Structure for Diffusion MRI

```
my_study/
  dataset_description.json    # Required: study name, BIDS version
  participants.tsv            # Subject demographics (age, sex, group)
  README                      # Study description

  sub-001/
    anat/
      sub-001_T1w.nii.gz      # T1-weighted structural
      sub-001_T1w.json         # Acquisition metadata
    dwi/
      sub-001_dwi.nii.gz      # Diffusion-weighted images (4D)
      sub-001_dwi.json         # Acquisition metadata
      sub-001_dwi.bval         # b-values
      sub-001_dwi.bvec         # Gradient directions
    fmap/
      sub-001_dir-AP_epi.nii.gz    # Fieldmap, anterior-to-posterior
      sub-001_dir-AP_epi.json
      sub-001_dir-PA_epi.nii.gz    # Fieldmap, posterior-to-anterior
      sub-001_dir-PA_epi.json

  sub-002/
    ...

  derivatives/                 # Processed outputs (not raw data)
    preprocessing/
      sub-001/
        dwi/
          sub-001_desc-preproc_dwi.nii.gz
          sub-001_desc-brain_mask.nii.gz
```

## Key Naming Conventions

| Element | Rule | Example |
|---------|------|---------|
| Subject prefix | All files start with `sub-<label>` | `sub-001`, `sub-control01` |
| Modality directories | `anat/` for structural, `dwi/` for diffusion, `fmap/` for fieldmaps | `sub-001/dwi/` |
| Key-value pairs | Separated by underscores, key and value by hyphen | `dir-AP`, `desc-preproc` |
| File extensions | NIfTI files use `.nii.gz`, metadata in `.json` | `sub-001_dwi.nii.gz` |
| Derivatives | Processed data goes in `derivatives/` | `derivatives/pyafq/` |

## Required Files

### dataset_description.json

Every BIDS dataset must have this file in the root directory:

```json
{
  "Name": "My DTI Study",
  "BIDSVersion": "1.8.0",
  "License": "CC0",
  "Authors": ["First Last"],
  "DatasetType": "raw"
}
```

### JSON Sidecars

Every NIfTI file should have a matching JSON file with acquisition metadata. For diffusion data, critical fields include:

```json
{
  "PhaseEncodingDirection": "j-",
  "TotalReadoutTime": 0.0959097,
  "EffectiveEchoSpacing": 0.000689998,
  "Manufacturer": "Siemens",
  "MagneticFieldStrength": 3,
  "MultibandAccelerationFactor": 3
}
```

These JSON files are automatically created by `dcm2niix` during DICOM conversion.

### participants.tsv

A tab-separated file with subject-level metadata:

```
participant_id	age	sex	group
sub-001	24	M	control
sub-002	27	F	patient
sub-003	22	F	control
```

## Validating Your Dataset

Use the BIDS Validator to check that your dataset follows the standard:

```bash
# Web-based (drag and drop — no upload, runs in browser):
# https://bids-standard.github.io/bids-validator/

# Command-line:
npm install -g bids-validator
bids-validator /path/to/my_study

# Docker:
docker run -v /path/to/my_study:/data bids/validator /data
```

The validator will list any errors (required files missing) and warnings (recommended files missing). Fix all errors before using BIDS-aware tools.

## Converting Your Pipeline Output to BIDS

The preprocessing pipeline in this tutorial does not produce BIDS-formatted output by default. [BIDS & pyAFQ](../pipeline/pyafq-bids) walks through copying and renaming your processed files into BIDS format for use with pyAFQ and other BIDS-aware tools.

## BIDS-Aware Processing Tools

Once your data is in BIDS format, you can use tools that automatically find and process the right files:

| Tool | What It Does |
|------|-------------|
| **pyAFQ** | Automated white matter tract identification and along-tract profiling |
| **QSIPrep** | Complete diffusion preprocessing pipeline (alternative to the manual pipeline in this tutorial) |
| **MRIQC** | Automated quality control metrics and reports |
| **fMRIPrep** | Functional MRI preprocessing (if your study includes fMRI) |
| **TractSeg** | Neural network-based tract segmentation |

## References

- Gorgolewski KJ, Auer T, Calhoun VD, et al. (2016). The brain imaging data structure, a format for organizing and describing outputs of neuroimaging experiments. *Scientific Data*, 3, 160044.
- BIDS Specification: [https://bids-specification.readthedocs.io/](https://bids-specification.readthedocs.io/)
- BIDS Validator: [https://bids-standard.github.io/bids-validator/](https://bids-standard.github.io/bids-validator/)
