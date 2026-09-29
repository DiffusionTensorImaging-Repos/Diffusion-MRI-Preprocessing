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

type FeatureItem = {
  title: string;
  icon: ReactNode;
  description: ReactNode;
  link: string;
  linkText: string;
};

const iconProps = {
  width: 36,
  height: 36,
  viewBox: '0 0 32 32',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/* Diffusion tensor: an anisotropic ellipsoid with its principal axis. */
const TensorIcon = () => (
  <svg {...iconProps} aria-hidden="true">
    <ellipse cx="16" cy="16" rx="11.6" ry="6.4" transform="rotate(-33 16 16)" />
    <path d="M8.2 20.9 L23.8 11.1" />
    <path d="M21.3 10.2 L24.6 10.7 L24.1 14" />
    <path d="M10.7 21.8 L7.4 21.3 L7.9 18" />
  </svg>
);

/* Preprocessing: a corrected image volume feeding reconstructed streamlines. */
const VolumeToTractIcon = () => (
  <svg {...iconProps} aria-hidden="true">
    <rect x="2.5" y="9.5" width="11" height="13" rx="2.5" />
    <path d="M8 9.5v13M2.5 16h11" />
    <path d="M15.8 16h3.6" />
    <path d="M17.8 14.3 L19.6 16 L17.8 17.7" />
    <path d="M23 25.5 C23 16.5 28.8 16 28.8 6.5" />
    <path d="M26.2 25.5 C26.2 17.5 29.4 16.5 29.4 8" />
  </svg>
);

/* Data and tools: a stack of image slices you can pull down. */
const SliceStackIcon = () => (
  <svg {...iconProps} aria-hidden="true">
    <path d="M16 3 L27.5 8.3 L16 13.6 L4.5 8.3 Z" />
    <path d="M4.5 14.3 L16 19.6 L27.5 14.3" />
    <path d="M16 23 v6.3" />
    <path d="M13.3 26.6 L16 29.3 L18.7 26.6" />
  </svg>
);

const FeatureList: FeatureItem[] = [
  {
    title: 'Learn DTI Concepts',
    icon: <TensorIcon />,
    description: (
      <>
        Understand the physics of diffusion imaging, what FA, MD, and RD actually
        measure, and why each preprocessing step matters for your science.
      </>
    ),
    link: '/docs/foundations/what-is-dti',
    linkText: 'Foundations',
  },
  {
    title: 'Step-by-Step Pipeline',
    icon: <VolumeToTractIcon />,
    description: (
      <>
        Walk through each preprocessing stage with generalized, copy-paste-ready
        code, detailed explanations, and quality checks at every step.
      </>
    ),
    link: '/docs/pipeline/overview',
    linkText: 'Pipeline',
  },
  {
    title: 'Practice Data & Tools',
    icon: <SliceStackIcon />,
    description: (
      <>
        Download public DTI datasets to practice with, and find setup guides for
        FSL, MRtrix3, ANTs, and other tools used throughout the pipeline.
      </>
    ),
    link: '/docs/reference/practice-data',
    linkText: 'Practice data and tools',
  },
];

function Feature({title, icon, description, link, linkText}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <Link to={link} className="feature-card feature-card--link">
        <div className="text--center" style={{marginBottom: '1.25rem'}}>
          <span className="feature-card__icon">{icon}</span>
        </div>
        <div className="text--center padding-horiz--md">
          <Heading as="h3">{title}</Heading>
          <p>{description}</p>
          <span className="feature-card__cta">{linkText} &rarr;</span>
        </div>
      </Link>
    </div>
  );
}

function SectionLabel({children, top = '1.5rem'}: {children: ReactNode; top?: string}) {
  return (
    <p
      style={{
        margin: `${top} 0 0.75rem`,
        fontSize: '0.8rem',
        fontWeight: 600,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: 'var(--ifm-color-emphasis-600)',
      }}>
      {children}
    </p>
  );
}

function Stage({num, title, tools, link}: {num: ReactNode; title: string; tools: string; link: string}) {
  return (
    <Link to={link} className="pipeline-explorer__stage">
      <div className="pipeline-explorer__number">{num}</div>
      <div className="pipeline-explorer__content">
        <p className="pipeline-explorer__title">{title}</p>
        <p className="pipeline-explorer__tools">{tools}</p>
      </div>
    </Link>
  );
}

const QSIPREP_COVERS = [
  'DICOM to BIDS (dcm2niix)',
  'Skull stripping (SynthStrip)',
  'Denoising',
  'Gibbs correction (optional)',
  'TOPUP',
  'Eddy',
  'Brain mask',
  'QC report',
];

function PipelinePreview() {
  const partA = PIPELINE_STAGES.filter((s) => s.part === 'A');
  const partB = PIPELINE_STAGES.filter((s) => s.part === 'B');
  const arrow = <div className="pipeline-explorer__arrow">&darr;</div>;
  return (
    <section className={styles.pipelineSection}>
      <div className="container">
        <Heading as="h2" className="text--center" style={{marginBottom: '0.5rem'}}>
          From Scanner to Tractography-Ready
        </Heading>
        <p className="text--center" style={{marginBottom: '2rem', color: 'var(--ifm-color-emphasis-600)'}}>
          Part A corrects the raw data by one of two routes. Part B turns the corrected data
          into the files tract reconstruction reads.
        </p>

        <SectionLabel top="0">Part A — Core Preprocessing · one of two routes</SectionLabel>
        <div className="row" style={{rowGap: '1rem', alignItems: 'flex-start'}}>
          <div className="col col--6">
            <div className="route-card">
              <p className="route-card__kicker">Route 1</p>
              <p className="route-card__title">QSIPrep</p>
              <p className="route-card__body">
                One containerized run. BIDS in, corrected diffusion data out, with a QC report
                per participant. Covers everything in Route 2:
              </p>
              <ul className="route-card__list">
                {QSIPREP_COVERS.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <Link to="/docs/pipeline/qsiprep-route" className="route-card__link">
                Route 1: QSIPrep &rarr;
              </Link>
            </div>
          </div>
          <div className="col col--6">
            <div className="route-card">
              <p className="route-card__kicker">Route 2</p>
              <p className="route-card__title">Manual, eight steps</p>
              <p className="route-card__body">
                Each correction run by hand with FSL, MRtrix3, and ANTs. Full control over every
                parameter, and the reference for what Route 1 does inside the container.
              </p>
              <div className="pipeline-explorer pipeline-explorer--compact">
                {partA.map((stage) => (
                  <Stage key={stage.num} {...stage} />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="text--center" style={{margin: '1rem 0'}}>{arrow}</div>

        <SectionLabel top="0">Part B — Tractography Readiness · both routes continue here</SectionLabel>
        <div className="pipeline-explorer pipeline-explorer--narrow">
          {partB.map((stage) => (
            <div key={stage.num}>
              <Stage {...stage} />
              {arrow}
            </div>
          ))}
          <Stage num={<>&#10003;</>} title="Outputs for Tractography" tools="Verify outputs before tracking" link="/docs/pipeline/required-outputs" />
        </div>

        <p className="text--center" style={{marginTop: '2rem', color: 'var(--ifm-color-emphasis-600)'}}>
          Optional and alternative steps (BedpostX for the FSL tractography route, shell extraction, ICV, BIDS/pyAFQ) are covered separately
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
          <Heading as="h1" className="hero__title">
            {siteConfig.title}
          </Heading>
          <p className="hero__subtitle">{siteConfig.tagline}</p>
          <div className={styles.buttons}>
            <Link className="button button--secondary button--lg" to="/docs/intro">
              Get Started
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
