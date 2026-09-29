import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

const MANUAL_STEPS = [
  {num: 1, title: 'DICOM to NIfTI', tools: 'dcm2niix', link: '/docs/pipeline/dicom-to-nifti'},
  {num: 2, title: 'Skull Stripping', tools: 'ANTs', link: '/docs/pipeline/skull-stripping'},
  {num: 3, title: 'B0 Concatenation', tools: 'FSL', link: '/docs/pipeline/b0-concatenation'},
  {num: 4, title: 'TOPUP Distortion Correction', tools: 'FSL', link: '/docs/pipeline/topup'},
  {num: 5, title: 'Mean B0 Image', tools: 'FSL', link: '/docs/pipeline/mean-b0'},
  {num: 6, title: 'Brain Masking', tools: 'FSL', link: '/docs/pipeline/brain-masking'},
  {num: 7, title: 'Denoising & Gibbs Correction', tools: 'MRtrix3', link: '/docs/pipeline/denoising-gibbs'},
  {num: 8, title: 'Eddy Current Correction', tools: 'FSL', link: '/docs/pipeline/eddy'},
];

const SHARED_STEPS = [
  {num: 9, title: 'Tensor Fitting (DTIFIT)', tools: 'FSL', link: '/docs/pipeline/dtifit'},
  {num: 10, title: 'Registration (FLIRT)', tools: 'FSL', link: '/docs/pipeline/flirt-registration'},
  {num: 11, title: 'Response Function Estimation', tools: 'MRtrix3', link: '/docs/pipeline/response-functions'},
  {num: 12, title: 'Fiber Orientation Distributions', tools: 'MRtrix3', link: '/docs/pipeline/fod-estimation'},
];

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

function PipelinePreview() {
  const arrow = <div className="pipeline-explorer__arrow">&darr;</div>;
  return (
    <section className={styles.pipelineSection}>
      <div className="container">
        <Heading as="h2" className="text--center" style={{marginBottom: '0.75rem'}}>
          Pipeline
        </Heading>
        <p className={clsx('text--center', styles.sectionLede)}>
          Part A applies the corrections every diffusion dataset needs: susceptibility distortion,
          noise, Gibbs ringing, head motion, and eddy currents. It runs either as a single QSIPrep
          container or as eight separate steps. Part B fits the tensor, registers the anatomical
          image, and estimates the fiber orientation distributions that tractography reads.
        </p>

        <SectionLabel top="0">Part A — Core preprocessing · two routes to the same result</SectionLabel>
        <div className="row" style={{rowGap: '1rem', alignItems: 'flex-start'}}>
          <div className="col col--6">
            <div className="route-card">
              <p className="route-card__kicker">Route 1</p>
              <p className="route-card__title">QSIPrep</p>
              <p className="route-card__body">
                A BIDS app that runs the Part A corrections in one containerized command and
                writes a quality-control report per participant. It performs:
              </p>
              <ul className="route-card__list">
                {QSIPREP_COVERS.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <Link to="/docs/pipeline/qsiprep-route" className="route-card__link">
                QSIPrep route &rarr;
              </Link>
            </div>
          </div>
          <div className="col col--6">
            <div className="route-card">
              <p className="route-card__kicker">Route 2</p>
              <p className="route-card__title">Manual steps</p>
              <p className="route-card__body">
                The same corrections run individually with FSL, MRtrix3, and ANTs. Every parameter
                is exposed, and acquisitions QSIPrep does not support can be handled directly.
                These are the tools QSIPrep calls internally.
              </p>
              <div className="pipeline-explorer pipeline-explorer--compact">
                {MANUAL_STEPS.map((stage) => (
                  <Stage key={stage.num} {...stage} />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="text--center" style={{margin: '1.25rem 0'}}>{arrow}</div>

        <SectionLabel top="0">Part B — Tractography readiness · common to both routes</SectionLabel>
        <div className="pipeline-explorer pipeline-explorer--narrow">
          {SHARED_STEPS.map((stage) => (
            <div key={stage.num}>
              <Stage {...stage} />
              {arrow}
            </div>
          ))}
          <Stage
            num={<>&#10003;</>}
            title="Required outputs"
            tools="Verify the file set before tracking"
            link="/docs/pipeline/required-outputs"
          />
        </div>

        <p className={clsx('text--center', styles.sectionNote)}>
          BedpostX, shell extraction, intracranial volume, and BIDS conversion are documented
          separately. They are not part of the required path.
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
              Start here
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
      description="A practical guide to getting diffusion MRI data ready for tractography.">
      <HomepageHeader />
      <main>
        <PipelinePreview />
      </main>
    </Layout>
  );
}
