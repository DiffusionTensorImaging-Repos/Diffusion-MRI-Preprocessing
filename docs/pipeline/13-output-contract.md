---
sidebar_position: 14
title: "Tractography Handoff"
---

# Tractography Handoff

## Overview

Preprocessing is finished when a tractography workflow can pick up your data and run without modification. This page states exactly what that means: which files must exist, what each one is for, and how to verify you have them. If everything here passes, you are ready to track. If something is missing, the table says which step produces it.

## The Contract

The handoff splits into two parts. The first is method-neutral: corrected data that any tractography approach would want, regardless of how it reconstructs tracts. The second is the FOD image, which is specific to spherical-deconvolution tracking.

### Method-Neutral Outputs

| File | Produced by | Used for |
|---|---|---|
| `data.nii.gz` | [Step 8](./eddy) | Preprocessed DWI. Input to FOD estimation and to any voxelwise model fitted later. |
| `bvals` | [Step 8](./eddy) | b-values matching `data.nii.gz`. |
| `bvecs` | [Step 8](./eddy) | Eddy-rotated gradient directions. |
| `nodif_brain_mask.nii.gz` | [Step 6](./brain-masking) | Brain mask in diffusion space. Bounds model fitting and ROI warping, and serves as the grid template for tract density maps. |
| `fa.nii.gz` | [Step 9](./dtifit) | FA map. Sampled along the reconstructed tract to produce node-wise profiles. |
| `<subj>_T1w_brain.nii.gz` | [Step 2](./skull-stripping) | Skull-stripped T1. Fixed image for MNI→subject registration, which is how atlas ROIs reach the participant. |
| `mean_b0.nii.gz` | [Step 5](./mean-b0) | Greyscale background for QC overlays. Optional, but QC images are much harder to read without it. |
| `str2diff.mat` | [Step 10](./flirt-registration) | FLIRT matrix, T1 → diffusion. Only needed when T1 and diffusion sit on different grids. |

`bvecs` must be the rotated version written by `eddy`. This is the most common way a run reaches tractography and produces subtly wrong results rather than failing outright; every orientation downstream inherits the error.

`str2diff.mat` is conditional. If your acquisition already has T1 and diffusion aligned, as HCP-style data does, the transform can be read straight from the image headers and no FLIRT matrix is required. Downstream workflows typically expose this as a switch between matrix and header. Check your data before assuming you need [Step 10](./flirt-registration).

### FOD Image

| File | Produced by | Used for |
|---|---|---|
| `wm_fod_norm.mif` | [Step 12](./fod-estimation) | Normalized white-matter FOD. What streamline tracking follows. |

This is the eighth output and the one that makes the data tractography-ready rather than merely corrected.

### Not Produced Here

Two things a downstream analysis commonly needs that this tutorial deliberately does not generate:

| Item | Where it comes from |
|---|---|
| Microstructure models beyond the tensor (NODDI, DKI, and similar) | Fitted separately, from `data.nii.gz` + `bvals` + `bvecs` + mask, all of which you already deliver. Which model, if any, depends on the study. |
| Participant-level covariates (motion, ICV, demographics) | Your study records. Read only at the statistics stage. |

Any scalar map on the diffusion grid can be sampled along a tract, so if your pipeline also emits MD, RD, or model-derived maps, they slot in beside FA without changing anything structural.

## Directory Layout

Tractography workflows generally expect a flat, per-participant layout like the following. Exact directory names vary; the grouping does not.

```
project/
├── anat/
│   └── sub-001/
│       └── sub-001_T1w_brain.nii.gz     # Step 2
├── dwi/
│   └── sub-001/
│       ├── data.nii.gz                  # Step 8
│       ├── bvals                        # Step 8
│       ├── bvecs                        # Step 8 (rotated)
│       ├── nodif_brain_mask.nii.gz      # Step 6
│       ├── mean_b0.nii.gz               # Step 5 (QC background)
│       ├── fa.nii.gz                    # Step 9
│       └── wm_fod_norm.mif              # Step 12
└── xfm/
    └── sub-001/
        └── str2diff.mat                 # Step 10 (only if grids differ)
```

If your preprocessing wrote files elsewhere or under different names, symlink or copy them into this shape rather than editing the downstream scripts. Keeping the contract stable is what lets a tractography workflow be reused across studies.

## Coordinate Spaces

Three coordinate spaces are in play, and mixing them up is the other common failure mode.

| Space | Contents | Movement between spaces |
|---|---|---|
| MNI / template | Atlas ROIs and tract priors | Warped into T1 by ANTs registration (a tractography step, not a preprocessing one) |
| T1 / structural | `<subj>_T1w_brain.nii.gz` | Bridge space between MNI and diffusion |
| Diffusion | `data.nii.gz`, masks, `fa.nii.gz`, FODs | Tracking happens here. Everything must arrive here eventually. |

Preprocessing delivers a clean T1, clean diffusion data, and, when the grids differ, the `str2diff.mat` that connects them. Getting atlas ROIs from MNI down into diffusion space is the first thing the tractography workflow does, using those ingredients.

## Software Versions

The stack below has been exercised end to end on real multi-shell data. Floors are what to require; tested values are what is known to work.

| Software | Floor | Tested |
|---|---|---|
| MRtrix3 | 3.0 | 3.0.7 |
| FSL | 6.0 | 6.0.5.1 |
| ANTs | 2.3 | 2.3.5 |
| Python | 3.8 | 3.8.10 (also 3.13) |
| dipy | — | 1.8.0 (also 1.11–1.12) |
| pyAFQ | — | 1.3.5 (also 3.3) |
| R | 4.x | with `readr`, `dplyr`, `stringr`, `tibble`, `foreach`, `doParallel` |

Multi-shell data is required. [Step 11](./response-functions) and [Step 12](./fod-estimation) need at least two non-zero b-values plus b=0 to separate tissue compartments. The worked example uses b = 1000 / 2000 / 3250 / 5000 s/mm². Single-shell data needs the two-tissue variant described in [Step 12](./fod-estimation#single-shell-data).

## Verification Script

Run this before handing off. It checks the contract for every participant.

```bash
#!/bin/bash
# check_handoff.sh — verify preprocessing outputs against the tractography contract

base_dir="/path/to/project"
need_xfm=1          # set to 0 if T1 and diffusion share a grid (header-based transform)

subjects=$(ls -d "$base_dir"/dwi/sub-* 2>/dev/null | xargs -n1 basename)

printf "%-12s %-5s %-5s %-5s %-5s %-5s %-5s %-5s %-5s\n" \
       "Subject" "dwi" "bval" "bvec" "mask" "fa" "T1" "xfm" "fod"

fail=0
for subj in $subjects; do
    d="$base_dir/dwi/$subj"
    a="$base_dir/anat/$subj"
    x="$base_dir/xfm/$subj"

    chk() { [ -s "$1" ] && echo "ok" || { echo "--"; return 1; }; }

    r_dwi=$(chk  "$d/data.nii.gz")              || fail=1
    r_bval=$(chk "$d/bvals")                    || fail=1
    r_bvec=$(chk "$d/bvecs")                    || fail=1
    r_mask=$(chk "$d/nodif_brain_mask.nii.gz")  || fail=1
    r_fa=$(chk   "$d/fa.nii.gz")                || fail=1
    r_t1=$(chk   "$a/${subj}_T1w_brain.nii.gz") || fail=1
    r_fod=$(chk  "$d/wm_fod_norm.mif")          || fail=1

    if [ "$need_xfm" -eq 1 ]; then
        r_xfm=$(chk "$x/str2diff.mat") || fail=1
    else
        r_xfm="n/a"
    fi

    printf "%-12s %-5s %-5s %-5s %-5s %-5s %-5s %-5s %-5s\n" \
           "$subj" "$r_dwi" "$r_bval" "$r_bvec" "$r_mask" \
           "$r_fa" "$r_t1" "$r_xfm" "$r_fod"

    # mean_b0 is optional — report separately rather than failing the run
    [ -s "$d/mean_b0.nii.gz" ] || echo "    note: $subj has no mean_b0.nii.gz (QC overlays will be harder to read)"
done

echo
if [ "$fail" -eq 0 ]; then
    echo "All participants satisfy the handoff contract."
else
    echo "Some required files are missing — see the '--' entries above."
fi
```

### Checks Beyond File Existence

Files existing is necessary but not sufficient. Three quick checks catch most remaining problems:

```bash
# 1. Gradient table length matches volume count
nvol=$(mrinfo "$d/data.nii.gz" -size | awk '{print $4}')
nbval=$(wc -w < "$d/bvals")
echo "volumes: $nvol   bvals: $nbval"   # must match

# 2. Mask and DWI share a grid
mrinfo "$d/data.nii.gz" -size -vox
mrinfo "$d/nodif_brain_mask.nii.gz" -size -vox

# 3. FA is in a plausible range (roughly 0–1, no wild outliers)
fslstats "$d/fa.nii.gz" -R
```

## Not Required

Several steps in this tutorial are useful but are not part of the handoff contract. Skipping them does not block tracking.

| Step | Reason |
|---|---|
| [BedpostX](./bedpostx) | Belongs to the FSL `probtrackx2` tractography route. A CSD-based workflow uses FODs instead and never reads BedpostX output. |
| [Shell extraction](./shell-extraction) | MSMT-CSD needs all shells; extracting a single shell would actively harm it. Extraction remains useful for tensor fitting, but the extracted files are not handed off. |
| [ICV calculation](./icv-calculation) | A statistical covariate, not a pipeline input. Compute it whenever convenient. |
| [BIDS & pyAFQ](./pyafq-bids) | For pyAFQ's whole-brain bundle recognition. ROI-to-ROI workflows do their own tracking and use pyAFQ only as a streamline-cleaning library, which needs no BIDS tree. |

Anatomically constrained tractography (ACT) is also outside this handoff. ROI-to-ROI workflows that constrain tracking with explicit include and exclude regions do not need a whole-brain tissue segmentation, so no `5ttgen` output is required. If you are doing whole-brain connectome work instead, ACT is documented in the MRtrix3 manual, but it is not part of this pipeline.

## After the Handoff

Once the contract is satisfied, preprocessing is done and tract reconstruction begins. The usual sequence is to bring ROIs from template space into each participant's diffusion space using the T1 and transform delivered above, define the regions that seed, include, and exclude streamlines, run tracking against `wm_fod_norm.mif`, clean the resulting bundles, and sample FA or other scalar maps along them. The specifics of each of those choices belong to the tractography method and the study question, which is where this tutorial stops.
