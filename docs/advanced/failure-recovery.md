---
sidebar_position: 1
title: "Failure Recovery"
---

# Pipeline Failure Recovery

In any study with more than a handful of subjects, some will fail at various preprocessing stages. Knowing how to diagnose failures, fix them, and re-run only the affected subjects saves enormous amounts of time compared to reprocessing everything from scratch.

## General Recovery Strategy

When a subject fails:

1. **Identify** which subjects failed — check that expected output files exist after each stage
2. **Diagnose** why it failed — check error messages, log files, and inspect inputs
3. **Fix** the underlying issue — correct a path, adjust a parameter, or fix an input file
4. **Re-run** only the failed subject from the failed stage onward
5. **Re-verify** to confirm successful completion

:::tip Keep Log Files
Always redirect output to log files when running pipeline stages. Without logs, diagnosing failures is guesswork:

```bash
./process_eddy.sh sub-003 > logs/eddy_sub-003.log 2>&1
```
:::

## Stage-by-Stage Troubleshooting

### Step 1: DICOM to NIfTI

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| Missing .bval/.bvec files | DICOMs in a format dcm2niix does not recognize (e.g., PAR/REC, Philips classic) | Use `dcm2niix -b y` to force bval/bvec export; check for vendor-specific conversion options |
| Wrong number of volumes | Multiple series combined or split incorrectly | Check DICOM folder organization; use `-s y` to group by series |
| Missing fieldmap | Fieldmap DICOMs in a separate folder or not exported | Check scanner export settings; ensure all series are included |
| No output at all | Wrong input path, or DICOMs are not recognized | Run `dcm2niix -v y` for verbose output to see what dcm2niix found |

**Re-run**: This step has no downstream dependencies that need re-running unless the output changed.

### Step 2: Skull Stripping (ANTs)

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| Over-stripping (brain tissue removed) | Template mismatch or unusual anatomy | Try a different template, or try BET as a fallback |
| Under-stripping (skull remaining) | Low T1 contrast or unusual anatomy | Try a different template; adjust prior parameters |
| Complete failure (empty output) | Missing template files, wrong ANTSPATH | Verify template path and ANTs installation |
| Takes forever (hours) | Normal for ANTs — it is slow | Be patient; use 4+ CPU cores with `ITK_GLOBAL_DEFAULT_NUMBER_OF_THREADS` |

**Re-run**: Re-run Step 2 only. Does not affect Steps 3–8 (which use diffusion-space masks). Affects Step 10 (registration uses the structural brain).

### Step 3: B0 Concatenation

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| "Dimensions do not match" | AP and PA fieldmaps have different resolutions or matrix sizes | Check with `fslinfo` — both fieldmaps must have the same spatial dimensions |
| Wrong number of volumes | Wrong files selected | Verify you are using the correct AP/PA fieldmap files |

**Re-run**: Re-run Steps 3, 4, 5, 6, and 8 (topup depends on the concatenated B0s).

### Step 4: TOPUP

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| "Odd number of volumes" | B0 pair has an unexpected number of volumes | Check `fslnvols` on the concatenated B0 file |
| Distortions look worse after TOPUP | `acqp.txt` has wrong phase encoding directions | Swap the AP and PA rows in `acqp.txt` |
| Configuration file not found | Wrong path to TOPUP config | Use `$FSLDIR/etc/flirtsch/b02b0.cnf` (verify this file exists) |

**Re-run**: Re-run Steps 4, 5, 6, and 8.

### Step 5–6: Mean B0 and Brain Masking

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| Mean B0 still looks 4D | Used wrong `fslmaths` flag | Use `-Tmean`, not `-mean` |
| BET mask too tight | `-f` parameter too high | Lower `-f` (e.g., from 0.3 to 0.2) |
| BET mask too loose | `-f` parameter too low | Increase `-f` (e.g., from 0.3 to 0.4) |
| BET mask has holes | Signal dropout in the input image | Fill holes with `fslmaths mask -fillh mask_filled` |

**Re-run**: Re-run the affected step and Step 8 (eddy uses the mask).

### Step 7: Denoising and Gibbs Correction

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| `dwidenoise` fails with dimension error | Too few DWI volumes (< ~10) | Need at least ~10 volumes for MP-PCA; skip denoising if you have fewer |
| Output looks blurry | Very few directions | Expected with < 30 directions; MP-PCA works better with more data |
| `mrdegibbs` produces striping | Rare edge case with certain acquisition parameters | Skip Gibbs correction — it is less critical than denoising |

**Re-run**: Re-run Step 7 and Step 8 (eddy uses the denoised data).

### Step 8: Eddy

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| Eddy crashes immediately | `index.txt` does not match number of volumes | Verify: `wc -w index.txt` should equal `fslnvols data.nii.gz` |
| "Mismatch between data and bvals/bvecs" | bvec file has wrong number of entries | Check: 3 rows, each with N entries matching N volumes |
| `eddy_cuda` fails | CUDA version mismatch, wrong GPU driver | Check `nvidia-smi`; see [Environment Setup](../tools/environment-setup#gpu-setup-for-eddy_cuda) |
| Very slow (days) | Using CPU version with large data | Use `eddy_cuda` or `eddy_openmp` with multiple cores |
| High motion despite good subject | Eddy parameters misconfigured | Verify `acqp.txt` readout time and phase encoding direction |

**Re-run**: Re-run Step 8 and all subsequent steps (9–14).

### BedpostX

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| Immediate failure | Files not named correctly | Must be exactly: `data.nii.gz`, `bvecs`, `bvals`, `nodif_brain_mask.nii.gz` |
| Dimension mismatch | Mask and data have different dimensions | Verify with `fslinfo data.nii.gz` and `fslinfo nodif_brain_mask.nii.gz` |
| Hangs for days | Normal for CPU version | Use `bedpostx_gpu`; check progress in log files |
| GPU version crashes | CUDA error or insufficient VRAM | Check `nvidia-smi` for available memory; bedpostx_gpu needs ~2–4 GB VRAM |
| Output directory empty | Job was interrupted | Delete the `.bedpostX` directory completely and re-run |

**Re-run**: Re-run BedpostX only. Does not affect DTIFIT or registration.

### Step 9: DTIFIT

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| FA > 1.0 | Non-positive-definite tensors | Usually caused by bad eddy correction or wrong bvecs — go back to Step 8 |
| Uniformly low FA | Wrong bvecs, wrong bvals, or failed eddy | Verify bvec/bval files match the data; check eddy output |
| Streaks in FA map | Residual artifacts from eddy or Gibbs | Re-run eddy with different parameters; check denoising |

**Re-run**: Re-run Step 9, then Steps 10–12.

### Step 10: Registration (FLIRT)

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| Brain misaligned | Wrong input images or wrong DOF | Verify inputs; use 6 DOF for diff→struct, 12 DOF for struct→MNI |
| Brain rotated | Wrong transform concatenation order | In `convert_xfm -concat A B`, B is applied first, then A |
| Very poor alignment | Large anatomical differences from template | Consider using FNIRT (nonlinear) or a population-specific template |

**Re-run**: Re-run Step 10, then Steps 11–12.

## Cascading Failures

A failure at one stage can affect all downstream stages. This table shows which stages must be re-run when an earlier stage fails:

| If This Stage Fails | Re-run These Stages |
|---------------------|-------------------|
| 1 (DICOM to NIfTI) | Everything (2–14) |
| 2 (Skull Stripping) | 12–14 (registration chain) |
| 3 (B0 Concatenation) | 4, 5, 6, 8–14 |
| 4 (TOPUP) | 5, 6, 8–14 |
| 5 (Mean B0) | 6, 8–14 |
| 6 (Brain Masking) | 8–14 |
| 7 (Denoising) | 8–14 |
| 8 (Eddy) | 9–14 |
| 9 (BedpostX) | None (tractography only) |
| 10 (Shell Extraction) | 11–14 |
| 11 (DTIFIT) | 12–14 |
| 12 (Registration) | 13–14 |

## Preventing Failures

### Use Screen or tmux

Long-running jobs will die if your SSH connection drops:

```bash
# Start a tmux session
tmux new -s dti_processing

# Run your pipeline inside the session
./run_pipeline.sh

# Detach with Ctrl-B, then D
# Reconnect later with:
tmux attach -t dti_processing
```

### Resource Planning

| Stage | CPU Time | RAM | GPU VRAM | Disk |
|-------|----------|-----|----------|------|
| Skull stripping (ANTs) | 30–90 min/subj | 4–8 GB | — | 500 MB |
| TOPUP | 5–15 min/subj | 2–4 GB | — | 200 MB |
| Eddy (CPU) | 1–4 hours/subj | 4–8 GB | — | 500 MB |
| Eddy (GPU) | 5–15 min/subj | 4 GB | 2–4 GB | 500 MB |
| BedpostX (CPU) | 6–24 hours/subj | 4–8 GB | — | 2–5 GB |
| BedpostX (GPU) | 30 min–2 hr/subj | 4–8 GB | 2–4 GB | 2–5 GB |
| DTIFIT | 1–5 min/subj | 2 GB | — | 200 MB |

### Batch Processing Tips

```bash
# Run with error handling — continue to next subject if one fails
for subj in sub-001 sub-002 sub-003; do
    echo "Processing: $subj"
    ./process_stage.sh "$subj" || echo "FAILED: $subj"
done

# Log everything
./process_all.sh 2>&1 | tee "pipeline_$(date +%Y%m%d_%H%M).log"
```
