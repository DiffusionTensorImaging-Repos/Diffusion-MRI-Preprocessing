---
sidebar_position: 8
title: "Environment Setup"
---

# Setting Up Your Neuroimaging Environment

## Overview

DTI preprocessing needs a workstation with several specialized packages installed and configured.

If you are working on an HPC cluster or shared workstation that already has neuroimaging tools installed via module systems, skip to the [HPC / Module Systems](#hpc--module-systems) section.

## System Requirements

DTI preprocessing is computationally demanding. Here are the recommended specifications:

| Resource | Minimum | Recommended | Notes |
|----------|---------|-------------|-------|
| **OS** | Ubuntu 20.04 / CentOS 7 | Ubuntu 22.04+ | macOS works but some tools are Linux-only |
| **RAM** | 16 GB | 64–128 GB | BedpostX and eddy are memory-hungry |
| **CPU** | 4 cores | 8–16 cores | Eddy and ANTs benefit from multiple cores |
| **Storage** | 5 GB per subject | 10 GB per subject | Raw DICOMs + NIfTI + all derivatives |
| **GPU** | None | NVIDIA (CUDA-capable) | `eddy_cuda` and `bedpostx_gpu` are 5–10× faster |

Most tools run on macOS, but **eddy_cuda** and **bedpostx_gpu** require an NVIDIA GPU with CUDA, which is not available on modern Macs. If you have a Mac, plan to run GPU-accelerated steps on a Linux workstation or cluster, or use the CPU versions (which are slower but produce identical results).

## Installation Overview

You need five core tools. Here is the recommended installation method for each:

| Tool | Recommended Install | Alternative |
|------|-------------------|-------------|
| **FSL** | `FSLInstaller.py` | conda, apt (neurodebian) |
| **ANTs** | Pre-built binaries (GitHub) | conda, build from source |
| **MRtrix3** | conda | build from source |
| **dcm2niix** | conda | pre-built binary, apt |
| **pyAFQ** | pip | conda |

See the dedicated page for each tool for detailed installation instructions:
- [FSL](./fsl)
- [ANTs](./ants)
- [MRtrix3](./mrtrix3)
- [dcm2niix](./dcm2niix)
- [pyAFQ](./pyafq)

## Quick Install (Ubuntu/Debian)

If you want to get everything installed quickly on a fresh Ubuntu system, here is a condensed sequence. Each tool's dedicated page has more detail and troubleshooting.

```bash
# ──────────────────────────────────────────────
# 1. System dependencies
# ──────────────────────────────────────────────
sudo apt-get update
sudo apt-get install -y build-essential git cmake curl wget \
    python3 python3-pip python3-venv \
    libgl1-mesa-glx libglu1-mesa libegl1 \
    dc bc libopenblas-dev

# ──────────────────────────────────────────────
# 2. FSL (via official installer)
# ──────────────────────────────────────────────
# Download and run the FSL installer
# Follow prompts — installs to /usr/local/fsl by default
python3 FSLInstaller.py

# Add to your shell profile (~/.bashrc or ~/.zshrc)
echo 'export FSLDIR="/usr/local/fsl"' >> ~/.bashrc
echo 'source $FSLDIR/etc/fslconf/fsl.sh' >> ~/.bashrc
echo 'export PATH="$FSLDIR/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# ──────────────────────────────────────────────
# 3. ANTs (pre-built binaries)
# ──────────────────────────────────────────────
# Download the latest release for your platform from:
# https://github.com/ANTsX/ANTs/releases
# Extract and add to PATH:
echo 'export ANTSPATH="/opt/ANTs/bin"' >> ~/.bashrc
echo 'export PATH="$ANTSPATH:$PATH"' >> ~/.bashrc
source ~/.bashrc

# ──────────────────────────────────────────────
# 4. MRtrix3, dcm2niix (via conda)
# ──────────────────────────────────────────────
# Install Miniforge if you don't have conda
wget https://github.com/conda-forge/miniforge/releases/latest/download/Miniforge3-Linux-x86_64.sh
bash Miniforge3-Linux-x86_64.sh

conda install -c mrtrix3 mrtrix3
conda install -c conda-forge dcm2niix

# ──────────────────────────────────────────────
# 5. pyAFQ (via pip, in a virtual environment)
# ──────────────────────────────────────────────
python3 -m venv ~/envs/pyafq
source ~/envs/pyafq/bin/activate
pip install pyAFQ
```

## Environment Variables

After installing all tools, your shell profile (`~/.bashrc`, `~/.zshrc`, or `~/.bash_profile`) should contain something like this:

```bash
# FSL
export FSLDIR="/usr/local/fsl"
source $FSLDIR/etc/fslconf/fsl.sh
export FSLOUTPUTTYPE="NIFTI_GZ"

# ANTs
export ANTSPATH="/opt/ANTs/bin"

# PATH — all tools
export PATH="$FSLDIR/bin:$ANTSPATH:/path/to/mrtrix3/bin:$PATH"
```

After editing your shell profile, either open a new terminal or run:

```bash
source ~/.bashrc
```

## GPU Setup for eddy_cuda

If you have an NVIDIA GPU, setting up CUDA allows you to run `eddy_cuda` (5–10× faster than the CPU version) and `bedpostx_gpu`.

### Step 1: Check your GPU

```bash
lspci | grep -i nvidia
# Should show your GPU model, e.g., "NVIDIA Corporation GA102 [GeForce RTX 3090]"
```

### Step 2: Install NVIDIA drivers

```bash
# Ubuntu
sudo apt-get install nvidia-driver-535   # or latest version
sudo reboot

# Verify
nvidia-smi
# Should show driver version and GPU memory
```

### Step 3: Install CUDA Toolkit

FSL's `eddy_cuda` is compiled against a specific CUDA version. Check the [FSL wiki](https://fsl.fmrib.ox.ac.uk/fsl/fslwiki/eddy/UsersGuide) for which CUDA version your FSL release expects (typically CUDA 9.1 or 11.x).

```bash
# Check which CUDA version eddy_cuda expects
ls $FSLDIR/bin/eddy_cuda*
# e.g., eddy_cuda9.1, eddy_cuda10.2

# Install the matching CUDA toolkit from NVIDIA
# https://developer.nvidia.com/cuda-toolkit-archive
```

### Step 4: Verify GPU acceleration

```bash
# Test that eddy can see the GPU
eddy_cuda --help 2>&1 | head -5

# Test nvidia-smi inside your processing environment
nvidia-smi
```

## HPC / Module Systems

If you are working on a university cluster or HPC system, tools are typically available through environment modules. You do not need to install anything — just load the modules.

```bash
# Check what's available
module avail fsl
module avail ants
module avail mrtrix

# Load modules (exact names vary by system)
module load fsl/6.0.7
module load ants/2.5.0
module load mrtrix3/3.0.4
module load dcm2niix/1.0.20230411

# Verify
echo $FSLDIR
which antsBrainExtraction.sh
which dwidenoise
which dcm2niix
```

Module names and versions vary across institutions. If `module avail fsl` returns nothing, check with your HPC support team — neuroimaging software is commonly installed but may be under a different name or path. Some systems use `Lmod` instead of `environment modules`, but the commands are the same.

## Docker and Singularity

If you cannot install software directly (e.g., no root access), containers provide a portable alternative.

### Singularity (common on HPC)

```bash
# Pull a NeuroDebian container with FSL
singularity pull docker://neurodebian:latest

# Run FSL commands inside the container
singularity exec neurodebian_latest.sif flirt -version

# Or pull a dedicated FSL container
singularity pull docker://brainlife/fsl:6.0.7
```

### Docker (local workstations)

```bash
# Pull FSL
docker pull brainlife/fsl:6.0.7

# Run a command
docker run -v /path/to/data:/data brainlife/fsl:6.0.7 \
    flirt -in /data/input.nii.gz -ref /data/ref.nii.gz -out /data/output.nii.gz
```

When using Docker or Singularity, you must mount your data directory into the container with `-v` (Docker) or `-B` (Singularity). Commands inside the container cannot see your host filesystem unless you explicitly mount it.

## Remote Access

Most neuroimaging work is done on shared Linux workstations or clusters via SSH:

```bash
ssh -XY username@hostname
```

The `-XY` flags enable X11 forwarding, which lets you run GUI applications like FSLeyes on the remote machine and see them on your local screen. On macOS, you need [XQuartz](https://www.xquartz.org/) installed for X11 forwarding.

## Running Long Jobs

DTI preprocessing steps can take hours per subject. Use these strategies to prevent job loss if your SSH connection drops:

```bash
# tmux: persistent terminal sessions (recommended)
tmux new -s dti              # create a named session
# (run your processing script here)
# Press Ctrl+B, then D to detach
tmux attach -t dti           # reattach later

# screen: alternative to tmux
screen -S dti_processing
# (run your command, then Ctrl+A, D to detach)
screen -r dti_processing     # reattach later

# nohup: simplest — survives SSH disconnection
nohup bash preprocess.sh > output.log 2>&1 &
tail -f output.log           # follow progress
```

## Monitoring Resources

```bash
htop                  # Interactive process viewer (CPU, RAM per process)
free -h               # Available RAM at a glance
nproc                 # Number of CPU cores
df -h                 # Disk space by partition
nvidia-smi            # GPU usage (if NVIDIA GPU present)
watch -n 5 nvidia-smi # Refresh GPU status every 5 seconds
du -sh /path/to/data  # Size of a directory
```

## Verification Script

After setting up your environment, run this script to confirm everything is working:

```bash
#!/bin/bash
# verify_setup.sh — Check that all required tools are installed and configured

echo "=========================================="
echo "  Neuroimaging Environment Verification"
echo "=========================================="
echo ""

errors=0

# FSL
echo "--- FSL ---"
if [ -z "$FSLDIR" ]; then
    echo "  FAIL: FSLDIR is not set"
    errors=$((errors + 1))
elif [ ! -d "$FSLDIR" ]; then
    echo "  FAIL: FSLDIR=$FSLDIR does not exist"
    errors=$((errors + 1))
else
    echo "  FSLDIR=$FSLDIR"
    fsl_version=$(flirt -version 2>&1 | head -1)
    echo "  Version: $fsl_version"
    # Check key commands
    for cmd in flirt eddy topup bet fslmaths dtifit bedpostx fslroi fslmerge; do
        if ! command -v $cmd &>/dev/null; then
            echo "  WARNING: $cmd not found on PATH"
        fi
    done
fi
echo ""

# ANTs
echo "--- ANTs ---"
if command -v antsBrainExtraction.sh &>/dev/null; then
    echo "  antsBrainExtraction.sh: found"
    ants_loc=$(which antsBrainExtraction.sh)
    echo "  Location: $ants_loc"
else
    echo "  FAIL: antsBrainExtraction.sh not found"
    errors=$((errors + 1))
fi

if command -v Atropos &>/dev/null; then
    echo "  Atropos: found"
else
    echo "  WARNING: Atropos not found (needed for ICV calculation)"
fi
echo ""

# MRtrix3
echo "--- MRtrix3 ---"
for cmd in dwidenoise mrdegibbs dwiextract mrinfo mrconvert; do
    if command -v $cmd &>/dev/null; then
        echo "  $cmd: found"
    else
        echo "  FAIL: $cmd not found"
        errors=$((errors + 1))
    fi
done
echo ""

# dcm2niix
echo "--- dcm2niix ---"
if command -v dcm2niix &>/dev/null; then
    dcm2niix_version=$(dcm2niix --version 2>&1 | head -1)
    echo "  Version: $dcm2niix_version"
else
    echo "  FAIL: dcm2niix not found"
    errors=$((errors + 1))
fi
echo ""

# GPU (optional)
echo "--- GPU (optional) ---"
if command -v nvidia-smi &>/dev/null; then
    gpu_name=$(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | head -1)
    echo "  GPU: $gpu_name"
    if ls "$FSLDIR/bin/eddy_cuda"* &>/dev/null 2>&1; then
        echo "  eddy_cuda: found"
    else
        echo "  eddy_cuda: not found (CPU eddy will be used — slower but same results)"
    fi
else
    echo "  No NVIDIA GPU detected (CPU processing will be used)"
fi
echo ""

# Summary
echo "=========================================="
if [ $errors -eq 0 ]; then
    echo "  All checks passed. Environment is ready."
else
    echo "  $errors issue(s) found. See above for details."
fi
echo "=========================================="
```

## Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| `FSLDIR: not set` | FSL not sourced in shell profile | Add `source $FSLDIR/etc/fslconf/fsl.sh` to `~/.bashrc` |
| `command not found: flirt` | FSL bin not on PATH | Add `export PATH="$FSLDIR/bin:$PATH"` to `~/.bashrc` |
| `libopenblas.so: cannot open` | Missing system library | `sudo apt-get install libopenblas-dev` |
| X11 forwarding fails | XQuartz not installed (macOS) or SSH config issue | Install XQuartz; use `ssh -XY` |
| `module: command not found` | Not on an HPC system with modules | Install tools directly instead |
| conda conflicts | Package version conflicts | Create a dedicated environment: `conda create -n neuro` |
| Permission denied during install | No root access | Use conda, Singularity, or ask your sysadmin |
| `eddy_cuda` crashes | CUDA version mismatch | Match CUDA toolkit version to what FSL expects |

## Next Steps

Once your environment is verified, you are ready to start the pipeline:
- **[Step 1: DICOM to NIfTI Conversion](../pipeline/dicom-to-nifti)** — Convert raw scanner data
- **[Practice Data](../reference/practice-data)** — Download public DTI data to learn with
