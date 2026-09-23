---
sidebar_position: 2
title: "Part A, Route 1: QSIPrep"
---

# Part A, Route 1: QSIPrep

## Overview

Part A has two routes to the same result. This is Route 1: the manual Steps 1–8 are replaced by a single run of [QSIPrep](https://qsiprep.readthedocs.io/), a containerized BIDS app that does for diffusion data what fMRIPrep does for functional data. It denoises, removes Gibbs ringing, runs TOPUP and eddy, corrects bias fields, skull-strips the T1, and aligns the diffusion data to the anatomical image, with a QC report for every participant. It uses the same underlying tools this tutorial walks through, so the result is the same kind of data, produced with fewer decisions on your part.

Part B does not change. QSIPrep produces corrected diffusion data; it does not produce FA maps or FODs, so tensor fitting and the CSD chain still run afterwards. This page is the bridge: what QSIPrep gives you, and how it maps onto the [handoff contract](./output-contract).

Whether to use QSIPrep or the manual steps is a real choice. QSIPrep is reproducible, container-pinned, and the right default for a new study or a multi-site one. The manual steps expose every parameter and are the right way to learn what the corrections do, or to handle an acquisition QSIPrep does not support. Both routes converge at Step 9.

## Prerequisites

| Requirement | Notes |
|---|---|
| Data in BIDS layout | QSIPrep reads BIDS and nothing else. Conversion is still [Step 1](./dicom-to-nifti) plus the [BIDS layout](../advanced/bids-standard); tools such as `heudiconv` or `dcm2bids` do both at once. |
| Fieldmaps in BIDS | Reverse phase-encode b=0 pairs go in `fmap/` with `IntendedFor` set in their JSON sidecars. Without them QSIPrep skips susceptibility correction. |
| Docker or Singularity/Apptainer | QSIPrep runs only as a container. |
| FreeSurfer licence file | Required by the container even when FreeSurfer itself is not run. Free from the FreeSurfer site. |

## Command

```bash
qsiprep "$bids_dir" "$out_dir" participant \
  --participant-label "$subj" \
  --output-resolution 2.0 \
  --fs-license-file "$license" \
  --nthreads 8 \
  --work-dir "$work_dir"
```

| Flag | Description |
|---|---|
| `--output-resolution` | Voxel size of the preprocessed DWI in mm. QSIPrep resamples into the T1-aligned grid at this resolution. Match your acquisition's native resolution unless you have a reason to change it. |
| `--fs-license-file` | Path to `license.txt`. |
| `--nthreads` | CPU threads for the run. |
| `--work-dir` | Scratch space. Large; clean it up after a successful run. |

Distortion correction, eddy, denoising, and Gibbs removal are on by default and need no flags. `--denoise-method`, `--unringing-method`, and `--hmc-model` exist if you need to change them; the defaults are `dwidenoise`, `mrdegibbs`, and FSL `eddy`, the same tools as Steps 7 and 8.

With Singularity:

```bash
singularity run --cleanenv \
  -B "$bids_dir":/data:ro \
  -B "$out_dir":/out \
  -B "$work_dir":/work \
  -B "$license":/license.txt:ro \
  qsiprep.sif \
  /data /out participant \
  --participant-label "$subj" \
  --output-resolution 2.0 \
  --fs-license-file /license.txt \
  --nthreads 8 \
  --work-dir /work
```

## Output

QSIPrep writes BIDS derivatives. The files that matter for the handoff:

```
out/qsiprep/sub-001/
├── anat/
│   ├── sub-001_space-ACPC_desc-preproc_T1w.nii.gz
│   └── sub-001_space-ACPC_desc-brain_mask.nii.gz
├── dwi/
│   ├── sub-001_space-ACPC_desc-preproc_dwi.nii.gz
│   ├── sub-001_space-ACPC_desc-preproc_dwi.bval
│   ├── sub-001_space-ACPC_desc-preproc_dwi.bvec
│   ├── sub-001_space-ACPC_desc-brain_mask.nii.gz
│   └── sub-001_space-ACPC_dwiref.nii.gz
└── figures/
```

QSIPrep versions before 1.0 wrote `space-T1w` in place of `space-ACPC`. The files are otherwise the same.

The preprocessed DWI is already in the T1-aligned grid. That is the one structural difference from the manual route, and it has a consequence: T1 and diffusion share a space, so the FLIRT matrix from [Step 10](./flirt-registration) is not needed. The header carries the alignment.

## Mapping to the Handoff Contract

| Contract file | QSIPrep source | Notes |
|---|---|---|
| `data.nii.gz` | `dwi/*_desc-preproc_dwi.nii.gz` | |
| `bvals` | `dwi/*_desc-preproc_dwi.bval` | |
| `bvecs` | `dwi/*_desc-preproc_dwi.bvec` | Already rotated for eddy and reoriented to the output grid. |
| `nodif_brain_mask.nii.gz` | `dwi/*_desc-brain_mask.nii.gz` | |
| `mean_b0.nii.gz` | `dwi/*_dwiref.nii.gz` | QSIPrep's b=0 reference image. |
| `<subj>_T1w_brain.nii.gz` | `anat/*_desc-preproc_T1w.nii.gz` masked by `anat/*_desc-brain_mask.nii.gz` | See below. |
| `str2diff.mat` | not needed | Same grid; use header alignment. |
| `fa.nii.gz` | not produced | Run [Step 9](./dtifit) on the preprocessed DWI. |
| `wm_fod_norm.mif` | not produced | Run [Steps 11–12](./response-functions). |

Linking the outputs into the contract layout:

```bash
#!/bin/bash
# qsiprep_to_contract.sh — lay out QSIPrep derivatives in the handoff structure

qsiprep_dir="/path/to/out/qsiprep"
project="/path/to/project"

for d in "$qsiprep_dir"/sub-*; do
    subj=$(basename "$d")
    dwi="$d/dwi"; anat="$d/anat"
    mkdir -p "$project/dwi/$subj" "$project/anat/$subj"

    # QSIPrep < 1.0 used space-T1w; pick whichever exists
    sp=ACPC; [ -e "$dwi/${subj}_space-T1w_desc-preproc_dwi.nii.gz" ] && sp=T1w

    ln -sf "$dwi/${subj}_space-${sp}_desc-preproc_dwi.nii.gz" "$project/dwi/$subj/data.nii.gz"
    ln -sf "$dwi/${subj}_space-${sp}_desc-preproc_dwi.bval"   "$project/dwi/$subj/bvals"
    ln -sf "$dwi/${subj}_space-${sp}_desc-preproc_dwi.bvec"   "$project/dwi/$subj/bvecs"
    ln -sf "$dwi/${subj}_space-${sp}_desc-brain_mask.nii.gz"  "$project/dwi/$subj/nodif_brain_mask.nii.gz"
    ln -sf "$dwi/${subj}_space-${sp}_dwiref.nii.gz"           "$project/dwi/$subj/mean_b0.nii.gz"

    # Skull-stripped T1: QSIPrep ships the preprocessed T1 and its mask separately
    fslmaths "$anat/${subj}_space-${sp}_desc-preproc_T1w.nii.gz" \
             -mas "$anat/${subj}_space-${sp}_desc-brain_mask.nii.gz" \
             "$project/anat/$subj/${subj}_T1w_brain.nii.gz"

    echo "$subj linked"
done
```

Then run [Step 9](./dtifit) for FA and [Steps 11–12](./response-functions) for FODs, and set `need_xfm=0` in the handoff check script.

## Quality Check

QSIPrep writes one HTML report per participant in `out/qsiprep/sub-001.html`. Open it. It shows the brain mask over the b=0, the DWI-to-T1 alignment, the distortion correction before and after, and framewise displacement per volume. The confounds file, `dwi/*_desc-confounds_timeseries.tsv`, has the per-volume motion numbers if you want thresholds instead of pictures; the same exclusion guidance as [Step 8](./eddy#quality-check) applies.

## Common Issues

| Symptom | Likely cause | Fix |
|---|---|---|
| "No fieldmaps found" and no distortion correction | `IntendedFor` missing from the fieldmap JSON | Add it, pointing at the DWI file's relative path |
| Run fails at the T1 stage | No `anat/` T1w in BIDS, or licence file path wrong inside the container | Check the bind mount and the `--fs-license-file` path as seen from inside |
| Output resolution unexpected | `--output-resolution` left at a default that does not match the data | Set it explicitly |
| Very slow or out of memory | Too many threads for the machine, or work dir on a slow disk | Lower `--nthreads`; put `--work-dir` on local storage |

## Next Step

Proceed to [Step 9: Tensor Fitting](./dtifit) on the preprocessed DWI, then [Step 11](./response-functions). Step 10 is not needed for QSIPrep output.
