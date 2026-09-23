---
sidebar_position: 4
title: "File Formats in Neuroimaging"
---

# File Formats in Neuroimaging

The preprocessing pipeline produces and consumes several file formats: image data, metadata, and transformation parameters.

## DICOM (.dcm)

**What it is:** The raw output format from the MRI scanner.

**What is inside:** Each DICOM file typically contains a single 2D image slice along with an extensive metadata header. The header includes patient demographics (name, ID, date of birth), scan parameters (TR, TE, flip angle, field strength), spatial information (slice orientation, position, voxel dimensions), and vendor-specific fields.

**When you encounter it:** At the very beginning of the pipeline. Raw data arrives from the scanner as a directory (or directories) of DICOM files -- often thousands of them for a single scanning session.

**Key points:**
- DICOM is not suitable for analysis. The first pipeline step is always to convert DICOM to an analysis-friendly format (NIfTI).
- DICOM headers contain protected health information (PHI). Handle these files according to your institution's data governance policies.
- DICOM organization varies by scanner vendor (Siemens, GE, Philips). Conversion tools like `dcm2niix` handle these differences automatically.
- You generally interact with DICOM files only once (during conversion) and then work exclusively with NIfTI from that point forward.

## NIfTI (.nii / .nii.gz)

**What it is:** The standard image format for neuroimaging analysis. NIfTI (Neuroimaging Informatics Technology Initiative) replaced the older Analyze format and is supported by virtually every neuroimaging tool.

**What is inside:** A binary file containing a header (348 bytes in NIfTI-1) followed by the image data. The header stores:
- **Dimensions**: the size of the image (e.g., 96 x 96 x 60 voxels x 200 volumes for a 4D DWI dataset)
- **Voxel size**: physical dimensions of each voxel in millimeters (e.g., 2mm x 2mm x 2mm)
- **Orientation**: an affine matrix that maps voxel coordinates to real-world (scanner) coordinates
- **Data type**: how voxel values are stored (e.g., 16-bit integer, 32-bit float)

**3D vs. 4D:**
- **3D NIfTI**: A single brain volume. Examples: a T1-weighted structural scan, an FA map, a brain mask.
- **4D NIfTI**: A series of 3D volumes stacked along a time/volume dimension. Examples: a DWI dataset (one volume per gradient direction), an fMRI time series.

**Compressed vs. uncompressed:**
- `.nii` -- uncompressed. Faster to read/write but uses more disk space.
- `.nii.gz` -- gzip-compressed. Standard practice for storage and distribution. Most tools read `.nii.gz` directly, though some (particularly older ones) require uncompressed input.

**When you encounter it:** After DICOM conversion and throughout the entire pipeline. Every intermediate and final output is typically a NIfTI file.

## JSON Sidecar Files (.json)

**What it is:** A text file in JSON format containing acquisition metadata extracted during DICOM-to-NIfTI conversion.

**What is inside:** Key scan parameters that are not stored in the NIfTI header but are needed by processing tools. Common fields include:

```json
{
  "RepetitionTime": 3.5,
  "EchoTime": 0.089,
  "EffectiveEchoSpacing": 0.000689991,
  "TotalReadoutTime": 0.0662391,
  "PhaseEncodingDirection": "j-",
  "MultibandAccelerationFactor": 3
}
```

**When you encounter it:** Immediately after DICOM conversion (produced by `dcm2niix`). These files are critical inputs for:
- **TOPUP**: needs `TotalReadoutTime` and `PhaseEncodingDirection` to correct susceptibility distortions.
- **EDDY**: needs phase encoding information and readout time.
- **Any BIDS-compliant pipeline**: JSON sidecars are a core component of the BIDS standard.

Always inspect your JSON sidecar files early in the pipeline. Missing or incorrect metadata here will cause silent errors downstream. The `PhaseEncodingDirection` and `TotalReadoutTime` fields are especially important to verify.

## B-Value and B-Vector Files (.bval / .bvec)

**What they are:** Plain text files that encode the diffusion weighting parameters for each volume in a 4D DWI dataset. See [B-Values and Gradient Directions](./b-values-and-gradients.md) for a detailed explanation.

### .bval File

A single row of space-separated b-values, one per volume:

```
0 0 1000 1000 1000 2000 2000 2000
```

### .bvec File

Three rows (x, y, z components) of gradient directions, one column per volume:

```
0 0 0.612 -0.334 0.801 0.612 -0.334 0.801
0 0 0.453 0.891 -0.227 0.453 0.891 -0.227
0 0 0.648 -0.309 0.553 0.648 -0.309 0.553
```

**When you encounter them:** Produced alongside the NIfTI file during DICOM conversion. Referenced and modified at multiple pipeline stages -- particularly during shell extraction, gradient rotation (after eddy current correction), and tensor fitting.

## FSL Transformation Matrices (.mat)

**What it is:** A text file containing a 4x4 affine transformation matrix used by FSL tools (primarily FLIRT) for registration.

**What is inside:** Four rows of four numbers representing a linear transformation (rotation, translation, scaling, shearing) between two image spaces:

```
1.0023  0.0041  -0.0012  -0.4521
-0.0039  0.9987  0.0103   1.2340
0.0015  -0.0098  1.0014  -0.7812
0       0        0        1
```

**When you encounter them:** During registration steps. For example:
- Registering a subject's FA map to a template (FLIRT produces the `.mat` file)
- Applying a previously computed transformation to another image (FLIRT with `-applyxfm`)

**Key point:** A `.mat` file describes the transformation *from* the input image space *to* the reference image space. To go the other direction, you need to invert the matrix (`convert_xfm -inverse`).

## BIDS: Brain Imaging Data Structure

**What it is:** Not a file format itself, but a **standardized convention** for organizing neuroimaging datasets. BIDS specifies directory structures, file naming patterns, and required metadata files.

**Core principles:**

```
project/
  sub-001/
    ses-01/
      anat/
        sub-001_ses-01_T1w.nii.gz
        sub-001_ses-01_T1w.json
      dwi/
        sub-001_ses-01_dwi.nii.gz
        sub-001_ses-01_dwi.bval
        sub-001_ses-01_dwi.bvec
        sub-001_ses-01_dwi.json
  sub-002/
    ...
  derivatives/
    preprocessed/
      sub-001/
        ...
```

**Key elements:**
- **Subject/session hierarchy**: Each participant gets a `sub-XXX` directory, optionally with `ses-XX` subdirectories for longitudinal studies.
- **Modality directories**: `anat/` for structural, `dwi/` for diffusion, `func/` for functional, etc.
- **Consistent naming**: Files follow a `key-value` pattern (e.g., `sub-001_ses-01_dwi.nii.gz`).
- **Derivatives**: Processed outputs go in a `derivatives/` directory, keeping raw data untouched.
- **Dataset description**: A top-level `dataset_description.json` file describes the project.

BIDS-organized data can be automatically processed by a growing ecosystem of standardized pipelines (e.g., QSIPrep, fMRIPrep). It also makes data sharing and reproducibility far easier.

**Reference:** [BIDS Specification](https://bids-specification.readthedocs.io)

## Configuration Files for FSL Tools

Two plain text configuration files appear repeatedly during susceptibility and eddy current correction:

### acqp.txt (Acquisition Parameters)

Specifies the phase encoding direction and total readout time for each unique acquisition. Used by both TOPUP and EDDY.

```
0 1 0 0.0662
0 -1 0 0.0662
```

Each row represents a unique acquisition configuration:
- Columns 1--3: Phase encoding direction as a unit vector (e.g., `0 1 0` = anterior-to-posterior along the y-axis)
- Column 4: Total readout time in seconds

**When you encounter it:** You create this file manually (or via script) based on the JSON sidecar metadata before running TOPUP and EDDY. Getting these values wrong will produce incorrect distortion corrections.

### index.txt (Volume-to-Acquisition Mapping)

Maps each volume in the DWI dataset to a row in the `acqp.txt` file, telling EDDY which acquisition parameters apply to each volume.

```
1 1 1 1 1 1 1 1 1 1
```

If all volumes were acquired with the same phase encoding direction (row 1 of `acqp.txt`), the index file is simply a row of ones -- one entry per volume.

**When you encounter it:** Created alongside `acqp.txt` before running EDDY. For single phase-encoding acquisitions, this file is straightforward. For blip-up/blip-down or multi-acquisition protocols, it requires more careful construction.

## Quick Reference Table

| Format | Extension | Contains | Primary Tools | Pipeline Stage |
|---|---|---|---|---|
| DICOM | `.dcm` | Raw scanner data + metadata | `dcm2niix` | Conversion |
| NIfTI | `.nii` / `.nii.gz` | Image data + spatial header | All tools | Entire pipeline |
| JSON sidecar | `.json` | Acquisition metadata | TOPUP, EDDY | Conversion, distortion correction |
| B-values | `.bval` | Diffusion weightings | `dtifit`, `dwi2tensor` | Shell extraction, tensor fitting |
| B-vectors | `.bvec` | Gradient directions | `dtifit`, `dwi2tensor` | Shell extraction, tensor fitting |
| FSL matrix | `.mat` | 4x4 affine transform | FLIRT, `applywarp` | Registration |
| Acq. params | `acqp.txt` | Phase encoding + readout time | TOPUP, EDDY | Distortion correction |
| Index | `index.txt` | Volume-to-acquisition mapping | EDDY | Eddy correction |

## Key Takeaways

- **DICOM** is the starting point; convert it to **NIfTI** immediately and work with NIfTI throughout.
- **JSON sidecars** contain acquisition metadata that is invisible in the NIfTI header but critical for distortion correction. Always verify them.
- **.bval** and **.bvec** files must stay synchronized with the 4D image data at all times.
- **BIDS** organization is not required for processing but makes everything easier -- from automated pipelines to data sharing.
- **acqp.txt** and **index.txt** are small files with outsized importance: errors in these files will silently corrupt your distortion correction.
