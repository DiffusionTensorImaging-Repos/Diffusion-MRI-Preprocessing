---
sidebar_position: 5
title: "Worked Example"
---

# Worked Example Repository

The [example repository](https://github.com/DiffusionTensorImaging-Repos/SDN-IMPACT-DTI) contains this entire pipeline executed end to end on a real multi-shell dataset, with every command, log, and audit kept in place.

It is useful for three things: seeing what each step's output actually looks like, comparing your own results against a dataset that finished cleanly, and copying the exact commands that were run rather than adapting the generalized versions in this tutorial.

## Dataset Characteristics

The example was run on a multi-shell acquisition with the following properties. Several parameter choices in this tutorial follow from them:

| Property | Value |
|---|---|
| Field strength | 3T |
| Acquisition | CMRR multiband, reverse phase-encode pairs |
| b-values | 0, 1000, 2000, 3250, 5000 s/mm² |
| Participants | ~55 |

The reverse phase-encode pairs are what make [TOPUP](../pipeline/topup) possible, and the multiple non-zero shells are what make [multi-shell multi-tissue CSD](../pipeline/fod-estimation) possible. A single-shell dataset would need a different approach at both of those steps.

## Repository Contents

- Every preprocessing stage in this tutorial, fully executed
- Per-step audit scripts and their recorded output
- QC images and reports at each checkpoint
- Parallelized batch scripts written for a shared cluster

## Relationship to This Tutorial

This tutorial presents each step in a generalized form so it transfers to other datasets. The example repository shows one specific instantiation. Where the two differ, the tutorial is the better starting point and the repository is the better reference for what a finished run looks like.
