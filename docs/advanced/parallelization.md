---
sidebar_position: 2
title: "Parallelization"
---

# Parallel Processing in DTI Pipelines

DTI preprocessing involves running the same operations on many subjects independently. Since each subject's data is processed in isolation, this is an "embarrassingly parallel" problem — you can process multiple subjects at the same time with almost no additional complexity. The only constraint is hardware resources.

## Resource Requirements by Stage

Before parallelizing, know how much each step needs:

| Stage | RAM per Subject | CPU Cores | Time per Subject | Parallelism Level |
|-------|----------------|-----------|-----------------|------------------|
| dcm2niix | ~200 MB | 1 | < 1 min | High (30–60 jobs) |
| ANTs skull stripping | 2–4 GB | 2–4 | 30–90 min | Low (4–8 jobs) |
| TOPUP | ~1 GB | 1 | 5–15 min | Medium (10–20 jobs) |
| Denoising (MRtrix3) | ~2 GB | 1 | 2–5 min | Medium (10–20 jobs) |
| Eddy (CPU) | 4–8 GB | 1–4 | 1–4 hours | Low (4–8 jobs) |
| Eddy (GPU) | 4 GB | 1 + GPU | 5–15 min | Limited by GPUs |
| BedpostX (CPU) | 4–8 GB | 1–2 | 6–24 hours | Very low (2–4 jobs) |
| BedpostX (GPU) | 4 GB | 1 + GPU | 30 min–2 hr | Limited by GPUs |
| DTIFIT | ~500 MB | 1 | < 1 min | High (30–60 jobs) |
| FLIRT | ~500 MB | 1 | < 1 min | High (30–60 jobs) |

## Calculating Safe Parallelism

```bash
# Check available memory (Linux)
available_gb=$(free -g | awk '/^Mem:/{print $7}')

# macOS
available_gb=$(sysctl -n hw.memsize | awk '{print int($1/1073741824)}')

# Calculate max jobs for a given stage
ram_per_job=4  # GB — adjust per stage (see table above)
max_jobs=$((available_gb / ram_per_job))
echo "Safe to run $max_jobs concurrent jobs for this stage"
```

If you calculate 16 safe jobs, start with 10 and monitor with `htop`. Increase gradually. One out-of-memory crash can corrupt output files and force a full re-run.

## Method 1: GNU Parallel

[GNU Parallel](https://www.gnu.org/software/parallel/) is the simplest way to run multiple subjects concurrently:

```bash
# Install (Ubuntu/Debian)
sudo apt install parallel

# Run eddy for all subjects, 6 at a time
ls -d "$base_dir"/denoised/sub-* | xargs -n1 basename | \
    parallel -j 6 ./process_eddy.sh {}

# With progress bar and logging
ls -d "$base_dir"/denoised/sub-* | xargs -n1 basename | \
    parallel -j 6 --progress --joblog eddy_parallel.log \
    ./process_eddy.sh {}
```

## Method 2: Bash Background Jobs

For environments without GNU Parallel:

```bash
#!/bin/bash
# parallel_process.sh — Run a stage in parallel using bash

max_jobs=6
job_count=0

subjects=$(ls -d "$base_dir"/nifti/sub-* | xargs -n1 basename)

for subj in $subjects; do
    echo "Starting: $subj"
    ./process_stage.sh "$subj" > "logs/${subj}.log" 2>&1 &
    ((job_count++))

    # Wait for a slot to open if we've hit the limit
    if (( job_count >= max_jobs )); then
        wait -n  # Wait for any one job to finish
        ((job_count--))
    fi
done

wait  # Wait for all remaining jobs to finish
echo "All subjects complete."
```

## Protecting Against SSH Disconnection

Long-running jobs are lost if your SSH session drops. Always use a terminal multiplexer:

### tmux

```bash
# Start a new session
tmux new -s dti

# Run your processing
./run_all_subjects.sh

# Detach: Ctrl-B, then D (session keeps running)
# Reconnect later:
tmux attach -t dti

# List sessions:
tmux ls
```

### screen

```bash
# Start a new session
screen -S dti

# Run your processing
./run_all_subjects.sh

# Detach: Ctrl-A, then D
# Reconnect: screen -r dti
```

### nohup (simplest, no reattach)

```bash
nohup ./run_all_subjects.sh > processing.log 2>&1 &

# Monitor:
tail -f processing.log
```

## Multi-Stage Pipeline Script

Run the full pipeline with appropriate parallelism at each stage:

```bash
#!/bin/bash
# run_pipeline.sh — Full pipeline with per-stage parallelism

base_dir="/path/to/project"

echo "=== Stage 1: DICOM to NIfTI (30 jobs) ==="
ls subjects.txt | parallel -j 30 ./01_dcm2nii.sh {}

echo "=== Stage 2: Skull Stripping (4 jobs) ==="
ls subjects.txt | parallel -j 4 ./02_skull_strip.sh {}

echo "=== Stage 3-6: TOPUP chain (10 jobs) ==="
ls subjects.txt | parallel -j 10 ./03_topup_chain.sh {}

echo "=== Stage 7: Denoising (10 jobs) ==="
ls subjects.txt | parallel -j 10 ./07_denoise.sh {}

echo "=== Stage 8: Eddy (6 jobs) ==="
ls subjects.txt | parallel -j 6 ./08_eddy.sh {}

echo "=== Stage 10-11: Shells + DTIFIT (30 jobs) ==="
ls subjects.txt | parallel -j 30 ./10_shells_dtifit.sh {}

echo "=== Stage 12: Registration (30 jobs) ==="
ls subjects.txt | parallel -j 30 ./12_flirt.sh {}

echo "Pipeline complete."
```

## Common Pitfalls

| Problem | Cause | Solution |
|---------|-------|----------|
| Jobs killed randomly | Out of memory | Reduce `max_jobs`; monitor with `htop` |
| Disk full mid-processing | Intermediate files fill disk | Check disk usage (`df -h`) before starting; clean up intermediate files |
| Corrupted output files | Job killed during file write | Delete corrupted files and re-run; use verification scripts |
| All jobs finish instantly | Script error (wrong paths) | Check one subject manually first before parallelizing |
| SSH drops, jobs die | Not using tmux/screen | Always use a terminal multiplexer or `nohup` |
