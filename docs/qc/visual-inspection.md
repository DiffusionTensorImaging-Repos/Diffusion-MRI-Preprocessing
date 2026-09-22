---
sidebar_position: 2
title: "Visual Inspection"
---

# Visual Inspection with FSLeyes

## Skull Stripping (Step 2)

Overlay the extracted brain on the original T1 to check the result:

```bash
fsleyes "$nifti_dir/${subj}_struct.nii" \
        "$ants_dir/${subj}_BrainExtractionBrain.nii.gz" \
        -cm blue-lightblue -a 50 &
```

**What good looks like:** All cortical gray matter is preserved (including temporal poles and inferior frontal lobe), skull and dura are cleanly removed, and the cerebellum is intact.

**Warning signs:**
- **Over-stripping** — brain tissue removed, especially at the temporal poles or cerebellum
- **Under-stripping** — skull or dura still attached
- **Asymmetric stripping** — one hemisphere stripped more aggressively than the other

## Eddy-Corrected Data (Step 8)

Scroll through the corrected 4D volumes to check alignment:

```bash
fsleyes "$eddy_dir/${subj}_eddy.nii.gz" &
```

Use the volume slider to step through. Volumes should be well-aligned with no jumping between frames.

**Warning signs:**
- **Signal dropout** — unusually dark slices (the `--repol` flag should have caught these, but verify)
- **Venetian blind artifact** — alternating bright/dark stripes from interleaved acquisition with motion
- **Volume-to-volume jumps** — the brain shifts suddenly between adjacent volumes

## Optional: FA Maps (Step 9)

A quick sanity check — not a formal QC step:

```bash
fsleyes "$dtifit_dir/${subj}_DTI_FA.nii.gz" -cm hot &
```

White matter tracts should be bright, CSF should be dark, and there should be no streaks or rings. If the FA map looks wrong, the problem almost always originated at an earlier stage.
