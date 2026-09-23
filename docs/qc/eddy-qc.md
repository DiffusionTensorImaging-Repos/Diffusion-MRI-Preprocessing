---
sidebar_position: 3
title: "EDDY QC (eddy_quad & eddy_squad)"
---

# EDDY Quality Control

FSL provides two QC tools for eddy output: `eddy_quad` for individual subjects and `eddy_squad` for group-level summaries.

## Per-Subject: eddy_quad

`eddy_quad` generates an HTML/PDF report with motion plots, outlier maps, and summary statistics for a single subject.

```bash
eddy_quad "$eddy_dir/${subj}_eddy" \
    -idx "$config_dir/index.txt" \
    -par "$config_dir/acqp.txt" \
    -m "$mask_dir/${subj}_topup_Tmean_brain_mask.nii.gz" \
    -b "$nifti_dir/${subj}_dti.bval" \
    -v
```

The first argument is the eddy output prefix (without `.nii.gz`) — the same prefix you passed to eddy's `--out` flag.

### Key Metrics

| Metric | Concern Threshold |
|--------|-------------------|
| Average absolute motion | > 2 mm |
| Average relative motion | > 1 mm |
| Outlier slices | > 10% |

The `qc.pdf` report also shows motion traces (translation and rotation over volumes) and an outlier map showing which slices in which volumes were flagged. Scattered outliers are normal; clusters of outliers across consecutive volumes indicate a period of severe motion.

## Group-Level: eddy_squad

After running `eddy_quad` for all subjects, `eddy_squad` produces scatter plots that make it easy to spot outlier subjects across the group:

```bash
# Create a list of all eddy_quad output directories
ls -d "$base_dir"/eddy/sub-*/*_eddy.qc > squad_list.txt

# Run eddy_squad
eddy_squad squad_list.txt -o "$base_dir/qc/eddy_squad_report"
```

The output `group_qc.pdf` plots each subject as a point for motion and outlier metrics. Subjects that fall far from the cluster are worth inspecting more closely.

## Using These Metrics

Subjects exceeding the thresholds above (absolute motion > 2 mm, relative motion > 1 mm, or outlier slices > 10%) should generally be excluded. Define your thresholds before you start processing and report them in your methods section.

## References

- Bastiani M, Cottaar M, Fitzgibbon SP, et al. (2019). Automated quality control for within and between studies diffusion MRI data using a non-parametric framework for movement and distortion correction. *NeuroImage*, 184, 801-812.
- FSL eddy_quad documentation: [https://fsl.fmrib.ox.ac.uk/fsl/fslwiki/eddyqc/UsersGuide](https://fsl.fmrib.ox.ac.uk/fsl/fslwiki/eddyqc/UsersGuide)
