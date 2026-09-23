---
sidebar_position: 7
title: "QSIPrep"
---

# QSIPrep

## QSIPrep

QSIPrep is a containerized BIDS-app for preprocessing diffusion MRI data, developed by the PennLINC group at the University of Pennsylvania. It provides an automated, reproducible pipeline that handles the full diffusion preprocessing workflow inside a Docker or Singularity container.

Under the hood, QSIPrep uses many of the same tools covered in this tutorial -- FSL, ANTs, MRtrix3, and others. It orchestrates these tools automatically, applying sensible defaults and handling the interdependencies between steps. Because QSIPrep runs inside a container, there is no need to manually install FSL, ANTs, MRtrix3, or any other dependency.

## QSIPrep Coverage

QSIPrep automates the standard diffusion preprocessing steps:

- **Denoising** (MP-PCA)
- **Gibbs ringing correction**
- **Motion correction**
- **Eddy current correction**
- **Susceptibility distortion correction**
- **Brain extraction**
- **Spatial normalization**

It also produces built-in visual QC reports and follows BIDS naming conventions for both input and output.

## Basic Usage

QSIPrep expects BIDS-formatted input data and produces BIDS-derivatives output:

```bash
qsiprep $bids_dir $output_dir participant \
  --participant-label $subj \
  --output-resolution 1.5 \
  --fs-license-file $license_file
```

### Running with Docker

```bash
docker run -ti --rm \
  -v $bids_dir:/data:ro \
  -v $output_dir:/out \
  -v $license_file:/license.txt:ro \
  pennbbl/qsiprep:latest \
  /data /out participant \
  --participant-label $subj \
  --output-resolution 1.5 \
  --fs-license-file /license.txt
```

### Running with Singularity

```bash
singularity run --cleanenv \
  -B $bids_dir:/data:ro \
  -B $output_dir:/out \
  -B $license_file:/license.txt:ro \
  qsiprep.sif \
  /data /out participant \
  --participant-label $subj \
  --output-resolution 1.5 \
  --fs-license-file /license.txt
```

## QSIPrep Outputs

QSIPrep produces preprocessed diffusion data, brain masks, confound time series (framewise displacement, etc.), visual QC reports in HTML format, and optional reconstruction outputs.

All outputs follow BIDS-derivatives naming conventions:

```
$output_dir/
  qsiprep/
    sub-001/
      anat/
      dwi/
        sub-001_space-ACPC_desc-preproc_dwi.nii.gz
        sub-001_space-ACPC_desc-preproc_dwi.bval
        sub-001_space-ACPC_desc-preproc_dwi.bvec
        sub-001_space-ACPC_desc-brain_mask.nii.gz
        sub-001_space-ACPC_dwiref.nii.gz
      figures/
```

## QSIPrep vs. This Tutorial

QSIPrep replaces Part A of this tutorial (Steps 1–8) with one container run; [Part A in One Command](../pipeline/qsiprep-route) shows the command and maps its outputs onto the handoff contract. It is the right default for a new or multi-site study. The manual steps remain the way to learn what each correction does and to handle acquisitions QSIPrep does not support. Part B runs the same either way.

This tutorial does not validate that QSIPrep produces identical results to the manual pipeline described here. While the underlying algorithms are similar, the specific parameter choices, step ordering, and implementation details may differ.

## Links and References

- **Documentation:** [qsiprep.readthedocs.io](https://qsiprep.readthedocs.io/)
- **GitHub:** [github.com/PennLINC/qsiprep](https://github.com/PennLINC/qsiprep)
- **Reference:** Cieslak, M., Cook, P.A., He, X., Yeh, F.-C., Dhollander, T., Adebimpe, A., ... & Satterthwaite, T.D. (2021). QSIPrep: an integrative platform for preprocessing and reconstructing diffusion MRI data. *Nature Methods*, 18(7), 775-778. https://doi.org/10.1038/s41592-021-01185-5
