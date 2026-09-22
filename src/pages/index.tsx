import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

const PIPELINE_STAGES = [
  {num: 1, title: 'DICOM to NIfTI', tools: 'dcm2niix', link: '/docs/pipeline/dicom-to-nifti', part: 'A'},
  {num: 2, title: 'Skull Stripping', tools: 'ANTs', link: '/docs/pipeline/skull-stripping', part: 'A'},
  {num: 3, title: 'B0 Concatenation', tools: 'FSL', link: '/docs/pipeline/b0-concatenation', part: 'A'},
  {num: 4, title: 'TOPUP Distortion Correction', tools: 'FSL', link: '/docs/pipeline/topup', part: 'A'},
  {num: 5, title: 'Mean B0 Image', tools: 'FSL', link: '/docs/pipeline/mean-b0', part: 'A'},
  {num: 6, title: 'Brain Masking', tools: 'FSL', link: '/docs/pipeline/brain-masking', part: 'A'},
  {num: 7, title: 'Denoising & Gibbs Correction', tools: 'MRtrix3', link: '/docs/pipeline/denoising-gibbs', part: 'A'},
  {num: 8, title: 'Eddy Current Correction', tools: 'FSL', link: '/docs/pipeline/eddy', part: 'A'},
  {num: 9, title: 'Tensor Fitting (DTIFIT)', tools: 'FSL', link: '/docs/pipeline/dtifit', part: 'B'},
  {num: 10, title: 'Registration (FLIRT)', tools: 'FSL', link: '/docs/pipeline/flirt-registration', part: 'B'},
  {num: 11, title: 'Response Function Estimation', tools: 'MRtrix3', link: '/docs/pipeline/response-functions', part: 'B'},
  {num: 12, title: 'Fiber Orientation Distributions', tools: 'MRtrix3', link: '/docs/pipeline/fod-estimation', part: 'B'},
];

const PART_LABELS: Record<string, string> = {
  A: 'Part A — Core Preprocessing',
  B: 'Part B — Tractography Readiness',
};

type FeatureItem = {
  title: string;
  icon: ReactNode;
  description: ReactNode;
  link: string;
  linkText: string;
};

const iconProps = {
  width: 48,
  height: 48,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const BookIcon = () => (
  <svg {...iconProps} aria-hidden="true">
    <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22.5z" />
    <path d="M4 4.5V22.5" />
    <path d="M8 7h8M8 11h8" />
  </svg>
);

const StepsIcon = () => (
  <svg {...iconProps} aria-hidden="true">
    <path d="M3 21h4v-4" />
    <path d="M7 17h4v-4" />
    <path d="M11 13h4v-4" />
    <path d="M15 9h4V5" />
    <path d="M3 21h18" />
  </svg>
);

const DatabaseIcon = () => (
  <svg {...iconProps} aria-hidden="true">
    <ellipse cx="12" cy="5" rx="8" ry="3" />
    <path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5" />
    <path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
  </svg>
);

const FeatureList: FeatureItem[] = [
  {
    title: 'Learn DTI Concepts',
    icon: <BookIcon />,
    description: (
      <>
        Understand the physics of diffusion imaging, what FA, MD, and RD actually
        measure, and why each preprocessing step matters for your science.
      </>
    ),
    link: '/docs/foundations/what-is-dti',
    linkText: 'Start Learning',
  },
  {
    title: 'Step-by-Step Pipeline',
    icon: <StepsIcon />,
    description: (
      <>
        Walk through each preprocessing stage with generalized, copy-paste-ready
        code, detailed explanations, and quality checks at every step.
      </>
    ),
    link: '/docs/pipeline/overview',
    linkText: 'View Pipeline',
  },
  {
    title: 'Practice Data & Tools',
    icon: <DatabaseIcon />,
    description: (
      <>
        Download public DTI datasets to practice with, and find setup guides for
        FSL, MRtrix3, ANTs, and other tools used throughout the pipeline.
      </>
    ),
    link: '/docs/reference/practice-data',
    linkText: 'Get Started',
  },
];

function Feature({title, icon, description, link, linkText}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="feature-card">
        <div
          className="text--center"
          style={{
            marginBottom: '1rem',
            color: 'var(--ifm-color-primary)',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          {icon}
        </div>
        <div className="text--center padding-horiz--md">
          <Heading as="h3">{title}</Heading>
          <p>{description}</p>
          <Link className="button button--primary button--sm" to={link}>
            {linkText}
          </Link>
        </div>
      </div>
    </div>
  );
}

function PipelinePreview() {
  return (
    <section className={styles.pipelineSection}>
      <div className="container">
        <Heading as="h2" className="text--center" style={{marginBottom: '0.5rem'}}>
          From Scanner to Tractography-Ready
        </Heading>
        <p className="text--center" style={{marginBottom: '2rem', color: 'var(--ifm-color-emphasis-600)'}}>
          Twelve steps take raw scanner output to data a tractography workflow can run on.
          Part A is corrections every diffusion study needs; Part B produces the specific
          files tract reconstruction reads.
        </p>
        <div className="pipeline-explorer">
          {PIPELINE_STAGES.map((stage, idx) => (
            <div key={stage.num}>
              {(idx === 0 || PIPELINE_STAGES[idx - 1].part !== stage.part) && (
                <p
                  style={{
                    margin: idx === 0 ? '0 0 0.75rem' : '1.5rem 0 0.75rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: 'var(--ifm-color-emphasis-600)',
                  }}>
                  {PART_LABELS[stage.part]}
                </p>
              )}
              <Link to={stage.link} className="pipeline-explorer__stage">
                <div className="pipeline-explorer__number">{stage.num}</div>
                <div className="pipeline-explorer__content">
                  <p className="pipeline-explorer__title">{stage.title}</p>
                  <p className="pipeline-explorer__tools">{stage.tools}</p>
                </div>
              </Link>
              {idx < PIPELINE_STAGES.length - 1 && (
                <div className="pipeline-explorer__arrow">&darr;</div>
              )}
            </div>
          ))}
          <div className="pipeline-explorer__arrow">&darr;</div>
          <Link to="/docs/pipeline/output-contract" className="pipeline-explorer__stage">
            <div className="pipeline-explorer__number">&#10003;</div>
            <div className="pipeline-explorer__content">
              <p className="pipeline-explorer__title">Tractography Handoff</p>
              <p className="pipeline-explorer__tools">Verify outputs before tracking</p>
            </div>
          </Link>
        </div>
        <p className="text--center" style={{marginTop: '2rem', color: 'var(--ifm-color-emphasis-600)'}}>
          Optional steps (BedpostX, shell extraction, ICV, BIDS/pyAFQ) are covered separately
          in <Link to="/docs/pipeline/overview">the pipeline overview</Link>.
        </p>
      </div>
    </section>
  );
}

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <div className={styles.heroInner}>
          <p className={styles.heroLabel}>Diffusion MRI Preprocessing</p>
          <Heading as="h1" className="hero__title">
            {siteConfig.title}
          </Heading>
          <p className="hero__subtitle">{siteConfig.tagline}</p>
          <div className={styles.buttons}>
            <Link className="button button--secondary button--lg" to="/docs/intro">
              Get Started
            </Link>
            <Link
              className="button button--outline button--lg"
              to="/docs/pipeline/overview"
              style={{color: 'white', borderColor: 'rgba(255,255,255,0.5)', marginLeft: '1rem'}}
            >
              View Pipeline
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

export default function Home(): ReactNode {
  return (
    <Layout
      title="Home"
      description="A comprehensive, open-source tutorial for diffusion tensor imaging preprocessing.">
      <HomepageHeader />
      <main>
        <section className={styles.features}>
          <div className="container">
            <div className="row" style={{gap: '1.5rem 0'}}>
              {FeatureList.map((props, idx) => (
                <Feature key={idx} {...props} />
              ))}
            </div>
          </div>
        </section>
        <PipelinePreview />
      </main>
    </Layout>
  );
}
