---
sidebar_position: 1
title: "What is DTI?"
---

# Diffusion Tensor Imaging

Diffusion tensor imaging (DTI) is a magnetic resonance imaging technique that measures how water molecules move through brain tissue. Because water diffusion is shaped by the microstructural environment it occurs in, DTI gives us an indirect window into the organization of white matter -- the bundles of myelinated axons that connect brain regions.

## The Physics: Water Diffusion in the Brain

In an unrestricted environment like a glass of water, molecules move equally in all directions. This is **isotropic diffusion**. Cerebrospinal fluid (CSF) in the ventricles behaves roughly this way.

White matter is different. Axonal membranes and myelin sheaths act as barriers, constraining water to diffuse preferentially along the length of fiber bundles rather than across them. This directional bias is **anisotropic diffusion**. The degree and direction of anisotropy at each location in the brain tells us something about the underlying tissue architecture.

DTI works by applying magnetic field gradients in many different directions during an MRI scan. Each gradient direction produces a different amount of signal loss depending on how freely water moves along that direction. By combining measurements from multiple directions, we can reconstruct a model of the 3D diffusion profile at every voxel.

## The Diffusion Tensor

The model DTI uses is a **3x3 symmetric positive-definite matrix** called the diffusion tensor:

$$
\mathbf{D} = \begin{pmatrix} D_{xx} & D_{xy} & D_{xz} \\ D_{xy} & D_{yy} & D_{yz} \\ D_{xz} & D_{yz} & D_{zz} \end{pmatrix}
$$

Because the matrix is symmetric, there are six unique elements. This is why a minimum of six gradient directions (plus at least one non-diffusion-weighted image) is required to fit the tensor.

In plain terms, the tensor is an ellipsoid that describes the shape and orientation of diffusion at a single voxel. A long, thin ellipsoid means water is moving primarily in one direction (high anisotropy). A sphere means water is moving equally in all directions (isotropy).

## Eigendecomposition: Pulling the Tensor Apart

To extract useful information from the tensor, we decompose it into its **eigenvalues** and **eigenvectors**:

$$
\mathbf{D} = \mathbf{R} \begin{pmatrix} \lambda_1 & 0 & 0 \\ 0 & \lambda_2 & 0 \\ 0 & 0 & \lambda_3 \end{pmatrix} \mathbf{R}^T
$$

where $\lambda_1 \geq \lambda_2 \geq \lambda_3$ are the three eigenvalues and $\mathbf{R}$ contains the corresponding eigenvectors as columns.

What these represent in practical terms:

- **$\lambda_1$ (largest eigenvalue)**: The rate of diffusion along the *primary* direction. Its associated eigenvector points along the dominant fiber orientation at that voxel.
- **$\lambda_2$ (middle eigenvalue)**: Diffusion along the second-most prominent direction.
- **$\lambda_3$ (smallest eigenvalue)**: Diffusion along the most restricted direction, perpendicular to the fiber bundle.

The **primary eigenvector** ($\mathbf{v}_1$) is especially important because it estimates the local fiber direction. This is the basis for tractography -- tracing white matter pathways through the brain by following $\mathbf{v}_1$ from voxel to voxel.

## Key DTI Metrics

Four scalar maps are routinely derived from the diffusion tensor. Each one collapses the tensor into a single number per voxel that captures a different aspect of the diffusion profile.

### Fractional Anisotropy (FA)

$$
FA = \sqrt{\frac{3}{2}} \cdot \frac{\sqrt{(\lambda_1 - \bar{\lambda})^2 + (\lambda_2 - \bar{\lambda})^2 + (\lambda_3 - \bar{\lambda})^2}}{\sqrt{\lambda_1^2 + \lambda_2^2 + \lambda_3^2}}
$$

where $\bar{\lambda} = (\lambda_1 + \lambda_2 + \lambda_3) / 3$ is the mean of the eigenvalues.

**What it tells you:** FA ranges from 0 (isotropic — equal diffusion in all directions) to 1 (strongly directional diffusion along a single axis). White matter typically has FA values between 0.4 and 0.8. Higher FA reflects more directionally coherent tissue structure. It is the most widely reported DTI metric.

### Mean Diffusivity (MD)

$$
MD = \bar{\lambda} = \frac{\lambda_1 + \lambda_2 + \lambda_3}{3}
$$

**What it tells you:** MD is the average rate of diffusion across all three directions, regardless of orientation. It reflects the overall magnitude of water movement. CSF has high MD (water moves freely); white matter has lower MD (water is more constrained).

### Axial Diffusivity (AD)

$$
AD = \lambda_1
$$

**What it tells you:** AD is simply the largest eigenvalue -- the rate of diffusion along the primary fiber direction. It reflects how easily water moves *parallel* to the axon bundle.

### Radial Diffusivity (RD)

$$
RD = \frac{\lambda_2 + \lambda_3}{2}
$$

**What it tells you:** RD is the average of the two smaller eigenvalues -- diffusion *perpendicular* to the primary fiber direction.

## Interpreting Changes in DTI Metrics

Researchers often use DTI metrics as proxy markers for specific types of white matter pathology. The following are commonly cited interpretive patterns, though it is important to note that these are **simplified heuristics** and that DTI metrics are influenced by many factors simultaneously:

| Change | What It Reflects |
|---|---|
| Decreased FA | Less directionally organized diffusion — could reflect crossing fibers, less coherent structure, or many other factors |
| Increased MD | More unrestricted water movement overall |
| Decreased AD | Reduced diffusion along the primary axis |
| Increased RD | More diffusion perpendicular to the primary axis |
| Increased FA in development | Increasingly directional tissue organization |

These interpretations should be made cautiously. A single voxel's DTI metrics are influenced by fiber density, crossing fibers, partial volume effects, and noise -- not just the biological process of interest. Group-level studies and converging evidence from multiple modalities strengthen the conclusions you can draw.

## Limitations of the Single Tensor Model

The most important limitation of DTI is that **the single tensor can only model one fiber direction per voxel**. In reality, an estimated 60--90% of white matter voxels contain crossing, kissing, or fanning fibers ([Jeurissen et al., 2013](https://doi.org/10.1002/hbm.22099)).

In a crossing-fiber voxel, the tensor becomes more spherical (not because diffusion is truly isotropic, but because the single ellipsoid is trying to represent two or more distinct directions at once). This leads to artificially reduced FA and unreliable eigenvector estimates -- a fundamental problem for both scalar metrics and tractography.

## Beyond the Single Tensor

Several advanced diffusion models address the crossing-fiber problem:

- **Constrained Spherical Deconvolution (CSD)** estimates a fiber orientation distribution function (fODF) that can represent multiple fiber populations within a voxel. It is the basis for most modern tractography ([Tournier et al., 2007](https://doi.org/10.1016/j.neuroimage.2007.02.016)).
- **Neurite Orientation Dispersion and Density Imaging (NODDI)** separates the diffusion signal into intracellular, extracellular, and CSF compartments, providing metrics like neurite density and orientation dispersion ([Zhang et al., 2012](https://doi.org/10.1016/j.neuroimage.2012.03.072)).
- **Diffusion Kurtosis Imaging (DKI)** extends the tensor model by measuring non-Gaussian diffusion, which is sensitive to tissue microstructural complexity ([Jensen et al., 2005](https://doi.org/10.1002/mrm.20508)).

These models generally require more gradient directions and/or multiple b-value shells, which we discuss in the [B-Values and Gradient Directions](./b-values-and-gradients.md) section.

## Clinical and Research Applications

DTI is used extensively across neuroscience and clinical research:

- **Neurodevelopment**: Tracking white matter maturation from infancy through adulthood.
- **Neurodegenerative disease**: Detecting early white matter changes in conditions like Alzheimer's disease, ALS, and multiple sclerosis.
- **Traumatic brain injury**: Identifying diffuse axonal injury that is invisible on conventional MRI.
- **Psychiatric disorders**: Investigating structural connectivity differences in schizophrenia, depression, and autism.
- **Neurosurgical planning**: Mapping critical white matter tracts (e.g., corticospinal tract, arcuate fasciculus) to guide surgical approaches.
- **Connectomics**: Building whole-brain structural connectivity networks from tractography data.

## Key References

- Basser, P.J., Mattiello, J., & LeBihan, D. (1994). MR diffusion tensor spectroscopy and imaging. *Biophysical Journal*, 66(1), 259--267. [doi:10.1016/S0006-3495(94)80775-1](https://doi.org/10.1016/S0006-3495(94)80775-1) -- The foundational paper introducing the diffusion tensor model.
- Le Bihan, D. (2001). Diffusion tensor imaging: concepts and applications. *Journal of Magnetic Resonance Imaging*, 13(4), 534--546. [doi:10.1002/jmri.1076](https://doi.org/10.1002/jmri.1076)
- Mori, S., & Zhang, J. (2006). Principles of diffusion tensor imaging and its applications to basic neuroscience research. *Neuron*, 51(5), 527--539. [doi:10.1016/j.neuron.2006.08.012](https://doi.org/10.1016/j.neuron.2006.08.012)
- Alexander, A.L., Lee, J.E., Lazar, M., & Field, A.S. (2007). Diffusion tensor imaging of the brain. *Neurotherapeutics*, 4(3), 316--329. [doi:10.1016/j.nurt.2007.05.011](https://doi.org/10.1016/j.nurt.2007.05.011)
- Jones, D.K. (Ed.). (2010). *Diffusion MRI: Theory, Methods, and Applications*. Oxford University Press. -- A comprehensive textbook covering both theoretical and practical aspects.
