---
sidebar_position: 3
title: "B-Values and Gradient Directions"
---

# B-Values and Gradient Directions

Every diffusion MRI acquisition is defined by two parameters: how strongly diffusion is weighted (the **b-value**) and in which direction diffusion is measured (the **gradient direction** or **b-vector**). They determine which analyses the data can support.

## B-Values

The b-value controls the sensitivity of the MRI signal to water diffusion. It is defined by the **Stejskal-Tanner equation**:

$$
b = \gamma^2 \, G^2 \, \delta^2 \left( \Delta - \frac{\delta}{3} \right)
$$

where:
- $\gamma$ is the gyromagnetic ratio (a physical constant for hydrogen)
- $G$ is the strength of the diffusion-sensitizing gradient
- $\delta$ is the duration of each gradient pulse
- $\Delta$ is the time between the onset of the two gradient pulses

The b-value is a single number (in units of s/mm$^2$) that summarizes how much the scan is "tuned" to detect diffusion. A higher b-value means the signal is more sensitive to water movement -- voxels where water diffuses freely will lose more signal, while voxels where diffusion is restricted will retain more signal.

The signal attenuation follows:

$$
S = S_0 \, e^{-b \cdot D}
$$

where $S_0$ is the signal with no diffusion weighting and $D$ is the apparent diffusion coefficient along the gradient direction. This exponential relationship is why even modest changes in b-value can substantially affect image contrast and signal-to-noise ratio (SNR).

## Typical B-Values

| B-Value (s/mm$^2$) | Description | Typical Use |
|---|---|---|
| **b = 0** | No diffusion weighting | Baseline reference image (looks like a T2-weighted scan) |
| **b = 1000** | Standard diffusion weighting | Conventional DTI tensor fitting |
| **b = 2000--3000** | Higher weighting | Multi-shell acquisitions, CSD, NODDI |
| **b = 5000+** | Very high weighting | Advanced microstructural models, very low SNR |

As b-value increases, SNR decreases because more signal is lost to diffusion attenuation. This is a fundamental trade-off: higher b-values provide more microstructural information but noisier images.

## Gradient Directions (B-Vectors)

For each diffusion-weighted volume, the scanner applies the sensitizing gradient along a specific **direction in 3D space**. This direction is the **b-vector** (or gradient direction). The measured signal attenuation at each voxel reflects how much water is diffusing *along that particular direction*.

To reconstruct the full 3D diffusion profile, you need measurements along many different directions:

- **Minimum for tensor fitting**: 6 non-collinear directions (since the symmetric tensor has 6 unique elements)
- **Typical DTI**: 30--64 directions, providing more robust and less noisy tensor estimates
- **High angular resolution diffusion imaging (HARDI)**: 60+ directions, required for advanced models like constrained spherical deconvolution (CSD)

The directions are ideally distributed as uniformly as possible over the sphere (imagine placing points evenly on a globe) to ensure equal sensitivity in all orientations. Poor angular coverage can bias tensor estimates.

## The .bval and .bvec Files

After converting raw scanner data to NIfTI format, the diffusion information is stored in two companion text files:

### The .bval File

A single row of space-separated numbers, one per volume in the 4D DWI dataset. Each number is the b-value for that volume.

```
0 1000 1000 1000 1000 1000 0 2000 2000 2000 2000 2000
```

In this example, volumes 1 and 7 are b=0 images, volumes 2--6 are b=1000, and volumes 8--12 are b=2000.

### The .bvec File

Three rows of space-separated numbers (x, y, and z components), with one column per volume. Each column is a unit vector specifying the gradient direction for that volume.

```
0 0.583 -0.291 0.812 -0.471 0.109 0 0.583 -0.291 0.812 -0.471 0.109
0 0.412 0.731 -0.105 0.622 -0.883 0 0.412 0.731 -0.105 0.622 -0.883
0 0.701 -0.618 0.574 -0.626 0.456 0 0.701 -0.618 0.574 -0.626 0.456
```

For b=0 volumes, the gradient direction is typically `[0, 0, 0]` since no diffusion gradient is applied.

The .bval and .bvec files must be kept in sync with the NIfTI data. If you remove, reorder, or extract volumes from the 4D image, you must apply the same changes to these files. Mismatched bvals/bvecs will produce incorrect tensor fits with no error message -- the software will not warn you.

## Single-Shell vs. Multi-Shell Acquisitions

### Single-Shell

A single-shell acquisition uses **one non-zero b-value** (plus b=0 images). For example, a dataset with b=0 and b=1000 is a single-shell acquisition.

Single-shell data is sufficient for:
- Standard DTI tensor fitting
- Basic tractography
- FA, MD, AD, RD maps

### Multi-Shell

A multi-shell acquisition collects data at **multiple non-zero b-values**. For example, b=0, 1000, 2000, and 3000.

Multi-shell data enables:
- **Constrained Spherical Deconvolution (CSD)** with multi-shell multi-tissue (MSMT) variants
- **NODDI** (Neurite Orientation Dispersion and Density Imaging)
- **Diffusion Kurtosis Imaging (DKI)**
- More robust fiber orientation estimation and tissue segmentation

Multi-shell sequences like the CMRR multiband diffusion sequence commonly acquire shells at b=0, 1000, 2000, and 3000 with matched gradient direction sets at each shell.

## The B=0 Image

With no diffusion gradient applied, b=0 volumes are essentially T2-weighted and serve as the **baseline reference** for calculating diffusion metrics (the $S_0$ in the signal equation above).

Most protocols acquire **multiple b=0 volumes** distributed throughout the scan rather than just one at the beginning. This provides:
- Better SNR through averaging
- The ability to track and correct for signal drift over the scan duration
- Reference points for motion correction algorithms

In multi-shell sequences, you will often see b=0 volumes interspersed between shells. Some protocols also acquire b=0 volumes with reversed phase-encoding directions, which are critical for [susceptibility distortion correction (TOPUP)](../pipeline/topup).

## Shell Selection for Analysis

Not all acquired shells are necessarily used for every analysis. The choice depends on the model being fit:

**For standard tensor fitting (DTI):** Use b=1000 (and b=0). The tensor model assumes Gaussian diffusion, which is a reasonable approximation at b=1000 but increasingly violated at higher b-values where non-Gaussian effects (restricted diffusion, kurtosis) become significant. Including shells above b~1200 in a simple tensor fit can actually degrade the results.

**For CSD and tractography:** Higher b-values (b=2000--3000) provide sharper fiber orientation estimates. Multi-shell multi-tissue CSD benefits from having both low and high shells.

**For NODDI and other multi-compartment models:** These models are specifically designed to leverage multi-shell data and typically require at least two non-zero shells.

### Excluding Shells

Some acquisition protocols include low b-value shells (e.g., b=250 or b=500). These intermediate shells:

- Do not add meaningful information for standard tensor fitting since the Gaussian diffusion assumption holds well enough at b=1000 without needing the extra data point
- Can violate assumptions of models designed for specific b-value ranges
- May be useful for specific analyses (e.g., intravoxel incoherent motion modeling of perfusion) but are often excluded from standard DTI and CSD pipelines

When working with multi-shell data, always verify which shells your processing tools expect and which you are providing. The [Shell Extraction](../pipeline/shell-extraction) stage of the pipeline covers the practical steps for selecting and separating shells.

## Example: A Real Multi-Shell Protocol

A typical CMRR multiband diffusion sequence might acquire:

| Shell | B-Value | Directions | Purpose |
|---|---|---|---|
| 1 | b = 0 | ~10 volumes | Baseline reference, interspersed throughout |
| 2 | b = 1000 | 64 directions | Standard DTI, tensor fitting |
| 3 | b = 2000 | 64 directions | CSD, enhanced angular resolution |
| 4 | b = 3000 | 64 directions | CSD, NODDI, high-weighting models |

This gives a total of ~200 volumes. With multiband acceleration (e.g., MB factor 3--4), the entire acquisition can be completed in approximately 10--15 minutes, making multi-shell protocols feasible for most research studies.

## Key Takeaways

- The **b-value** controls diffusion sensitivity. Higher b = more diffusion contrast but lower SNR.
- **Gradient directions** (b-vectors) determine which directions diffusion is measured along. More directions = more robust estimates.
- The **.bval** and **.bvec** files encode this information and must stay synchronized with the image data.
- **Single-shell** data (e.g., b=0 + b=1000) supports standard DTI. **Multi-shell** data enables advanced models.
- **Shell selection** matters: use b=1000 for tensor fitting, higher shells for CSD and multi-compartment models.
- Always know what shells are in your data before choosing an analysis pipeline.

## References

- Stejskal, E.O., & Tanner, J.E. (1965). Spin diffusion measurements: spin echoes in the presence of a time-dependent field gradient. *The Journal of Chemical Physics*, 42(1), 288--292. [doi:10.1063/1.1695690](https://doi.org/10.1063/1.1695690) -- The original pulsed gradient spin echo experiment.
- Jones, D.K., Horsfield, M.A., & Simmons, A. (1999). Optimal strategies for measuring diffusion in anisotropic systems by magnetic resonance imaging. *Magnetic Resonance in Medicine*, 42(3), 515--525. [DOI](https://doi.org/10.1002/(SICI)1522-2594(199909)42:3%3C515::AID-MRM14%3E3.0.CO;2-Q) -- On gradient direction optimization.
- Tournier, J.-D., Calamante, F., & Connelly, A. (2013). Determination of the appropriate b value and number of gradient directions for high-angular-resolution diffusion-weighted imaging. *NMR in Biomedicine*, 26(12), 1775--1786. [doi:10.1002/nbm.3017](https://doi.org/10.1002/nbm.3017)
