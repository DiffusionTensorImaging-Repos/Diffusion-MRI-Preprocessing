---
sidebar_position: 2
title: "Part A, Route 1: QSIPrep"
---

# Part A, Route 1: QSIPrep

## Overview

Part A has two routes to the same result. This is Route 1: the manual Steps 1–8 are replaced by a single run of [QSIPrep](https://qsiprep.readthedocs.io/), a containerized BIDS app that does for diffusion data what fMRIPrep does for functional data. It denoises, removes Gibbs ringing, runs TOPUP and eddy, corrects bias fields, skull-strips the T1, and aligns the diffusion data to the anatomical image, with a QC report for every participant. It uses most of the same underlying tools this tutorial walks through, with two differences the table below calls out, so the result is the same kind of data produced with fewer decisions on your part.

Part B does not change. QSIPrep produces corrected diffusion data; it does not produce FA maps or FODs, so tensor fitting and the CSD chain still run afterwards. This page is the bridge: what QSIPrep gives you, and how it maps onto the [required outputs](./required-outputs).

Whether to use QSIPrep or the manual steps is a real choice. QSIPrep is reproducible, container-pinned, and the right default for a new study or a multi-site one. The manual steps expose every parameter and are the right way to learn what the corrections do, or to handle an acquisition QSIPrep does not support. Both routes converge at Step 9.

## What QSIPrep Does, Step for Step

This is the manual route's eight steps against what one QSIPrep run does. Where QSIPrep uses the same tool with the same behaviour, the row says so; where it does not, the row says what is different. Flag names are from the current QSIPrep documentation; run `qsiprep --help` for your installed version.

| Manual step | In QSIPrep | Default | Same tool? |
|---|---|---|---|
| 1. DICOM to NIfTI | Not done. QSIPrep reads BIDS only, so you run `dcm2niix` first (below). | — | Yes, you run it yourself |
| 2. Skull stripping (ANTs) | Done, on the T1 | On | **No — SynthStrip**, not ANTs |
| 3. B0 concatenation | Internal. Reverse-phase b=0s are found in `fmap/` via `IntendedFor` and paired automatically. | On when fieldmaps exist | n/a |
| 4. TOPUP | Done | On when fieldmaps exist | Yes, FSL `topup` |
| 5. Mean B0 | Done; written as `*_dwiref.nii.gz` | On | n/a |
| 6. Brain mask on DWI | Done; written as `*_desc-brain_mask.nii.gz` | On | QSIPrep's own masking, not BET |
| 7a. Denoising | Done | `--denoise-method dwidenoise` (on) | Yes, MRtrix3 `dwidenoise` |
| 7b. Gibbs removal | Done **only if requested** | `--unringing-method none` (**off**) | Yes, MRtrix3 `mrdegibbs`, when enabled |
| 8. Eddy + motion | Done | `--hmc-method eddy` (on); default config has `repol: true` | Yes, FSL `eddy` with outlier replacement, as in Step 8 |
| — | **N4 bias-field correction on the DWI.** The manual route does not do this. | `--dwi-biascorrect n4` (on) | Extra step |
| — | **DWI resampled into the T1 (ACPC) grid.** The manual route keeps native DWI space. | On, at `--output-resolution` | This is why Step 10 is skipped |

Two consequences to be explicit about. Gibbs removal is off unless you pass `--unringing-method mrdegibbs`; a bare `qsiprep` call does less than the manual route at Step 7. And N4 bias correction is on unless you pass `--dwi-biascorrect none`; a bare call does more than the manual route. Neither is wrong, but if you want the closest match to Steps 1–8, set both.

## Prerequisites

| Requirement | Notes |
|---|---|
| Data in BIDS layout | QSIPrep reads BIDS and nothing else. The conversion below covers it; [Step 1](./dicom-to-nifti) and the [BIDS page](../advanced/bids-standard) have the general case. |
| Fieldmaps in BIDS | Reverse phase-encode b=0 pairs go in `fmap/` with `IntendedFor` set in their JSON sidecars. Without them QSIPrep skips susceptibility correction silently. |
| Docker or Singularity/Apptainer | QSIPrep runs only as a container. |
| FreeSurfer licence file | Required by the container even though FreeSurfer is not run. Free from the FreeSurfer site. |

## Script

Two parts: convert to BIDS (this is Step 1, done with the same `dcm2niix` the manual route uses), then one QSIPrep call.

### Part 1: DICOM to BIDS

```bash
#!/bin/bash
# to_bids.sh — convert one participant's DICOMs into a minimal BIDS tree
# Adjust the three dicom_* paths to match how your scanner exports series.

subj="sub-001"
raw="/path/to/dicoms/$subj"
bids="/path/to/bids"

mkdir -p "$bids/$subj/anat" "$bids/$subj/dwi" "$bids/$subj/fmap"

# T1w
dcm2niix -b y -z y -f "${subj}_T1w" -o "$bids/$subj/anat" "$raw/t1_mprage"

# Main diffusion series (produces .nii.gz, .bval, .bvec, .json)
dcm2niix -b y -z y -f "${subj}_dir-AP_dwi" -o "$bids/$subj/dwi" "$raw/dwi_ap"

# Reverse phase-encode b=0 for TOPUP
dcm2niix -b y -z y -f "${subj}_dir-PA_epi" -o "$bids/$subj/fmap" "$raw/dwi_pa_b0"

# Tell QSIPrep which DWI the fieldmap corrects
python3 - <<EOF
import json
p = "$bids/$subj/fmap/${subj}_dir-PA_epi.json"
j = json.load(open(p))
j["IntendedFor"] = ["dwi/${subj}_dir-AP_dwi.nii.gz"]
json.dump(j, open(p, "w"), indent=2)
EOF

# dataset_description.json is required at the BIDS root
[ -f "$bids/dataset_description.json" ] || cat > "$bids/dataset_description.json" <<EOF
{"Name": "My diffusion study", "BIDSVersion": "1.8.0"}
EOF
```

Check the DWI sidecar has `PhaseEncodingDirection` and `TotalReadoutTime`; without them QSIPrep cannot run TOPUP. If your reverse-phase scan is a full DWI rather than b=0 only, put it in `dwi/` as `dir-PA_dwi` instead and QSIPrep will use both.

### Part 2: QSIPrep

```bash
#!/bin/bash
# run_qsiprep.sh — Steps 2 through 8 in one container run

subj="sub-001"
bids="/path/to/bids"
out="/path/to/qsiprep_out"
work="/path/to/scratch"
license="/path/to/license.txt"

qsiprep "$bids" "$out" participant \
  --participant-label "${subj#sub-}" \
  --output-resolution 2.0 \
  --unringing-method mrdegibbs \
  --dwi-biascorrect none \
  --fs-license-file "$license" \
  --nthreads 8 \
  --work-dir "$work"
```

| Flag | Why it is set |
|---|---|
| `--output-resolution` | Required. Voxel size in mm for the preprocessed DWI, which QSIPrep resamples into the T1 grid. Match your acquisition unless you have a reason not to. |
| `--unringing-method mrdegibbs` | Gibbs removal is off by default. This turns it on and matches Step 7. |
| `--dwi-biascorrect none` | N4 bias correction is on by default and the manual route does not do it. Drop this flag to keep QSIPrep's default; keep it for parity with Steps 1–8, or if your data is prescan-normalized. |
| `--fs-license-file` | Path to `license.txt`. |
| `--nthreads` | CPU threads. |
| `--work-dir` | Scratch. Large; clean up after a successful run. |

Denoising (`--denoise-method dwidenoise`), motion and eddy correction (`--hmc-method eddy`, with outlier replacement in the default config), and TOPUP (when fieldmaps are present) are on without flags.

With Singularity:

```bash
singularity run --cleanenv \
  -B "$bids":/data:ro \
  -B "$out":/out \
  -B "$work":/work \
  -B "$license":/license.txt:ro \
  qsiprep.sif \
  /data /out participant \
  --participant-label "${subj#sub-}" \
  --output-resolution 2.0 \
  --unringing-method mrdegibbs \
  --dwi-biascorrect none \
  --fs-license-file /license.txt \
  --nthreads 8 \
  --work-dir /work
```

## Output

QSIPrep writes BIDS derivatives. The files that matter downstream:

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

## Mapping to the Required Outputs

| Required file | QSIPrep source | Notes |
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

Linking the outputs into the required layout:

```bash
#!/bin/bash
# qsiprep_to_layout.sh — lay out QSIPrep derivatives in the required structure

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

Then run [Step 9](./dtifit) for FA and [Steps 11–12](./response-functions) for FODs, and set `need_xfm=0` in the output check script.

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
