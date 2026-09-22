---
sidebar_position: 1
title: "Practice Data"
---

# Practice Data and Interactive Environments

You do not need your own MRI data to learn DTI preprocessing. Several publicly available datasets provide high-quality diffusion data that you can use to practice every step in this tutorial. This page lists recommended datasets, how to download them, and how to use the interactive Binder environment.

## Recommended Datasets

### Quick Start: Stanford HARDI

The Stanford HARDI dataset is small, well-documented, and frequently used in diffusion MRI tutorials. It is available directly through the [DIPY](https://dipy.org) Python library:

```python
from dipy.data import fetch_stanford_hardi, read_stanford_hardi
fetch_stanford_hardi()    # Downloads ~90 MB
img, gtab = read_stanford_hardi()
```

**Details:**
- Single subject
- 160 gradient directions at b=2000, 10 b=0 images
- 1.5 mm isotropic resolution
- ~90 MB download

This dataset is ideal for testing individual pipeline steps but does not include fieldmaps or a T1 structural, so you cannot practice TOPUP or skull stripping with it.

### Full Pipeline Practice: OpenNeuro

[OpenNeuro](https://openneuro.org) hosts thousands of freely available neuroimaging datasets in BIDS format. These include the complete set of scans needed for the full pipeline.

| Dataset | Description | Shells | Fieldmaps? | Size |
|---------|------------|--------|-----------|------|
| [ds000201](https://openneuro.org/datasets/ds000201) | Multi-shell diffusion, young adults | b=1000, 2000 | Yes | ~2 GB/subject |
| [ds001021](https://openneuro.org/datasets/ds001021) | HCP-style multi-shell | Multiple | Yes | ~3 GB/subject |
| [ds000030](https://openneuro.org/datasets/ds000030) | UCLA Consortium, large sample | b=1000 | Varies | ~1 GB/subject |

:::tip Start With One Subject
Download a single subject first to test your pipeline before processing the full dataset. For `ds000201`, download just `sub-01` (~2 GB) — this is enough to practice all 14 pipeline steps.
:::

### Downloading from OpenNeuro

```bash
# Option 1: OpenNeuro CLI (recommended for large downloads)
pip install openneuro-cli
openneuro download --dataset ds000201 --include sub-01 /path/to/output

# Option 2: AWS CLI (direct from S3)
aws s3 sync --no-sign-request \
    s3://openneuro.org/ds000201/sub-01 \
    /path/to/output/sub-01

# Option 3: DataLad (version-controlled download)
pip install datalad
datalad install https://github.com/OpenNeuroDatasets/ds000201.git
cd ds000201
datalad get sub-01/
```

### Gold Standard: Human Connectome Project (HCP)

The [HCP](https://www.humanconnectome.org/study/hcp-young-adult/data-releases) provides the highest-quality multi-shell diffusion data available:

- 3 shells: b=1000, 2000, 3000 s/mm$^2$
- 90 gradient directions per shell + 18 b=0 images
- 1.25 mm isotropic resolution
- Both AP and PA acquisitions for comprehensive distortion correction
- ~4 GB per subject (diffusion data only)

**Access**: Registration required (free for academic use). Apply at [ConnectomeDB](https://db.humanconnectome.org/).

## Disk Space Requirements

Plan your storage before downloading:

| Dataset | Per Subject | 10 Subjects |
|---------|------------|-------------|
| Stanford HARDI | ~90 MB | ~90 MB (single subject only) |
| OpenNeuro ds000201 | ~2 GB raw | ~20 GB raw |
| HCP (diffusion only) | ~4 GB raw | ~40 GB raw |
| **Processing space** | ~5–10 GB/subject | ~50–100 GB |

:::caution Processing Creates Additional Data
Preprocessing generates intermediate files at each stage. For multi-shell data, expect to use 5–10 GB per subject in addition to the raw data. BedpostX alone generates 2–5 GB of output. Plan for 3–5x your raw data size in total disk space.
:::

## Setting Up Your Own Practice Environment

If you prefer to work locally:

1. **Install the tools**: Follow the [Environment Setup](../tools/environment-setup) guide to install FSL, ANTs, MRtrix3, and dcm2niix
2. **Download a practice dataset**: Use one of the OpenNeuro datasets above
3. **Organize your data**: Create a project directory structure:

```
my_dti_project/
  raw/                # Downloaded data (keep untouched)
    sub-01/
  nifti/              # Converted NIfTI files
  ants/               # Skull stripping output
  topup/              # TOPUP output
  eddy/               # Eddy output
  dtifit/             # Tensor fitting output
  ...
  config/             # acqp.txt, index.txt
  logs/               # Processing logs
```

4. **Create configuration files**: Set up `acqp.txt` and `index.txt` for your data — see [Configuration Files](./config-files)
5. **Follow the pipeline**: Work through each step in the [Pipeline](../pipeline/overview) section

## Adapting to Your Own Data

Once you are comfortable with practice data, applying the pipeline to your own research data requires changing:

| What Changes | Where to Look |
|-------------|--------------|
| File paths and naming | Every script — update `base_dir`, `subj`, file suffixes |
| `acqp.txt` | Must match your scanner's phase encoding direction and readout time — see [Configuration Files](./config-files) |
| `index.txt` | Must have one entry per DWI volume — see [Configuration Files](./config-files) |
| Shell selection | [Shell Extraction](../pipeline/shell-extraction) — depends on your b-values and planned analysis |
| Template choice | [Step 2](../pipeline/skull-stripping) and [Step 10](../pipeline/flirt-registration) — match your population |

The preprocessing steps themselves are identical regardless of the data source. The commands, quality checks, and troubleshooting all apply.
