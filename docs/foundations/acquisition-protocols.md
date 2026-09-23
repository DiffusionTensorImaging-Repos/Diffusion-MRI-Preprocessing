---
sidebar_position: 5
title: "Acquisition Protocols"
---

# MRI Acquisition Protocols for DTI

Before you can preprocess diffusion data, you need to acquire it properly. The quality of your raw data determines the ceiling of what preprocessing can achieve — no amount of correction can fix a fundamentally flawed acquisition. This page covers what scans you need, how to set up a DTI protocol, and what to check before leaving the scanner.

## Required Scans

A complete DTI acquisition for the preprocessing pipeline described in this tutorial requires **four scan types**:

| Scan | Purpose | Typical Duration |
|------|---------|-----------------|
| **T1-weighted structural** | High-resolution anatomical reference for skull stripping and registration | 5–7 min |
| **DWI (main diffusion run)** | Diffusion-weighted images with multiple gradient directions and b-values | 8–20 min |
| **Fieldmap AP** | B0 field map with anterior-to-posterior phase encoding | 30 sec – 1 min |
| **Fieldmap PA** | B0 field map with posterior-to-anterior phase encoding | 30 sec – 1 min |

Without fieldmaps, you cannot run TOPUP to correct susceptibility distortions. Skipping TOPUP means your frontal and temporal lobe data will be geometrically distorted, which biases FA measurements and degrades registration accuracy. Always acquire fieldmaps with opposite phase encoding directions.

### T1-Weighted Structural

The T1 provides high-resolution anatomy for:
- Skull stripping (brain extraction)
- Registering diffusion space to structural space
- Bridging from structural to standard space (MNI)

Common sequences: **MPRAGE** (Siemens), **BRAVO** (GE), **3D TFE** (Philips). Typical resolution: 1 mm isotropic.

### DWI — The Main Diffusion Acquisition

This is your primary data. Key parameters to consider:

| Parameter | Recommendation | Why |
|-----------|---------------|-----|
| **b-values** | 0, 1000 for basic DTI; 0, 1000, 2000, 3000 for multi-shell | Higher shells enable CSD/NODDI; single shell is sufficient for FA/MD |
| **Number of directions** | 30 minimum, 60+ preferred | More directions = more robust tensor fit and better angular resolution |
| **Number of b=0 images** | 6–10 scattered throughout the run | More b=0 images improve SNR for brain masking and normalization |
| **Resolution** | 1.5–2.5 mm isotropic | Smaller voxels resolve finer anatomy but have lower SNR |
| **Multiband factor** | 2–4 (if available) | Acquires multiple slices simultaneously, reducing scan time |

#### Number of Directions

| Analysis | Minimum Directions | Recommended |
|----------|-------------------|-------------|
| Basic DTI (FA, MD) | 6 (absolute minimum) | 30+ |
| Robust DTI with reliable statistics | 20 | 30–64 |
| HARDI / CSD (crossing fibers) | 45 | 60–90 per shell |
| NODDI | 30 per shell | 60+ per shell |

More directions are almost always better. The main constraint is scan time — each additional direction adds a few seconds.

### Fieldmaps (Reverse Phase-Encoded B0s)

Fieldmaps correct **susceptibility distortions** — geometric warping that occurs near air-tissue interfaces (sinuses, ear canals). These distortions are strongest in the frontal and temporal lobes.

The method used in this pipeline (TOPUP) requires B0 images acquired with **opposite phase encoding directions**:
- **AP (anterior-to-posterior)**: Distortions push the frontal lobe posteriorly
- **PA (posterior-to-anterior)**: Distortions push the frontal lobe anteriorly

By comparing the two distortion patterns, TOPUP can estimate and correct the underlying field inhomogeneity.

**What to acquire**: A short spin-echo EPI sequence with the same geometry (resolution, FOV, slice thickness) as your main DWI, but acquired once with AP and once with PA phase encoding. Each takes about 30 seconds.

## Vendor-Specific Naming

Different scanner vendors use different names for the same things:

| Concept | Siemens | GE | Philips |
|---------|---------|-----|---------|
| T1 structural | MPRAGE | BRAVO / IR-FSPGR | 3D TFE |
| DWI sequence | ep2d_diff | DTI / DW-EPI | DWI / dMRI |
| Multiband | SMS (CMRR) | HyperBand | MultiBand SENSE |
| Phase encoding direction | In DICOM header | In DICOM header | In .PAR file |
| DICOM output | One file per slice or enhanced DICOM | One file per series | Classic DICOM or PAR/REC |

Before running `dcm2niix`, understand how your scanner exports DICOMs. Some scanners produce one DICOM file per slice (thousands of files per scan), while others produce one enhanced DICOM file per series. Both work with `dcm2niix`, but the directory organization will look very different.

## Multiband (Simultaneous Multi-Slice) Acceleration

Multiband acceleration acquires multiple slices simultaneously, dramatically reducing scan time. A multiband factor of 3 (MB3) means 3 slices are acquired at once, reducing the time for each volume by roughly 3x.

This technology was developed by the CMRR group at the University of Minnesota and is now available on most modern scanners (Siemens, GE, Philips).

**Practical considerations:**
- MB2–MB3 is standard and well-tested
- MB4+ can introduce artifacts (slice leakage) — use with caution
- In-plane acceleration (GRAPPA/SENSE) is often combined with multiband
- The combination of multiband and GRAPPA dramatically reduces scan time, enabling high-quality multi-shell acquisitions in under 15 minutes

## Phase Encoding Direction and Readout Time

Two parameters from your acquisition are critical for configuring TOPUP and eddy:

### Phase Encoding Direction

This determines which direction susceptibility distortions occur in the image. For most DTI acquisitions:
- **AP (anterior-to-posterior)**: Phase encoding runs from front to back. In the `acqp.txt` file, this is typically `0 -1 0 readout_time`
- **PA (posterior-to-anterior)**: Phase encoding runs from back to front. This is typically `0 1 0 readout_time`

The mapping between AP/PA and the numeric encoding in `acqp.txt` depends on your scanner and how the DICOM images were reconstructed. Always verify using the JSON sidecar from dcm2niix — look for the `PhaseEncodingDirection` field. See [Configuration Files](../reference/config-files) for details.

### Total Readout Time

The total readout time (in seconds) is needed for the `acqp.txt` file. It can be found in the JSON sidecar from dcm2niix:

```json
{
  "PhaseEncodingDirection": "j-",
  "TotalReadoutTime": 0.0959097,
  "EffectiveEchoSpacing": 0.000689998
}
```

If `TotalReadoutTime` is not directly available, it can be calculated from other parameters. See the [dcm2niix documentation](../tools/dcm2niix) for details.

## Example Protocols

### Basic DTI (Single Shell, ~10 minutes)

Suitable for studies focused on FA and MD:
- 1 mm isotropic T1 MPRAGE (~6 min)
- 64 directions at b=1000, 8 b=0 images, 2 mm isotropic (~8 min)
- AP and PA fieldmaps (~1 min total)
- **Total: ~15 minutes**

### Multi-Shell DTI (~20 minutes)

Suitable for CSD, NODDI, and DKI:
- 1 mm isotropic T1 MPRAGE (~6 min)
- 10 b=0 + 64 at b=1000 + 64 at b=2000 + 64 at b=3000, 1.5 mm isotropic, MB3 (~15 min)
- AP and PA fieldmaps (~1 min total)
- **Total: ~22 minutes**

### Minimal DTI (~7 minutes)

Suitable for clinical settings with limited scan time:
- 1 mm isotropic T1 MPRAGE (~6 min)
- 30 directions at b=1000, 5 b=0 images, 2.5 mm isotropic (~4 min)
- AP and PA fieldmaps (~1 min total)
- **Total: ~11 minutes**

## Before Leaving the Scanner

Always verify your data before the participant leaves:

1. **Check volume counts**: Does the DWI have the expected number of volumes? (directions + b=0 images)
2. **Quick visual check**: Open the DWI on the scanner console — is the brain fully in the FOV? Any obvious artifacts?
3. **Fieldmaps acquired**: Confirm both AP and PA fieldmaps are in the export queue
4. **DICOM export**: Start the DICOM transfer before the participant leaves — if something went wrong, you can re-scan

## References

- Jones DK, Knosche TR, Turner R (2013). White matter integrity, fiber count, and other fallacies: The do's and don'ts of diffusion MRI. *NeuroImage*, 73, 239-254.
- Tournier JD, Mori S, Leemans A (2011). Diffusion tensor imaging and beyond. *Magnetic Resonance in Medicine*, 65(6), 1532-1556.
- Sotiropoulos SN, Jbabdi S, Xu J, et al. (2013). Advances in diffusion MRI acquisition and processing in the Human Connectome Project. *NeuroImage*, 80, 125-143.
- Setsompop K, Gagoski BA, Polimeni JR, et al. (2012). Blipped-controlled aliasing in parallel imaging for simultaneous multislice echo planar imaging with reduced g-factor penalty. *Magnetic Resonance in Medicine*, 67(5), 1210-1224.
