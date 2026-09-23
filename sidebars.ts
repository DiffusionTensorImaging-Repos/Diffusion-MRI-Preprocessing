import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Foundations',
      collapsed: false,
      items: [
        'foundations/what-is-dti',
        'foundations/diffusion-physics',
        'foundations/b-values-and-gradients',
        'foundations/file-formats',
        'foundations/acquisition-protocols',
      ],
    },
    {
      type: 'category',
      label: 'Tool Ecosystem',
      items: [
        'tools/overview',
        'tools/fsl',
        'tools/ants',
        'tools/mrtrix3',
        'tools/dcm2niix',
        'tools/pyafq',
        'tools/qsiprep',
        'tools/environment-setup',
      ],
    },
    {
      type: 'category',
      label: 'Pipeline',
      collapsed: false,
      items: [
        'pipeline/overview',
        {
          type: 'category',
          label: 'Part A — Core Preprocessing',
          collapsed: false,
          items: [
            'pipeline/qsiprep-route',
            'pipeline/dicom-to-nifti',
            'pipeline/skull-stripping',
            'pipeline/b0-concatenation',
            'pipeline/topup',
            'pipeline/mean-b0',
            'pipeline/brain-masking',
            'pipeline/denoising-gibbs',
            'pipeline/eddy',
          ],
        },
        {
          type: 'category',
          label: 'Part B — Tractography Readiness',
          collapsed: false,
          items: [
            'pipeline/dtifit',
            'pipeline/flirt-registration',
            'pipeline/response-functions',
            'pipeline/fod-estimation',
            'pipeline/output-contract',
          ],
        },
        {
          type: 'category',
          label: 'Part C — Optional Steps',
          collapsed: true,
          items: [
            'pipeline/bedpostx',
            'pipeline/shell-extraction',
            'pipeline/icv-calculation',
            'pipeline/pyafq-bids',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Quality Control',
      items: [
        'qc/visual-inspection',
        'qc/eddy-qc',
      ],
    },
    {
      type: 'category',
      label: 'Advanced Topics',
      items: [
        'advanced/failure-recovery',
        'advanced/parallelization',
        'advanced/bids-standard',
        'advanced/multi-shell',
      ],
    },
    {
      type: 'category',
      label: 'Reference',
      items: [
        'reference/practice-data',
        'reference/config-files',
        'reference/glossary',
        'reference/papers',
        'reference/worked-example',
      ],
    },
  ],
};

export default sidebars;
