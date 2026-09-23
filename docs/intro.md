---
sidebar_position: 1
title: "Getting Started"
---

# Diffusion MRI Preprocessing

A practical guide to diffusion MRI preprocessing: from raw scanner output to data a tractography workflow can run on without modification.

## Scope

The pipeline here is **twelve steps in two parts**, followed by a handoff checklist.

- **Part A — Core Preprocessing (Steps 1–8)** takes raw DICOMs through conversion, skull stripping, distortion correction, denoising, and motion/eddy correction. This is the correction work every diffusion study needs regardless of what it does next.
- **Part B — Tractography Readiness (Steps 9–12)** adds tensor fitting, registration, and the constrained spherical deconvolution chain that produces fiber orientation distributions. These are the files tract reconstruction actually reads.
- **[Tractography Handoff](./pipeline/output-contract)** is a checklist: exactly which files must exist, what each is for, and a script to verify them before you start tracking.

A few further steps — BedpostX, shell extraction, ICV, BIDS/pyAFQ — are documented but **optional**. They are grouped separately so the required path stays unambiguous.

## Sections

- **Foundations** — What diffusion MRI measures, how the tensor works, and what the key file formats mean.
- **Pipeline** — The ordered walkthrough described above. Each step explains what it does, why it matters, how to run it, and how to check it worked.
- **Quality Control** — Visual inspection and eddy QC metrics for catching problems early.
- **Tool Guides** — References for FSL, MRtrix3, ANTs, and the other software used throughout.

## Prerequisites

- **Basic Linux/Bash familiarity** — navigating directories, running commands, editing text files.
- **A computing environment** with [FSL](https://fsl.fmrib.ox.ac.uk/fsl/), [ANTs](http://stnava.github.io/ANTs/), and [MRtrix3](https://www.mrtrix.org/) installed. A university cluster, a local workstation, or a container all work.
- **No prior diffusion MRI experience required.** The foundations section covers the basics.

### Data Requirements

| Requirement | Why |
|---|---|
| **Multi-shell acquisition** (2+ non-zero b-values plus b=0) | [Steps 11–12](./pipeline/response-functions) separate white matter, gray matter, and CSF, which single-shell data cannot do. A two-tissue fallback exists but is more affected by partial volume. |
| **Reverse phase-encode b=0 pairs** | Required for [TOPUP](./pipeline/topup) susceptibility distortion correction. |
| **A T1-weighted structural scan** | Needed for skull stripping and for registration between diffusion and template space. |

### Software Versions

Floors below; the [handoff page](./pipeline/output-contract#software-versions) lists specific tested versions.

| Software | Minimum |
|---|---|
| MRtrix3 | 3.0 |
| FSL | 6.0 |
| ANTs | 2.3 |
| Python | 3.8 |

## After Preprocessing

Preprocessing ends where tract reconstruction begins. Once the [handoff contract](./pipeline/output-contract) is satisfied, you have everything a tractography workflow needs: corrected diffusion data, a brain mask, an FA map, a skull-stripped T1, the transform between them, and normalized FOD images.

The [MesoConnect Atlas tutorial](https://diffusiontensorimaging-repos.github.io/MesoConnect-Tutorial/) picks up from exactly that point for corridor-constrained mesolimbic tract reconstruction.

## Example Scripts

The [worked example repository](https://github.com/DiffusionTensorImaging-Repos/SDN-IMPACT-DTI) has scripts that run each pipeline step as a loop across subjects. It is a useful reference for how these steps look in practice — see the [Worked Example](./reference/worked-example) page.

## Getting Started

Head to [Foundations](./foundations/what-is-dti) for the conceptual building blocks, or go directly to the [Pipeline Overview](./pipeline/overview) if you are ready to preprocess.
