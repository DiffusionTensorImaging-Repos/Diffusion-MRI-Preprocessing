---
sidebar_position: 1
title: "Getting Started"
---

# Diffusion MRI Preprocessing

A practical guide to diffusion MRI preprocessing: from raw scanner output to data a tractography workflow can run on without modification.

## Scope

Twelve steps in two parts, followed by a checklist of the resulting files.

- **Part A — Core Preprocessing** applies the corrections required of any diffusion dataset: brain extraction, susceptibility distortion correction, denoising, and head motion and eddy current correction. It has two routes. Route 1 is [a single QSIPrep run](./pipeline/qsiprep-route). Route 2 is [Steps 1–8](./pipeline/dicom-to-nifti) run individually, which expose every parameter and handle acquisitions QSIPrep does not support. Both lead into Part B.
- **Part B — Tractography Readiness (Steps 9–12)** fits the diffusion tensor, registers the anatomical image to the diffusion data, and runs the constrained spherical deconvolution that produces fiber orientation distributions. These are the files a tractography workflow reads.
- **[Outputs for Tractography](./pipeline/required-outputs)** lists the required files, what each is for, and a script that verifies them before tracking.

BedpostX, shell extraction, intracranial volume, and BIDS conversion for pyAFQ are documented separately. They sit outside the required path.

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
| **Diffusion shells: single or multi** | Either works. Multi-shell data (2+ non-zero b-values plus b=0) uses three-tissue MSMT-CSD in [Steps 11–12](./pipeline/response-functions). Single-shell data uses single-tissue CSD instead; [Step 12](./pipeline/fod-estimation#single-shell-data) gives the commands. Do not mix the two models within one study. |
| **Reverse phase-encode b=0 pairs** | Required for [TOPUP](./pipeline/topup) susceptibility distortion correction. |
| **A T1-weighted structural scan** | Needed for skull stripping and for registration between diffusion and template space. |

### Software Versions

Floors below; the [required outputs page](./pipeline/required-outputs#software-versions) lists specific tested versions.

| Software | Minimum |
|---|---|
| MRtrix3 | 3.0 |
| FSL | 6.0 |
| ANTs | 2.3 |
| Python | 3.8 |

## After Preprocessing

This guide ends where tract reconstruction begins. With every [required output](./pipeline/required-outputs) in place, the dataset holds what a tractography workflow reads: corrected diffusion data, a brain mask, an FA map, a skull-stripped T1, the transform between the two, and normalized FOD images. What follows depends on the tracking approach.

## Example Scripts

The [worked example repository](https://github.com/DiffusionTensorImaging-Repos/SDN-IMPACT-DTI) has scripts that run each pipeline step as a loop across subjects. It is a useful reference for how these steps look in practice — see the [Worked Example](./reference/worked-example) page.

## Getting Started

Head to [Foundations](./foundations/what-is-dti) for the conceptual building blocks, or go directly to the [Pipeline Overview](./pipeline/overview) if you are ready to preprocess.
