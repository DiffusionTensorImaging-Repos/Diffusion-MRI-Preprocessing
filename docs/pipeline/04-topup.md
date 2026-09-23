---
sidebar_position: 5
title: "Step 4: TOPUP (Susceptibility Distortion Correction)"
---

# Step 4: TOPUP (Susceptibility Distortion Correction)

## Overview

TOPUP estimates and corrects the **geometric distortions** caused by magnetic susceptibility differences near air-tissue boundaries in the brain. Using the paired AP/PA B0 images prepared in [Step 3](./b0-concatenation), TOPUP models the underlying magnetic field inhomogeneity and computes a correction warp that "unwarps" the distorted EPI images back to their true geometry.

**Further reading:** [TBSS #4: topup and eddy](https://andysbrainbook.readthedocs.io/en/latest/TBSS/TBSS_Course/TBSS_04_TopUpEddy.html) — Andy's Brain Book visual walkthrough of susceptibility distortion and the TOPUP + eddy workflow

## Conceptual Background

### Susceptibility-Induced Distortion

The B0 magnetic field inside the MRI scanner is intended to be perfectly uniform, but in practice it is not. Near boundaries between tissue and air -- such as the **frontal sinuses**, **temporal bones**, and **ear canals** -- the magnetic field becomes distorted because tissue and air have different magnetic susceptibilities.

Echo-planar imaging (EPI) sequences, which are used for diffusion MRI because of their speed, are particularly sensitive to these field inhomogeneities. The result is **geometric warping** along the phase-encoding direction:

- Voxels are shifted from their true anatomical positions
- Some regions appear **stretched** (signal spread out)
- Other regions appear **compressed** (signal piled up, causing artificial bright spots)
- The distortion can be several voxels in magnitude, especially at higher field strengths (3T, 7T)

### Opposite Phase-Encoding Acquisition

If the same anatomy is imaged with opposite phase-encoding directions (AP and PA), the distortions appear in opposite directions:

- In the AP image, a region near the frontal sinuses might be stretched anteriorly
- In the PA image, the same region is compressed anteriorly

The **true, undistorted anatomy** lies between these two distorted versions. TOPUP jointly estimates the **field map** (a 3D map of the B0 field offset at every voxel) that best explains both observed distortion patterns simultaneously. This field map is then used to compute a geometric correction that removes the distortion.

### Mathematical Basis

TOPUP models the observed displacement field as:

```
displacement = gamma * field_offset * total_readout_time * phase_encoding_direction
```

Where:
- `gamma` is the gyromagnetic ratio
- `field_offset` is the local B0 deviation (in Hz)
- `total_readout_time` determines the sensitivity to field offsets
- `phase_encoding_direction` determines which spatial direction the displacement occurs in

The algorithm iteratively refines the field map estimate using a B-spline representation, minimizing the difference between the corrected AP and PA images.

## Prerequisites

- **Merged B0 file** (`${subj}_merged_b0s.nii.gz`) from [Step 3](./b0-concatenation)
- **Acquisition parameters file** (`acqp.txt`) -- see below
- **FSL** installed (TOPUP is part of the FSL suite)

## The Acquisition Parameters File (acqp.txt)

TOPUP requires a text file specifying the phase-encoding direction and timing parameters for each volume in the merged B0 file. Each row corresponds to one volume.

### File Format

```
0 -1 0 0.0321302
0  1 0 0.0321302
```

### Column Definitions

| Column | Meaning | Description |
|--------|---------|-------------|
| 1-3 | **Phase-encoding direction vector** | Unit vector indicating the direction of phase encoding in image space |
| 4 | **Total readout time** | Time (in seconds) from the center of the first echo to the center of the last echo |

### Phase-Encoding Direction Vectors

| Direction | Vector | Meaning |
|-----------|--------|---------|
| AP (anterior-to-posterior) | `0 -1 0` | Phase encoding along the negative y-axis |
| PA (posterior-to-anterior) | `0  1 0` | Phase encoding along the positive y-axis |
| RL (right-to-left) | `-1 0 0` | Phase encoding along the negative x-axis |
| LR (left-to-right) | `1  0 0` | Phase encoding along the positive x-axis |

The direction vectors depend on your data's orientation convention. Always verify the phase-encoding direction from the JSON sidecar files generated during DICOM conversion (Step 1). Look for the `PhaseEncodingDirection` field:
- `j-` corresponds to AP (`0 -1 0`)
- `j` corresponds to PA (`0 1 0`)
- `i-` corresponds to RL (`-1 0 0`)
- `i` corresponds to LR (`1 0 0`)

### Calculating Total Readout Time

The total readout time can be obtained in two ways:

**Option 1: Directly from the JSON sidecar**

Look for the `TotalReadoutTime` field in the JSON file:

```bash
# Extract TotalReadoutTime from the JSON sidecar
cat "$input_dir/${subj}_fmapAP.json" | python3 -c "
import json, sys
data = json.load(sys.stdin)
print(data.get('TotalReadoutTime', 'NOT FOUND'))
"
```

**Option 2: Calculate from other parameters**

If `TotalReadoutTime` is not available, calculate it from `EffectiveEchoSpacing` and `ReconMatrixPE` (or the phase-encoding dimension of the acquisition matrix):

```
TotalReadoutTime = EffectiveEchoSpacing * (ReconMatrixPE - 1)
```

```bash
# Example calculation
cat "$input_dir/${subj}_fmapAP.json" | python3 -c "
import json, sys
data = json.load(sys.stdin)
ees = data.get('EffectiveEchoSpacing')
matrix = data.get('ReconMatrixPE', data.get('AcquisitionMatrixPE'))
if ees and matrix:
    trt = ees * (matrix - 1)
    print(f'TotalReadoutTime = {ees} * ({matrix} - 1) = {trt:.7f}')
else:
    print('Required fields not found in JSON')
"
```

### Creating the acqp.txt File

```bash
# Create acqp.txt for an AP/PA pair with known total readout time
cat > "$config_dir/acqp.txt" << 'EOF'
0 -1 0 0.0321302
0  1 0 0.0321302
EOF
```

The total readout time must be the same for both lines if the AP and PA scans were acquired with identical parameters (which is typically the case). Replace `0.0321302` with the value from your own data.

## Tool & Command Reference

### TOPUP Command

```bash
topup \
    --imain="$input_dir/${subj}_merged_b0s" \
    --datain="$config_dir/acqp.txt" \
    --config=b02b0.cnf \
    --out="$output_dir/${subj}_topup" \
    --iout="$output_dir/${subj}_topup_corrected_b0" \
    --fout="$output_dir/${subj}_topup_fieldmap"
```

**Flag reference:**

| Flag | Description |
|------|-------------|
| `--imain` | Input 4D file containing the merged AP and PA B0 volumes |
| `--datain` | Path to the acquisition parameters file (`acqp.txt`) |
| `--config` | Configuration file for the optimization. `b02b0.cnf` is FSL's default configuration for B0-to-B0 registration and is included with FSL. It specifies the resolution levels, regularization, and convergence criteria. |
| `--out` | Output basename for the estimated field coefficients (spline coefficients and movement parameters). These are needed by `applytopup` and `eddy` in later steps. |
| `--iout` | Output corrected B0 images (the merged B0s after distortion correction) |
| `--fout` | Output estimated field map (in Hz) showing the estimated B0 deviation at each voxel |

### Batch Processing Script

```bash
#!/bin/bash
# batch_topup.sh - Run TOPUP for all subjects
#
# Usage: bash batch_topup.sh

base_dir="/path/to/project"
input_dir="$base_dir/derivatives/b0_concat"
output_dir="$base_dir/derivatives/topup"
config_dir="$base_dir/config"

# Ensure acqp.txt exists
if [ ! -f "$config_dir/acqp.txt" ]; then
    echo "ERROR: $config_dir/acqp.txt not found. Create it first (see documentation)."
    exit 1
fi

for subj_dir in "$input_dir"/sub-*; do
    subj=$(basename "$subj_dir")
    merged_b0="$subj_dir/${subj}_merged_b0s"

    # Check input exists
    if [ ! -f "${merged_b0}.nii.gz" ]; then
        echo "WARNING: No merged B0 file for $subj -- skipping"
        continue
    fi

    out="$output_dir/$subj"
    mkdir -p "$out"

    # Skip if already processed
    if [ -f "$out/${subj}_topup_fieldcoef.nii.gz" ]; then
        echo "Skipping $subj (already processed)"
        continue
    fi

    echo "Running TOPUP: $subj"
    topup \
        --imain="$merged_b0" \
        --datain="$config_dir/acqp.txt" \
        --config=b02b0.cnf \
        --out="$out/${subj}_topup" \
        --iout="$out/${subj}_topup_corrected_b0" \
        --fout="$out/${subj}_topup_fieldmap"

    echo "  Done: $subj"
done

echo "TOPUP processing complete."
```

## Expected Output

```
$output_dir/
  sub-001/
    sub-001_topup_fieldcoef.nii.gz       # B-spline field coefficients
    sub-001_topup_movpar.txt              # Movement parameters estimated during correction
    sub-001_topup_corrected_b0.nii.gz    # Distortion-corrected B0 images
    sub-001_topup_fieldmap.nii.gz        # Estimated field map (Hz)
```

| File | Description | Used By |
|------|-------------|---------|
| `_topup_fieldcoef.nii.gz` | Spline coefficient representation of the estimated field. This is the primary output that encodes the distortion model. | `applytopup`, `eddy` |
| `_topup_movpar.txt` | Estimated rigid-body movement parameters for each input volume | Diagnostic |
| `_topup_corrected_b0.nii.gz` | The input B0 volumes after applying the estimated correction | Quality checking |
| `_topup_fieldmap.nii.gz` | Voxel-wise map of B0 field deviations in Hz | Visualization, diagnostics |

## Quality Check

### Visual Comparison: Corrected vs. Uncorrected

Compare the corrected B0 with the original uncorrected B0 volumes:

```bash
# View uncorrected AP B0 alongside the corrected output
fsleyes \
    "$input_dir/${subj}/${subj}_a2p_b0.nii.gz" \
    "$output_dir/${subj}/${subj}_topup_corrected_b0.nii.gz" &
```

**What to look for:**

- **Frontal lobes**: Distortion near the sinuses should be visibly reduced
- **Temporal lobes**: Warping near the petrous bones should be corrected
- **Symmetry**: The corrected image should appear more symmetric than either the AP or PA input alone
- **Signal recovery**: Areas that appeared as signal voids or bright pileup artifacts in the originals should look more anatomically plausible

### Inspect the Field Map

```bash
# View the estimated field map
fsleyes "$output_dir/${subj}/${subj}_topup_fieldmap.nii.gz" -cm hot &
```

The field map should show:
- **Large deviations** (bright/dark regions) near air-tissue boundaries (frontal, temporal)
- **Near-zero values** in brain regions far from susceptibility boundaries (e.g., parietal lobe)
- **Smooth spatial variation** -- sharp edges or noise in the field map suggest a problem

## Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| **Wrong acqp.txt** | Phase-encoding direction vectors do not match the actual data | Check `PhaseEncodingDirection` in the JSON sidecars; update acqp.txt accordingly |
| **Mismatched readout times** | AP and PA scans had different acquisition parameters | Verify readout time in both JSON files; use the correct value for each line in acqp.txt |
| **Convergence failure** | TOPUP cannot find a good field estimate | Check that the input B0 images are reasonable (not corrupted); ensure AP and PA have opposite distortions |
| **No visible correction** | Field map is near zero everywhere | The acqp.txt readout time may be wrong (too small), or the phase-encoding direction may be incorrect |
| **Over-correction** (new artifacts) | acqp.txt parameters are incorrect (e.g., wrong sign on direction vector) | Double-check the phase-encoding direction signs; swap AP/PA order in acqp.txt if needed |
| **TOPUP takes very long** | Large matrix size or many iterations | Expected runtime: 5-15 minutes per subject. If much longer, check that `b02b0.cnf` is being found by FSL. |

## References

- Andersson, J. L. R., Skare, S., & Ashburner, J. (2003). How to correct susceptibility distortions in spin-echo echo-planar images: application to diffusion tensor imaging. *NeuroImage*, 20(2), 870-888. https://doi.org/10.1016/S1053-8119(03)00336-7
- FSL TOPUP documentation: https://fsl.fmrib.ox.ac.uk/fsl/fslwiki/topup
- FSL TOPUP user guide: https://fsl.fmrib.ox.ac.uk/fsl/fslwiki/topup/TopupUsersGuide

## Next Step

Proceed to **Step 5: Mean B0 Image** to generate a reference B0 from the corrected output for use in subsequent registration and masking steps.
