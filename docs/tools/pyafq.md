---
sidebar_position: 6
title: "pyAFQ"
---

# pyAFQ — Automated Fiber Quantification

## Overview

pyAFQ is a Python package for automated identification and quantification of major white matter tracts. It takes BIDS-formatted diffusion data and produces **tract profiles** — measures of diffusion properties (FA, MD, RD, AD) sampled at regular intervals along the length of each white matter bundle.

This is the final analysis step in the pipeline: after all preprocessing is complete, pyAFQ identifies tracts like the corticospinal tract, arcuate fasciculus, and corpus callosum, then profiles how diffusion metrics vary along each tract. These profiles are the primary output used in statistical analyses.

**GitHub**: [https://github.com/yeatmanlab/pyAFQ](https://github.com/yeatmanlab/pyAFQ)
**Documentation**: [https://yeatmanlab.github.io/pyAFQ/](https://yeatmanlab.github.io/pyAFQ/)

## Installation

### Option 1: pip (Recommended)

```bash
# Create a dedicated virtual environment (recommended)
python3 -m venv ~/envs/pyafq
source ~/envs/pyafq/bin/activate

pip install pyAFQ
```

### Option 2: conda + pip

```bash
conda create -n pyafq python=3.10
conda activate pyafq
pip install pyAFQ
```

### Option 3: Development Version

```bash
git clone https://github.com/yeatmanlab/pyAFQ.git
cd pyAFQ
pip install -e ".[dev]"
```

pyAFQ works best with Python 3.9–3.11. Check compatibility with your Python version on the [pyAFQ releases page](https://github.com/yeatmanlab/pyAFQ/releases).

## Verify Installation

```bash
# Check that pyAFQ is importable
python -c "import AFQ; print(AFQ.__version__)"

# Check the CLI tool
pyAFQ --help
```

## BIDS Input Requirements

pyAFQ requires data organized in [BIDS format](https://bids-specification.readthedocs.io/). Specifically, it expects preprocessed diffusion data in a BIDS derivatives directory:

```
my_study/
  derivatives/
    dmriprep/                    # or whatever you name your derivatives folder
      dataset_description.json   # Required by BIDS
      sub-001/
        ses-01/                  # sessions are optional
          dwi/
            sub-001_ses-01_dwi.nii.gz
            sub-001_ses-01_dwi.bval
            sub-001_ses-01_dwi.bvec
          anat/
            sub-001_ses-01_T1w.nii.gz
      sub-002/
        ...
```

### dataset_description.json

Every BIDS derivatives directory needs this file. A minimal version:

```json
{
  "Name": "My DTI Preprocessing",
  "BIDSVersion": "1.6.0",
  "PipelineDescription": {
    "Name": "custom-dti-pipeline"
  }
}
```

See [BIDS & pyAFQ](../pipeline/pyafq-bids) for a complete guide to organizing your preprocessed data into BIDS format.

## Running pyAFQ

### Python API

```python
import AFQ.api.group as afq

myafq = afq.GroupAFQ(
    bids_path="/path/to/my_study",
    preproc_pipeline="dmriprep",
)

# Run the full pipeline
myafq.export_all()
```

### Command Line

```bash
# Generate a default configuration file
pyAFQ config --output afq_config.toml

# Edit afq_config.toml to match your study

# Run
pyAFQ run afq_config.toml
```

### Configuration File (TOML)

The configuration file controls all aspects of pyAFQ processing. Key settings:

```toml
[BIDS]
bids_path = "/path/to/my_study"
dmriprep = "dmriprep"

[TRACTOGRAPHY]
# "ift" = iterative fiber tracking (default)
# "pft" = particle filter tracking (better anatomical priors)
tractography_type = "ift"
n_seeds = 2  # seeds per voxel

[SEGMENTATION]
# Which bundles to identify
bundle_info = "default"  # uses standard 24-bundle atlas

[CLEANING]
# Remove outlier streamlines
clean_rounds = 5
distance_threshold = 5
```

## pyAFQ Outputs

### Tract Profiles

The primary output — a CSV/JSON table with diffusion metrics (FA, MD, AD, RD) sampled at 100 points along each identified tract, for each subject:

| subject | tractID | nodeID | FA | MD | RD | AD |
|---------|---------|--------|----|----|----|-----|
| sub-001 | CST_L | 0 | 0.45 | 0.0008 | 0.0005 | 0.0014 |
| sub-001 | CST_L | 1 | 0.47 | 0.0007 | 0.0005 | 0.0013 |
| ... | ... | ... | ... | ... | ... | ... |

### Bundle Segmentations

3D NIfTI images showing which voxels belong to each identified tract. These can be visualized in FSLeyes or mrview.

### Visualizations

pyAFQ generates interactive HTML visualizations of the identified tracts using [FURY](https://fury.gl/) or [Plotly](https://plotly.com/). You can also use [AFQ-Browser](https://github.com/yeatmanlab/AFQ-Browser) for interactive web-based exploration of results.

## Common Bundles Identified

pyAFQ identifies 24 major white matter bundles by default, including:

| Bundle | Abbreviation | Function |
|--------|-------------|----------|
| Corticospinal Tract | CST (L/R) | Motor control |
| Arcuate Fasciculus | ARC (L/R) | Language processing |
| Superior Longitudinal Fasciculus | SLF (L/R) | Attention, spatial processing |
| Inferior Longitudinal Fasciculus | ILF (L/R) | Visual processing |
| Uncinate Fasciculus | UNC (L/R) | Memory, emotion |
| Corpus Callosum (forceps) | FA, FP | Interhemispheric communication |
| Cingulum | CIN (L/R) | Limbic function |

## Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "No diffusion data found" | BIDS directory structure incorrect | Check that file naming follows BIDS conventions exactly; run the [BIDS Validator](https://bids-standard.github.io/bids-validator/) |
| Missing `dataset_description.json` | Required BIDS file not present | Create it in your derivatives directory (see example above) |
| Poor tract segmentation | Low-quality preprocessing or few gradient directions | Check FA maps; ensure eddy correction worked properly; more directions = better tract identification |
| Out of memory | Tractography with too many seeds | Reduce `n_seeds` in configuration |
| Slow processing | Normal for full tractography | Expect 30–60 min per subject; use `n_seeds=1` for testing |

## References

- Yeatman JD, Dougherty RF, Myall NJ, Wandell BA, Feldman HM (2012). Tract profiles of white matter properties: automating fiber-tract quantification. *PLoS One*, 7(11), e49790.
- Kruper J, et al. (2021). Evaluating the reliability of human brain white matter tractometry. *Aperture Neuro*, 1(6).
- [pyAFQ Documentation](https://yeatmanlab.github.io/pyAFQ/) — Full API reference and tutorials
- [pyAFQ Examples](https://yeatmanlab.github.io/pyAFQ/auto_examples/) — Jupyter notebook examples
