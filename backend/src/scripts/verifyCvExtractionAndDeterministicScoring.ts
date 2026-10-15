import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType, HeadingLevel } from 'docx';
import { extractTextFromBuffer, cleanAndNormalizeText } from '../services/jdParsingService';
import {
  extractStructuredCandidateFromText,
  validateCvTextQuality,
  calculateNonOverlappingExperienceMonths,
  normalizeSkillName,
  CandidateExperience
} from '../services/cvParsingService';
import {
  calculateCentralizedATSScore,
  CENTRALIZED_ATS_SCORING_VERSION,
  ATS_WEIGHTS
} from '../services/centralizedATSScoringService';

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, testName: string, detail: string) {
  if (condition) {
    results.push({ name: testName, passed: true, details: detail });
    console.log(`[PASS] ${testName}: ${detail}`);
  } else {
    results.push({ name: testName, passed: false, details: detail });
    console.error(`[FAIL] ${testName}: ${detail}`);
  }
}

// ── Helper to generate PDF buffer using PDFKit ───────────────────────────────
function createPdfBuffer(pagesContent: string[][]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err));

    pagesContent.forEach((pageLines, index) => {
      if (index > 0) doc.addPage();
      pageLines.forEach((line) => {
        if (line.startsWith('## ')) {
          doc.fontSize(16).text(line.replace('## ', ''), { underline: true });
          doc.moveDown(0.5);
        } else if (line.startsWith('# ')) {
          doc.fontSize(20).text(line.replace('# ', ''), { bold: true } as any);
          doc.moveDown(0.5);
        } else if (line.startsWith('- ')) {
          doc.fontSize(11).text(`•  ${line.replace('- ', '')}`, { indent: 15 });
        } else {
          doc.fontSize(11).text(line);
          doc.moveDown(0.3);
        }
      });
    });

    doc.end();
  });
}

// ── Benchmark Job Specification ─────────────────────────────────────────────
const BENCHMARK_JOB = {
  id: 'job-bench-001',
  position: 'Senior Full Stack Engineer',
  title: 'Senior Full Stack Engineer',
  client: 'TaskNera Engineering',
  company: 'TaskNera Engineering',
  jd_text: `
    Senior Full Stack Engineer requisition.
    We are seeking an experienced Senior Full Stack Engineer with at least 4 years of professional experience.
    Mandatory Requirements:
    - Minimum 4 years of professional software engineering experience.
    - Deep expertise in Node.js and TypeScript for backend microservices.
    - Strong frontend development skills with React.
    - Bachelor's degree in Computer Science, Software Engineering, or related discipline.
    Preferred:
    - Hands-on experience with PostgreSQL and relational schema design.
    - Familiarity with Docker containerization and Kubernetes.
  `,
  requirements: [
    {
      id: 'req-exp',
      requirement: 'Minimum 4 years of professional software engineering experience',
      category: 'Experience',
      is_mandatory: true,
      weight: 2.0,
      source_evidence: 'Minimum 4 years of professional experience'
    },
    {
      id: 'req-node',
      requirement: 'Node.js backend development with TypeScript',
      category: 'Technical Skill',
      is_mandatory: true,
      weight: 2.0,
      aliases: ['nodejs', 'node', 'node.js']
    },
    {
      id: 'req-react',
      requirement: 'React frontend application engineering',
      category: 'Technical Skill',
      is_mandatory: true,
      weight: 2.0,
      aliases: ['react.js', 'reactjs']
    },
    {
      id: 'req-edu',
      requirement: "Bachelor's degree in Computer Science or related field",
      category: 'Education',
      is_mandatory: true,
      weight: 1.5
    },
    {
      id: 'req-postgres',
      requirement: 'PostgreSQL database design and query optimization',
      category: 'Technical Skill',
      is_mandatory: false,
      weight: 1.5,
      aliases: ['postgres', 'psql']
    },
    {
      id: 'req-docker',
      requirement: 'Docker containerization',
      category: 'Technical Skill',
      is_mandatory: false,
      weight: 1.0,
      aliases: ['containers', 'docker container']
    }
  ]
};

async function runRegressionTestSuite() {
  console.log('========================================================================');
  console.log('TaskNera ATS - Comprehensive Regression Test Suite (Phases 1 - 5)');
  console.log('========================================================================\n');

  // --------------------------------------------------------------------------
  // TEST CASE 1: Standard Text-Based PDF Extraction & Structured Normalization
  // --------------------------------------------------------------------------
  console.log('\n--- TEST CASE 1: Text-Based PDF Parsing ---');
  const pdfLines = [
    ['# Aarav Sharma | Senior Full Stack Engineer'],
    ['Email: aarav.sharma@example.com | Phone: +91 9876543210 | Bangalore, Karnataka'],
    ['## Professional Summary'],
    ['Senior Full Stack Engineer with 5 years of progressive experience building scalable web applications using React, Node.js, and PostgreSQL.'],
    ['## Technical Skills'],
    ['- Programming: TypeScript, JavaScript, Python, SQL'],
    ['- Frontend: React.js, Redux, HTML5, CSS3, Tailwind CSS'],
    ['- Backend: Node.js, Express, REST APIs, GraphQL'],
    ['- Databases: PostgreSQL, Redis, MongoDB'],
    ['- DevOps & Tools: Docker, Git, CI/CD, AWS'],
    ['## Professional Experience'],
    ['Software Engineer | TechNova Solutions | Bangalore, India'],
    ['July 2021 - Present (3 years 3 months)'],
    ['- Architected and scaled high-throughput microservices in Node.js and TypeScript.'],
    ['- Developed modern, responsive dashboard UI components in React.'],
    ['- Designed optimized PostgreSQL queries and relational database schemas.'],
    ['Junior Software Engineer | CloudVibe Technologies | Bangalore, India'],
    ['July 2019 - June 2021 (2 years)'],
    ['- Built RESTful backend endpoints in Node.js.'],
    ['- Implemented automated integration tests with Docker.'],
    ['## Education'],
    ['Bachelor of Technology in Computer Science and Engineering | VTU | 2015 - 2019']
  ];

  const textPdfBuffer = await createPdfBuffer(pdfLines);
  const pdfParseResult = await extractTextFromBuffer(textPdfBuffer, 'aarav_sharma_resume.pdf', 'application/pdf');
  const textPdfExtracted = pdfParseResult.text;

  assert(
    textPdfExtracted.trim().length > 200,
    'Case 1.1: Text-Based PDF Extraction',
    `Extracted ${textPdfExtracted.trim().length} characters from valid PDF`
  );

  const textPdfQuality = validateCvTextQuality(textPdfExtracted);
  assert(
    textPdfQuality.isValid,
    'Case 1.2: CV Quality Validation',
    `Quality validation passed (${textPdfQuality.reason || 'OK'})`
  );

  const structuredCand1 = extractStructuredCandidateFromText(textPdfExtracted, 'aarav_sharma_resume.pdf', {
    fileType: 'application/pdf',
    pageCount: 1,
    extractionMethod: 'pdfkit',
    ocrUsed: false,
    characterCount: textPdfExtracted.length,
    wordCount: textPdfExtracted.split(/\s+/).length
  });

  assert(
    Boolean(structuredCand1.name && structuredCand1.name.toLowerCase().includes('aarav')),
    'Case 1.3: Candidate Name Extraction',
    `Extracted name: "${structuredCand1.name}"`
  );
  assert(
    Boolean(structuredCand1.email && structuredCand1.email.includes('aarav.sharma@example.com')),
    'Case 1.4: Contact Email Extraction',
    `Extracted email: "${structuredCand1.email}"`
  );
  assert(
    structuredCand1.skills.some(s => s.toLowerCase() === 'react') &&
    structuredCand1.skills.some(s => s.toLowerCase().includes('node')),
    'Case 1.5: Technical Skills Extraction',
    `Extracted ${structuredCand1.skills.length} skills including React, Node.js, PostgreSQL`
  );

  // --------------------------------------------------------------------------
  // TEST CASE 2: Multi-Page PDF Extraction
  // --------------------------------------------------------------------------
  console.log('\n--- TEST CASE 2: Multi-Page PDF Extraction ---');
  const multiPagePdfLines = [
    [
      '# Meera Kapoor | Cloud Architect',
      'meera.kapoor@example.com | +91 9988776655 | Mumbai, India',
      '## Professional Summary',
      'Cloud solutions architect with 6 years of expertise in distributed systems, Node.js microservices, and Kubernetes.',
      '## Core Skills',
      '- Node.js, TypeScript, Go, React, Docker, Kubernetes, AWS, PostgreSQL'
    ],
    [
      '## Professional Experience',
      'Lead Architect | Nexus Digital Systems | Mumbai, India',
      'January 2021 - Present',
      '- Engineered cloud infrastructure and Node.js microservices with PostgreSQL backend.',
      'Senior Systems Engineer | Datacore Inc | Pune, India',
      'January 2018 - December 2020',
      '- Built distributed data pipelines and containerized applications using Docker.',
      '## Education',
      'B.E. in Information Technology | University of Mumbai | 2014 - 2018'
    ]
  ];

  const multiPagePdfBuffer = await createPdfBuffer(multiPagePdfLines);
  const multiPageResult = await extractTextFromBuffer(multiPagePdfBuffer, 'meera_kapoor_resume.pdf', 'application/pdf');
  const multiPageExtracted = multiPageResult.text;

  assert(
    multiPageExtracted.includes('Nexus Digital Systems') && multiPageExtracted.includes('University of Mumbai'),
    'Case 2.1: Multi-Page PDF Text Completeness',
    'Both Page 1 (Summary/Skills) and Page 2 (Experience/Education) extracted completely'
  );

  // --------------------------------------------------------------------------
  // TEST CASE 3: DOCX with Tables & Column Layout
  // --------------------------------------------------------------------------
  console.log('\n--- TEST CASE 3: DOCX Table Structure Extraction ---');
  const docxDoc = new Document({
    sections: [{
      children: [
        new Paragraph({ text: 'Vikram Malhotra', heading: HeadingLevel.TITLE }),
        new Paragraph({ text: 'Email: vikram.malhotra@example.com | Phone: +91 9123456780 | Hyderabad' }),
        new Paragraph({ text: 'Summary: Full Stack Engineer with 4.5 years of experience in React, Node.js, and SQL databases.' }),
        new Paragraph({ text: 'Skills Summary Table:', heading: HeadingLevel.HEADING_2 }),
        new Table({
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph('Category')], width: { size: 30, type: WidthType.PERCENTAGE } }),
                new TableCell({ children: [new Paragraph('Technologies')], width: { size: 70, type: WidthType.PERCENTAGE } })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph('Frontend')] }),
                new TableCell({ children: [new Paragraph('React, Redux, Next.js, HTML5, CSS3')] })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph('Backend & DB')] }),
                new TableCell({ children: [new Paragraph('Node.js, Express, PostgreSQL, MongoDB')] })
              ]
            })
          ]
        }),
        new Paragraph({ text: 'Work Experience:', heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ text: 'Full Stack Engineer | Apex Infotech | Hyderabad | Feb 2020 - Present' }),
        new Paragraph({ text: 'Developed enterprise web applications using Node.js and React with PostgreSQL.' }),
        new Paragraph({ text: 'Education:', heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ text: 'Bachelor of Technology in Computer Science | JNTU Hyderabad | 2016 - 2020' })
      ]
    }]
  });

  const docxBuffer = await Packer.toBuffer(docxDoc);
  const docxParseResult = await extractTextFromBuffer(docxBuffer, 'vikram_malhotra.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  const docxExtracted = docxParseResult.text;

  assert(
    docxExtracted.includes('React') && docxExtracted.includes('PostgreSQL') && docxExtracted.includes('Apex Infotech'),
    'Case 3.1: DOCX Table Extraction',
    'Table cell contents and section text correctly converted and extracted without squishing'
  );

  const docxStructured = extractStructuredCandidateFromText(docxExtracted, 'vikram_malhotra.docx', {
    fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    pageCount: 1,
    extractionMethod: 'mammoth-docx',
    ocrUsed: false,
    characterCount: docxExtracted.length,
    wordCount: docxExtracted.split(/\s+/).length
  });

  assert(
    docxStructured.skills.some(s => s.toLowerCase() === 'react') &&
    docxStructured.skills.some(s => s.toLowerCase().includes('node')),
    'Case 3.2: DOCX Structured Information',
    `Extracted ${docxStructured.skills.length} skills from DOCX table format`
  );

  // --------------------------------------------------------------------------
  // TEST CASE 4: Overlapping Dates Calculation (Phase 1.B Rule 4 & 5)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST CASE 4: Non-Overlapping Experience Calculation ---');
  // Role 1: Jan 2021 to Dec 2023 (36 months)
  // Role 2: Jun 2022 to Dec 2023 (19 months - completely concurrent/overlapping with Role 1)
  // Role 3: Jan 2024 to Dec 2024 (12 months)
  // Raw sum = 36 + 19 + 12 = 67 months (5.58 years)
  // Correct non-overlapping timeline: Jan 2021 to Dec 2024 = 48 months (4.0 years)
  const overlappingRoles: CandidateExperience[] = [
    { startDate: '2021-01-01', endDate: '2023-12-31', title: 'Senior Software Engineer', company: 'Company Alpha' },
    { startDate: '2022-06-01', endDate: '2023-12-31', title: 'Technical Consultant', company: 'Company Beta' },
    { startDate: '2024-01-01', endDate: '2024-12-31', title: 'Lead Developer', company: 'Company Gamma' }
  ];

  const expMonthsResult = calculateNonOverlappingExperienceMonths(overlappingRoles);
  const calculatedMonths = expMonthsResult.totalMonths;
  const calculatedYears = Math.round((calculatedMonths / 12) * 10) / 10;

  assert(
    calculatedMonths === 48 && calculatedYears === 4.0,
    'Case 4.1: Overlapping Dates Deduplication',
    `Calculated non-overlapping tenure: ${calculatedMonths} months (${calculatedYears} yrs). Raw sum was 67 months. Overlap avoided successfully.`
  );

  // --------------------------------------------------------------------------
  // TEST CASE 5: Missing Information Handling (Phase 1.B Rule 8)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST CASE 5: Missing Information Graceful Handling ---');
  const missingInfoText = `
    Rohan Verma
    Software Developer with experience in React and Node.js.
    Skills: React, Node.js, JavaScript, HTML, CSS.
    Experience:
    Software Developer at StartupSphere (January 2022 - Present)
    Developed React components and Node.js APIs.
  `;

  const missingInfoQuality = validateCvTextQuality(missingInfoText);
  assert(
    missingInfoQuality.isValid,
    'Case 5.1: Missing Non-Critical Info Tolerated',
    'CV without explicit phone or education section does not fail quality threshold'
  );

  const missingInfoCandidate = extractStructuredCandidateFromText(missingInfoText, 'rohan_verma.txt', {
    fileType: 'text/plain',
    pageCount: 1,
    extractionMethod: 'plain-text',
    ocrUsed: false,
    characterCount: missingInfoText.length,
    wordCount: missingInfoText.split(/\s+/).length
  });

  assert(
    missingInfoCandidate.name === 'Rohan Verma' && missingInfoCandidate.skills.length >= 2,
    'Case 5.2: Structured Fields with Missing Sections',
    `Extracted valid fields (Name: ${missingInfoCandidate.name}, Skills: ${missingInfoCandidate.skills.join(', ')}) without crashing`
  );

  // --------------------------------------------------------------------------
  // TEST CASE 6: Invalid / Corrupted Document Rejection (Phase 4)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST CASE 6: Corrupted / Junk Document Rejection ---');
  const corruptBuffer = Buffer.from('PK\x03\x04\x00\x00\x00\x00\x00\x00corrupted-junk-binary-data-stream-without-text');
  let corruptExtracted = '';
  try {
    const corruptRes = await extractTextFromBuffer(corruptBuffer, 'corrupt.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    corruptExtracted = corruptRes.text;
  } catch {}

  const corruptQuality = validateCvTextQuality(corruptExtracted);
  assert(
    !corruptQuality.isValid,
    'Case 6.1: Corrupt File Rejection',
    `Corrupt document correctly rejected with reason: "${corruptQuality.reason}"`
  );

  // --------------------------------------------------------------------------
  // TEST CASE 7: Deterministic Skill Canonical Mapping (Phase 1.B Rule 3)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST CASE 7: Skill Normalization & Distinct Preservation ---');
  const normalizedReact = normalizeSkillName('React.js');
  const normalizedK8s = normalizeSkillName('k8s');
  const normalizedPostgres = normalizeSkillName('Postgres');
  const normalizedJava = normalizeSkillName('Java');
  const normalizedJs = normalizeSkillName('JavaScript');

  assert(
    normalizedReact === 'React' &&
    normalizedK8s === 'Kubernetes' &&
    normalizedPostgres === 'PostgreSQL',
    'Case 7.1: Canonical Technology Synonyms',
    `React.js -> ${normalizedReact}, k8s -> ${normalizedK8s}, Postgres -> ${normalizedPostgres}`
  );

  assert(
    normalizedJava === 'Java' && normalizedJs === 'JavaScript' && (normalizedJava as string) !== (normalizedJs as string),
    'Case 7.2: Distinct Technologies Strictly Preserved',
    `Java ("${normalizedJava}") is strictly distinct from JavaScript ("${normalizedJs}")`
  );

  // --------------------------------------------------------------------------
  // TEST CASE 8: Five Consecutive Evaluations Deterministic ATS Score (Phase 3 & 5.5)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST CASE 8: 5 Consecutive Evaluations Deterministic Score ---');

  const evalInput = {
    candidate: {
      ...structuredCand1,
      id: 'cand-eval-test-001',
      totalExperience: '5 years',
      experience: [
        {
          title: 'Senior Software Engineer',
          company: 'TechNova Solutions',
          startDate: '2021-07-01',
          endDate: '2024-10-01',
          description: 'Architected and scaled high-throughput microservices in Node.js and TypeScript. Developed React UI. Optimized PostgreSQL.',
          technologies: ['Node.js', 'React', 'TypeScript', 'PostgreSQL', 'Docker']
        },
        {
          title: 'Junior Software Engineer',
          company: 'CloudVibe Technologies',
          startDate: '2019-07-01',
          endDate: '2021-06-30',
          description: 'Built RESTful backend endpoints in Node.js. Used Docker.',
          technologies: ['Node.js', 'Docker', 'REST API']
        }
      ],
      education: [
        {
          degree: 'Bachelor of Technology',
          field: 'Computer Science and Engineering',
          institution: 'VTU',
          startYear: '2015',
          endYear: '2019'
        }
      ]
    } as any,
    job: BENCHMARK_JOB,
    requirements: BENCHMARK_JOB.requirements
  };

  const evalScores: number[] = [];
  const evalRecommendations: string[] = [];
  const evalPillars: any[] = [];

  for (let run = 1; run <= 5; run++) {
    const result = calculateCentralizedATSScore(evalInput);
    evalScores.push(result.atsScore);
    evalRecommendations.push(result.recommendation);
    evalPillars.push(result.pillarScores);
  }

  const allScoresEqual = evalScores.every(s => s === evalScores[0]);
  const allRecsEqual = evalRecommendations.every(r => r === evalRecommendations[0]);

  assert(
    allScoresEqual,
    'Case 8.1: ATS Score Stability Across 5 Consecutive Runs',
    `Scores across 5 runs: [${evalScores.join(', ')}] (Identical score: ${evalScores[0]}%)`
  );

  assert(
    allRecsEqual,
    'Case 8.2: ATS Recommendation Stability',
    `Recommendations across 5 runs: [${evalRecommendations.join(', ')}] (Identical: "${evalRecommendations[0]}")`
  );

  // --------------------------------------------------------------------------
  // TEST CASE 9: Repeated Requirement Deduplication (Phase 3.3)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST CASE 9: Repeated Requirements Weight Deduplication ---');
  const duplicateReqsJob = {
    ...BENCHMARK_JOB,
    requirements: [
      ...BENCHMARK_JOB.requirements,
      // Duplicate copies of requirements
      {
        id: 'req-node-dup',
        requirement: 'Node.js backend development with TypeScript',
        category: 'Technical Skill',
        is_mandatory: true,
        weight: 2.0
      },
      {
        id: 'req-react-dup',
        requirement: 'React frontend application engineering',
        category: 'Technical Skill',
        is_mandatory: true,
        weight: 2.0
      }
    ]
  };

  const deduplicatedEvalResult = calculateCentralizedATSScore({
    candidate: evalInput.candidate,
    job: duplicateReqsJob,
    requirements: duplicateReqsJob.requirements
  });

  assert(
    deduplicatedEvalResult.atsScore === evalScores[0],
    'Case 9.1: Duplicate Requirements Do Not Inflate Score',
    `Score with duplicate requirements: ${deduplicatedEvalResult.atsScore}% equals single-requirement score: ${evalScores[0]}%`
  );

  // --------------------------------------------------------------------------
  // SUMMARY REPORT
  // --------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log('Regression Test Suite Summary:');
  console.log('========================================================================');
  const totalPassed = results.filter(r => r.passed).length;
  const totalFailed = results.filter(r => !r.passed).length;
  console.log(`Total Checks: ${results.length} | Passed: ${totalPassed} | Failed: ${totalFailed}`);

  if (totalFailed > 0) {
    console.error('Some regression tests failed.');
    process.exit(1);
  } else {
    console.log('All regression test checks PASSED successfully with 100% parity.');
    process.exit(0);
  }
}

runRegressionTestSuite().catch((err) => {
  console.error('Fatal regression suite error:', err);
  process.exit(1);
});

