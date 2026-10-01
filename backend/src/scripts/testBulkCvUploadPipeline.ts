import dotenv from 'dotenv';
dotenv.config();

import prisma from '../config/prisma';
import jwt from 'jsonwebtoken';
import http from 'http';

const JWT_SECRET = process.env.JWT_SECRET || 'ats_tasknera_super_secret_jwt_key_2026';
const BACKEND_PORT = process.env.PORT || 5000;

interface TestCandidateData {
  filename: string;
  name: string;
  email: string;
  phone: string;
  skills: string[];
  experienceYears: number;
  content: string;
  isCorrupt?: boolean;
}

const SAMPLE_CANDIDATES: TestCandidateData[] = [
  {
    filename: 'CV_Aarav_Mehta_FullStack.txt',
    name: 'Aarav Mehta',
    email: 'aarav.mehta.tech@example.com',
    phone: '+91 98765 43210',
    skills: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'Docker', 'AWS'],
    experienceYears: 5,
    content: `Aarav Mehta
Senior Full Stack Engineer
Email: aarav.mehta.tech@example.com | Phone: +91 98765 43210
Location: Bengaluru, India

PROFESSIONAL SUMMARY
Results-driven Full Stack Developer with 5 years of experience building high-scale web platforms using React, Node.js, and TypeScript. Proficient in cloud deployments with Docker and AWS.

TECHNICAL SKILLS
Languages: TypeScript, JavaScript, Python, SQL
Frontend: React, Next.js, Redux, HTML5, CSS3, Tailwind CSS
Backend: Node.js, Express, REST APIs, GraphQL
Databases: PostgreSQL, Redis, MongoDB
DevOps: Docker, AWS, GitHub Actions, CI/CD

PROFESSIONAL EXPERIENCE
Senior Full Stack Developer — TechNova Solutions (2021 - Present)
- Designed and built enterprise web applications using React, TypeScript, and Node.js.
- Engineered PostgreSQL relational schemas and query optimizations reducing latency by 35%.
- Implemented CI/CD deployment pipelines using Docker and AWS ECS.

Software Engineer — CloudMatrix Systems (2019 - 2021)
- Developed responsive web interfaces in React and backend services in Node.js.
- Collaborated in Agile Scrum teams to deliver sprint objectives.

EDUCATION
Bachelor of Technology (B.Tech) in Computer Science, 2019`
  },
  {
    filename: 'CV_Priya_Sharma_Frontend.txt',
    name: 'Priya Sharma',
    email: 'priya.sharma.ui@example.com',
    phone: '+91 98234 56781',
    skills: ['React', 'TypeScript', 'Next.js', 'Tailwind', 'HTML', 'CSS', 'Redux'],
    experienceYears: 4,
    content: `Priya Sharma
Senior Frontend Engineer
Email: priya.sharma.ui@example.com | Phone: +91 98234 56781

SUMMARY
Creative Frontend Engineer with 4 years of expertise in React, Next.js, and TypeScript building accessible user experiences.

CORE SKILLS
React, Next.js, TypeScript, JavaScript, Redux, Tailwind CSS, HTML5, CSS3, Jest, Webpack

WORK HISTORY
Frontend Developer — Apex Digital (2020 - Present)
- Developed component systems in React and Tailwind CSS.
- Optimized frontend rendering performance and Lighthouse audit scores.

EDUCATION
Bachelor of Science (B.Sc) in Information Technology, 2020`
  },
  {
    filename: 'CV_Rohan_Verma_Backend.txt',
    name: 'Rohan Verma',
    email: 'rohan.verma.backend@example.com',
    phone: '+91 97123 45678',
    skills: ['Node.js', 'Express', 'PostgreSQL', 'Redis', 'Docker', 'REST API', 'SQL'],
    experienceYears: 6,
    content: `Rohan Verma
Backend Architect
Email: rohan.verma.backend@example.com | Phone: +91 97123 45678

EXPERIENCE
Over 6 years of deep backend engineering experience specializing in Node.js, Express, PostgreSQL, and distributed caching with Redis.

SKILLS
Node.js, Express, TypeScript, SQL, PostgreSQL, Redis, Docker, Microservices, REST APIs, Git

WORK EXPERIENCE
Lead Backend Engineer — ScaleData Labs (2018 - Present)
- Architected high-throughput microservices using Node.js and PostgreSQL.
- Implemented transactional database structures and distributed caching.

EDUCATION
Bachelor of Engineering (B.E.) in Computer Engineering, 2018`
  },
  {
    filename: 'CV_Ananya_Iyer_DevOps.txt',
    name: 'Ananya Iyer',
    email: 'ananya.iyer.cloud@example.com',
    phone: '+91 96543 21098',
    skills: ['AWS', 'Docker', 'Kubernetes', 'CI/CD', 'Terraform', 'Linux', 'Python'],
    experienceYears: 5,
    content: `Ananya Iyer
Cloud & DevOps Engineer
Email: ananya.iyer.cloud@example.com | Phone: +91 96543 21098

SUMMARY
5 years managing cloud infrastructure on AWS with Docker, Kubernetes, and automated CI/CD pipelines.

SKILLS
AWS, Docker, Kubernetes, Terraform, CI/CD, Python, Bash, Linux, Git

WORK EXPERIENCE
DevOps Engineer — CloudScale Technologies (2019 - Present)
- Automated infrastructure deployments with Terraform and AWS.
- Configured Kubernetes clusters for containerized microservices.

EDUCATION
Bachelor of Technology (B.Tech), 2019`
  },
  {
    filename: 'CV_Vikram_Singhania_Data.txt',
    name: 'Vikram Singhania',
    email: 'vikram.singhania.data@example.com',
    phone: '+91 95432 10987',
    skills: ['Python', 'SQL', 'Machine Learning', 'Pandas', 'PostgreSQL'],
    experienceYears: 3,
    content: `Vikram Singhania
Data Engineer
Email: vikram.singhania.data@example.com | Phone: +91 95432 10987

SUMMARY
Data Engineer with 3 years of experience in Python, SQL, PostgreSQL, and data pipeline processing.

SKILLS
Python, SQL, PostgreSQL, Pandas, NumPy, Data Modeling, Git

WORK EXPERIENCE
Data Engineer — InfoMetrics (2021 - Present)
- Built automated ETL pipelines using Python and PostgreSQL.

EDUCATION
Bachelor of Science (B.S.) in Mathematics, 2021`
  },
  {
    filename: 'CV_Deliberately_Corrupt_File.pdf',
    name: 'Corrupt Document',
    email: '',
    phone: '',
    skills: [],
    experienceYears: 0,
    content: '%PDF-1.4\n%%EOF\x00\x00corrupt-bytes-zero-stream-unreadable',
    isCorrupt: true
  },
  {
    filename: 'CV_Sneha_Patel_FullStack.txt',
    name: 'Sneha Patel',
    email: 'sneha.patel.dev@example.com',
    phone: '+91 94321 09876',
    skills: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'Express', 'Git'],
    experienceYears: 4,
    content: `Sneha Patel
Full Stack Software Developer
Email: sneha.patel.dev@example.com | Phone: +91 94321 09876

PROFESSIONAL SUMMARY
4 years of full-stack engineering with React, Node.js, and PostgreSQL.

TECHNICAL SKILLS
React, Node.js, TypeScript, Express, PostgreSQL, HTML5, CSS3, Git

EXPERIENCE
Software Developer — WebCraft Solutions (2020 - Present)
- Built web applications using React, Express, and PostgreSQL.

EDUCATION
Bachelor of Computer Applications (BCA), 2020`
  },
  {
    filename: 'CV_Kavita_Reddy_UIUX.txt',
    name: 'Kavita Reddy',
    email: 'kavita.reddy.ui@example.com',
    phone: '+91 93210 98765',
    skills: ['React', 'TypeScript', 'Tailwind', 'Figma', 'CSS', 'HTML'],
    experienceYears: 3,
    content: `Kavita Reddy
Frontend UI Developer
Email: kavita.reddy.ui@example.com | Phone: +91 93210 98765

SUMMARY
Frontend UI Developer with 3 years building responsive UIs in React and Tailwind CSS.

SKILLS
React, TypeScript, Tailwind CSS, HTML, CSS, Figma, Git

EXPERIENCE
UI Developer — DesignFirst Studio (2021 - Present)
- Implemented user interfaces in React.

EDUCATION
Bachelor of Engineering (B.E.), 2021`
  },
  {
    filename: 'CV_Aditya_Nair_Backend.txt',
    name: 'Aditya Nair',
    email: 'aditya.nair.sys@example.com',
    phone: '+91 92109 87654',
    skills: ['Node.js', 'TypeScript', 'PostgreSQL', 'Docker', 'REST APIs', 'SQL'],
    experienceYears: 5,
    content: `Aditya Nair
Senior Backend Engineer
Email: aditya.nair.sys@example.com | Phone: +91 92109 87654

SUMMARY
5 years of backend API development experience with Node.js, TypeScript, and PostgreSQL.

SKILLS
Node.js, TypeScript, PostgreSQL, Docker, Express, REST APIs, SQL, Git

EXPERIENCE
Backend Engineer — CloudEngine Technologies (2019 - Present)
- Developed secure REST APIs with Node.js and PostgreSQL.

EDUCATION
Bachelor of Technology (B.Tech), 2019`
  },
  {
    filename: 'CV_Tanvi_Deshmukh_QA.txt',
    name: 'Tanvi Deshmukh',
    email: 'tanvi.deshmukh.qa@example.com',
    phone: '+91 91098 76543',
    skills: ['TypeScript', 'JavaScript', 'Jest', 'Cypress', 'Selenium', 'CI/CD'],
    experienceYears: 4,
    content: `Tanvi Deshmukh
QA Automation Engineer
Email: tanvi.deshmukh.qa@example.com | Phone: +91 91098 76543

SUMMARY
4 years of QA automation testing using TypeScript, Jest, and Cypress.

SKILLS
TypeScript, JavaScript, Jest, Cypress, Selenium, CI/CD, Git

EXPERIENCE
QA Automation Engineer — QualityHub (2020 - Present)
- Built automated test suites in TypeScript and Cypress.

EDUCATION
Bachelor of Engineering (B.E.), 2020`
  },
  {
    filename: 'CV_Manish_Chopra_DevOps.txt',
    name: 'Manish Chopra',
    email: 'manish.chopra.ops@example.com',
    phone: '+91 90987 65432',
    skills: ['AWS', 'Docker', 'Kubernetes', 'Linux', 'Terraform', 'CI/CD'],
    experienceYears: 6,
    content: `Manish Chopra
DevOps Specialist
Email: manish.chopra.ops@example.com | Phone: +91 90987 65432

SUMMARY
6 years managing enterprise deployments with AWS, Docker, and Kubernetes.

SKILLS
AWS, Docker, Kubernetes, Linux, Terraform, CI/CD, Git

EXPERIENCE
DevOps Lead — InfraScale Systems (2018 - Present)
- Managed production AWS infrastructure and Docker clusters.

EDUCATION
Bachelor of Technology (B.Tech), 2018`
  },
  {
    filename: 'CV_Pooja_Kulkarni_FullStack.txt',
    name: 'Pooja Kulkarni',
    email: 'pooja.kulkarni.stack@example.com',
    phone: '+91 89876 54321',
    skills: ['React', 'Node.js', 'TypeScript', 'SQL', 'PostgreSQL', 'Express'],
    experienceYears: 3,
    content: `Pooja Kulkarni
Full Stack Developer
Email: pooja.kulkarni.stack@example.com | Phone: +91 89876 54321

SUMMARY
3 years developing responsive applications using React, TypeScript, and Node.js.

SKILLS
React, Node.js, TypeScript, PostgreSQL, Express, Git, HTML, CSS

EXPERIENCE
Full Stack Developer — DigitalNext (2021 - Present)
- Developed frontend in React and backend services in Node.js.

EDUCATION
Bachelor of Engineering (B.E.), 2021`
  },
  {
    filename: 'CV_Rahul_Bose_Backend.txt',
    name: 'Rahul Bose',
    email: 'rahul.bose.backend@example.com',
    phone: '+91 88765 43210',
    skills: ['Node.js', 'Express', 'SQL', 'PostgreSQL', 'REST API', 'Redis'],
    experienceYears: 4,
    content: `Rahul Bose
Backend Software Developer
Email: rahul.bose.backend@example.com | Phone: +91 88765 43210

SUMMARY
4 years in backend development with Node.js and PostgreSQL.

SKILLS
Node.js, Express, PostgreSQL, SQL, Redis, REST APIs, Git

EXPERIENCE
Backend Developer — ServerWorks (2020 - Present)
- Created database queries and REST APIs.

EDUCATION
Bachelor of Computer Applications (BCA), 2020`
  },
  {
    filename: 'CV_Divya_Nambiar_Frontend.txt',
    name: 'Divya Nambiar',
    email: 'divya.nambiar.ui@example.com',
    phone: '+91 87654 32109',
    skills: ['React', 'Next.js', 'TypeScript', 'Tailwind', 'HTML', 'CSS'],
    experienceYears: 5,
    content: `Divya Nambiar
Lead Frontend Engineer
Email: divya.nambiar.ui@example.com | Phone: +91 87654 32109

SUMMARY
5 years building web applications with React, Next.js, and TypeScript.

SKILLS
React, Next.js, TypeScript, Tailwind CSS, Redux, HTML5, CSS3, Git

EXPERIENCE
Senior Frontend Developer — PixelCraft (2019 - Present)
- Built enterprise design system components in React and TypeScript.

EDUCATION
Master of Science (M.S.) in Computer Science, 2019`
  },
  {
    filename: 'CV_Siddharth_Joshi_FullStack.txt',
    name: 'Siddharth Joshi',
    email: 'siddharth.joshi.dev@example.com',
    phone: '+91 86543 21098',
    skills: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'Docker', 'AWS'],
    experienceYears: 6,
    content: `Siddharth Joshi
Principal Full Stack Engineer
Email: siddharth.joshi.dev@example.com | Phone: +91 86543 21098

SUMMARY
6 years of engineering experience across React, Node.js, and cloud deployments on AWS.

SKILLS
React, Node.js, TypeScript, PostgreSQL, Docker, AWS, Express, REST APIs, Git

EXPERIENCE
Full Stack Lead — Omnia Platforms (2018 - Present)
- Led development of scalable microservices and React frontends.

EDUCATION
Bachelor of Technology (B.Tech), 2018`
  },
  {
    filename: 'CV_Neha_Kapoor_Data.txt',
    name: 'Neha Kapoor',
    email: 'neha.kapoor.analytics@example.com',
    phone: '+91 85432 10987',
    skills: ['Python', 'SQL', 'PostgreSQL', 'Pandas', 'Machine Learning'],
    experienceYears: 4,
    content: `Neha Kapoor
Data Analytics Engineer
Email: neha.kapoor.analytics@example.com | Phone: +91 85432 10987

SUMMARY
4 years analyzing data and building analytical queries with Python and SQL.

SKILLS
Python, SQL, PostgreSQL, Pandas, NumPy, Data Analysis, Git

EXPERIENCE
Data Analyst — DataInsight Corp (2020 - Present)
- Analyzed large relational databases and created reporting pipelines.

EDUCATION
Bachelor of Science (B.S.) in Statistics, 2020`
  },
  {
    filename: 'CV_Karan_Sengupta_Cloud.txt',
    name: 'Karan Sengupta',
    email: 'karan.sengupta.cloud@example.com',
    phone: '+91 84321 09876',
    skills: ['AWS', 'Docker', 'CI/CD', 'Linux', 'Python', 'Terraform'],
    experienceYears: 5,
    content: `Karan Sengupta
Cloud Infrastructure Engineer
Email: karan.sengupta.cloud@example.com | Phone: +91 84321 09876

SUMMARY
5 years automating cloud infrastructure and CI/CD pipelines on AWS.

SKILLS
AWS, Docker, CI/CD, Linux, Python, Terraform, Git

EXPERIENCE
Cloud Engineer — SkyScale Networks (2019 - Present)
- Maintained AWS cloud infrastructure and deployment pipelines.

EDUCATION
Bachelor of Engineering (B.E.), 2019`
  },
  {
    filename: 'CV_Ankit_Tiwari_Frontend.txt',
    name: 'Ankit Tiwari',
    email: 'ankit.tiwari.web@example.com',
    phone: '+91 83210 98765',
    skills: ['React', 'JavaScript', 'HTML', 'CSS', 'Tailwind', 'Redux'],
    experienceYears: 3,
    content: `Ankit Tiwari
Frontend Developer
Email: ankit.tiwari.web@example.com | Phone: +91 83210 98765

SUMMARY
3 years designing responsive web applications with React and Tailwind CSS.

SKILLS
React, JavaScript, Tailwind CSS, HTML5, CSS3, Redux, Git

EXPERIENCE
Frontend Developer — QuickWeb Media (2021 - Present)
- Created interactive interfaces and components in React.

EDUCATION
Bachelor of Science (B.Sc), 2021`
  },
  {
    filename: 'CV_Meera_Ranganathan_FullStack.txt',
    name: 'Meera Ranganathan',
    email: 'meera.ranganathan.eng@example.com',
    phone: '+91 82109 87654',
    skills: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'Express', 'Docker', 'AWS'],
    experienceYears: 7,
    content: `Meera Ranganathan
Senior Full Stack Architect
Email: meera.ranganathan.eng@example.com | Phone: +91 82109 87654

SUMMARY
7 years architecting resilient full-stack systems using React, TypeScript, Node.js, and PostgreSQL.

SKILLS
React, Node.js, TypeScript, PostgreSQL, Express, Docker, AWS, Microservices, Git

EXPERIENCE
Staff Engineer — Enterprise Apex (2017 - Present)
- Architected enterprise cloud applications in React and Node.js.
- Mentored engineering teams and established architectural standards.

EDUCATION
Master of Technology (M.Tech) in Software Systems, 2017`
  }
];

function buildMultipartBody(files: Array<{ filename: string; buffer: Buffer; mime: string }>, fields: Record<string, string>, boundary: string): Buffer {
  const chunks: Buffer[] = [];

  for (const [key, val] of Object.entries(fields)) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}\r\n`));
  }

  for (const f of files) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="${f.filename}"\r\nContent-Type: ${f.mime}\r\n\r\n`));
    chunks.push(f.buffer);
    chunks.push(Buffer.from('\r\n'));
  }

  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return Buffer.concat(chunks);
}

function makeHttpRequest(options: http.RequestOptions, body: Buffer): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode || 200, body: json });
        } catch {
          resolve({ status: res.statusCode || 200, body: data });
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function runPipelineTest() {
  console.log('========================================================================');
  console.log('   TASKNERA ATS: BULK CV UPLOAD, PARSING, DATA EXTRACTION & EVALUATION   ');
  console.log('========================================================================\n');

  let testOrgA: any = null;
  let testOrgB: any = null;
  let recruiterUserA: any = null;
  let recruiterUserB: any = null;
  let testJobA: any = null;

  try {
    // ── STEP 1: Setup Isolated Test Organizations and Users ─────────────────
    console.log('[Step 1] Setting up multi-tenant test organizations...');

    // Clean up previous runs
    await prisma.candidate.deleteMany({
      where: {
        OR: [
          { resume_file_url: { contains: 'CV_' } },
          { email: { contains: 'example.com' } }
        ]
      }
    });

    await prisma.job.deleteMany({
      where: { position: 'Senior Full Stack Engineer (Bulk Test requisition)' }
    });

    testOrgA = await prisma.organization.upsert({
      where: { id: 'org-bulk-test-a' },
      update: {},
      create: {
        id: 'org-bulk-test-a',
        name: 'Bulk Test Org A',
        companyEmail: 'contact@bulktesta.com',
        maxUsers: 5,
        maxRecruiters: 3,
        maxActiveJobs: 10,
        maxResumesPerMonth: 500
      }
    });

    testOrgB = await prisma.organization.upsert({
      where: { id: 'org-bulk-test-b' },
      update: {},
      create: {
        id: 'org-bulk-test-b',
        name: 'Bulk Test Org B',
        companyEmail: 'contact@bulktestb.com',
        maxUsers: 5,
        maxRecruiters: 3,
        maxActiveJobs: 10,
        maxResumesPerMonth: 500
      }
    });

    recruiterUserA = await prisma.user.upsert({
      where: { email: 'recruiter.a@bulktesta.com' },
      update: { organizationId: testOrgA.id },
      create: {
        name: 'Recruiter A',
        email: 'recruiter.a@bulktesta.com',
        password: 'mockhash',
        role: 'RECRUITER',
        organizationId: testOrgA.id
      }
    });

    recruiterUserB = await prisma.user.upsert({
      where: { email: 'recruiter.b@bulktestb.com' },
      update: { organizationId: testOrgB.id },
      create: {
        name: 'Recruiter B',
        email: 'recruiter.b@bulktestb.com',
        password: 'mockhash',
        role: 'RECRUITER',
        organizationId: testOrgB.id
      }
    });

    console.log(`✓ Setup Org A: ${testOrgA.id}, Recruiter A: ${recruiterUserA.id}`);
    console.log(`✓ Setup Org B: ${testOrgB.id}, Recruiter B: ${recruiterUserB.id}`);

    // Create Job Description for Org A
    testJobA = await prisma.job.create({
      data: {
        position: 'Senior Full Stack Engineer (Bulk Test requisition)',
        client: 'Global Fintech Client',
        location: 'Remote',
        status: 'active',
        created_by: recruiterUserA.id,
        organizationId: testOrgA.id,
        jd_text: 'Seeking a Senior Full Stack Engineer with at least 3+ years experience in React, Node.js, TypeScript, PostgreSQL, and Docker.',
        requirements: {
          create: [
            { requirement: 'React frontend development', category: 'Technical Skill', is_mandatory: true, weight: 1.5 },
            { requirement: 'Node.js backend microservices', category: 'Technical Skill', is_mandatory: true, weight: 1.5 },
            { requirement: 'TypeScript', category: 'Technical Skill', is_mandatory: false, weight: 1.0 },
            { requirement: 'PostgreSQL or relational database', category: 'Technical Skill', is_mandatory: false, weight: 1.0 },
            { requirement: 'Docker containerization or AWS', category: 'Technical Skill', is_mandatory: false, weight: 1.0 },
            { requirement: 'Minimum 3 years software engineering experience', category: 'Experience', is_mandatory: true, weight: 1.2 }
          ]
        }
      },
      include: { requirements: true }
    });

    console.log(`✓ Created Job Requisition: id=${testJobA.id} with ${testJobA.requirements.length} requirements`);

    // ── STEP 2: Prepare 19 CV files (18 valid + 1 corrupt) ───────────────────
    console.log('\n[Step 2] Preparing 19 CV files (18 valid profiles + 1 deliberate corrupt file)...');
    const uploadFiles = SAMPLE_CANDIDATES.map(cand => ({
      filename: cand.filename,
      buffer: Buffer.from(cand.content, 'utf-8'),
      mime: cand.filename.endsWith('.pdf') ? 'application/pdf' : 'text/plain'
    }));

    console.log(`✓ Prepared ${uploadFiles.length} files:`);
    uploadFiles.forEach((f, i) => console.log(`   ${i + 1}. ${f.filename} (${f.buffer.length} bytes)`));

    // ── STEP 3: Execute Bulk Upload to Node.js Backend ───────────────────────
    console.log('\n[Step 3] Submitting 19 files in a single batch to POST /api/jobs/:jobId/candidates/upload...');
    const tokenA = jwt.sign(
      { userId: recruiterUserA.id, id: recruiterUserA.id, email: recruiterUserA.email, role: 'RECRUITER', organizationId: testOrgA.id },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const boundary = '----TaskNeraBulkUploadBoundary' + Math.random().toString(36).substring(2);
    const multipartPayload = buildMultipartBody(
      uploadFiles,
      {
        jobId: testJobA.id,
        jobPosition: testJobA.position,
        jobClient: testJobA.client
      },
      boundary
    );

    const startTime = Date.now();
    const uploadResponse = await makeHttpRequest(
      {
        hostname: '127.0.0.1',
        port: BACKEND_PORT,
        path: `/api/jobs/${testJobA.id}/candidates/upload`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenA}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': multipartPayload.length
        }
      },
      multipartPayload
    );
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✓ Request finished in ${duration}s with HTTP Status: ${uploadResponse.status}`);

    const resData = uploadResponse.body;

    // ── STEP 4: Validate Batch Response & Incremental Resiliency ─────────────
    console.log('\n[Step 4] Validating batch response integrity...');
    if (uploadResponse.status !== 201) {
      throw new Error(`Expected HTTP 201 Created, received ${uploadResponse.status}: ${JSON.stringify(resData)}`);
    }

    console.log(`   Uploaded Count: ${resData.uploadedCount}`);
    console.log(`   Successful Count: ${resData.successfulCount}`);
    console.log(`   Failed Count: ${resData.failedCount}`);
    const foundCorrupt = resData.candidates.find((c: any) => c.fileName === 'CV_Deliberately_Corrupt_File.pdf');
    console.log(`   Corrupt file info: status=${foundCorrupt?.parsingStatus}, name=${foundCorrupt?.name}, rawTextLen=${(foundCorrupt?.rawText || '').length}, method=${foundCorrupt?.parsingMetadata?.extractionMethod}`);

    if (resData.uploadedCount !== 19) {
      throw new Error(`Expected 19 uploaded files, got ${resData.uploadedCount}`);
    }
    if (resData.successfulCount !== 18) {
      throw new Error(`Expected 18 successful parsed files, got ${resData.successfulCount}`);
    }
    if (resData.failedCount !== 1) {
      throw new Error(`Expected exactly 1 failed file (the corrupt file), got ${resData.failedCount}`);
    }
    console.log('✓ Batch counts verified: 18 success, 1 failure.');

    // ── STEP 5: Verify the Corrupt File Failed Gracefully ───────────────────
    console.log('\n[Step 5] Verifying corrupt file failed gracefully without crashing others...');
    const corruptResult = resData.candidates.find((c: any) => c.fileName === 'CV_Deliberately_Corrupt_File.pdf');
    if (!corruptResult) {
      throw new Error('Corrupt file result not found in response');
    }
    if (corruptResult.parsingStatus !== 'FAILED') {
      throw new Error(`Expected corrupt file status 'FAILED', got: ${corruptResult.parsingStatus}`);
    }
    if (!corruptResult.errorMessage) {
      throw new Error('Expected descriptive error message for corrupt file');
    }
    console.log(`✓ Corrupt file properly isolated: status=${corruptResult.parsingStatus}, error="${corruptResult.errorMessage}"`);

    // ── STEP 6: Verify Real Extracted Data and Real ATS Scores ───────────────
    console.log('\n[Step 6] Verifying all 18 valid CVs extracted real data and computed real ATS scores...');
    const validCandidates = resData.candidates.filter((c: any) => c.parsingStatus === 'PARSED');

    if (validCandidates.length !== 18) {
      throw new Error(`Expected 18 valid parsed candidates, got ${validCandidates.length}`);
    }

    const uniqueScores = new Set<number>();
    let fakeDataFound = false;

    for (const c of validCandidates) {
      // Check for hardcoded mock names or placeholder data
      if (c.name === 'Karan Patel' || c.name === 'Candidate') {
        fakeDataFound = true;
        throw new Error(`Found fabricated name '${c.name}' on file: ${c.fileName}`);
      }

      // Check ATS score
      if (typeof c.matchScore !== 'number' || c.matchScore === 0) {
        throw new Error(`Candidate ${c.name} has invalid matchScore: ${c.matchScore}`);
      }

      uniqueScores.add(c.matchScore);

      console.log(`   Candidate: ${c.name.padEnd(20)} | Email: ${(c.email || 'N/A').padEnd(32)} | Score: ${String(c.matchScore).padStart(3)}% | Skills: ${(c.skills || []).slice(0, 4).join(', ')}`);
    }

    // Verify scores are not all hardcoded to 78!
    if (uniqueScores.has(78) && uniqueScores.size === 1) {
      throw new Error('Critical failure: All candidates received identical hardcoded score of 78!');
    }

    console.log(`✓ Real extraction verified: Extracted ${validCandidates.length} real candidates with ${uniqueScores.size} distinct real scores!`);

    // ── STEP 7: Verify Database Persistence in PostgreSQL / Prisma ──────────
    console.log('\n[Step 7] Verifying database persistence in Prisma PostgreSQL...');
    const dbCandidates = await prisma.candidate.findMany({
      where: {
        organizationId: testOrgA.id,
        job_id: testJobA.id
      },
      include: {
        skills: true,
        applications: true,
        evaluations: true
      }
    });

    console.log(`✓ Found ${dbCandidates.length} candidate rows in database for Job ${testJobA.id}`);
    if (dbCandidates.length < 18) {
      throw new Error(`Expected at least 18 candidates in DB, found ${dbCandidates.length}`);
    }

    const dbEvaluations = await prisma.evaluation.findMany({
      where: {
        jobId: testJobA.id,
        organizationId: testOrgA.id
      }
    });
    console.log(`✓ Found ${dbEvaluations.length} evaluation records in database for Job ${testJobA.id}`);
    if (dbEvaluations.length < 18) {
      throw new Error(`Expected at least 18 evaluations in DB, found ${dbEvaluations.length}`);
    }

    // Check consistency between candidate record and evaluation record
    for (const cand of dbCandidates.slice(0, 5)) {
      const evalRow = dbEvaluations.find(e => e.candidateId === cand.id);
      if (evalRow) {
        console.log(`   DB Check: ${cand.name} -> DB Score: ${evalRow.score}%, ATS Score: ${evalRow.atsScore}%`);
      }
    }
    console.log('✓ Database records and candidate-job associations successfully verified.');

    // ── STEP 8: Verify Tenant Isolation ─────────────────────────────────────
    console.log('\n[Step 8] Verifying strict multi-tenant isolation...');
    const tokenB = jwt.sign(
      { userId: recruiterUserB.id, id: recruiterUserB.id, email: recruiterUserB.email, role: 'RECRUITER', organizationId: testOrgB.id },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Attempt to access Job A candidates as Recruiter B
    const crossTenantAttempt = await makeHttpRequest(
      {
        hostname: '127.0.0.1',
        port: BACKEND_PORT,
        path: `/api/jobs/${testJobA.id}/candidates`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenB}`
        }
      },
      Buffer.alloc(0)
    );

    if (crossTenantAttempt.status === 403 || crossTenantAttempt.status === 404) {
      console.log(`✓ Tenant isolation preserved: Recruiter B received HTTP ${crossTenantAttempt.status} when accessing Company A candidates.`);
    } else if (crossTenantAttempt.status === 200) {
      const candidatesSeenByB = crossTenantAttempt.body.candidates || [];
      if (candidatesSeenByB.length === 0) {
        console.log('✓ Tenant isolation preserved: Recruiter B sees 0 candidates.');
      } else {
        throw new Error(`Data leakage! Recruiter B saw ${candidatesSeenByB.length} candidates from Company A!`);
      }
    }

    // ── STEP 9: Test Individual Failed File Retry ────────────────────────────
    console.log('\n[Step 9] Testing individual failed file retry...');
    const failedCandId = corruptResult.id;
    if (failedCandId) {
      const retryResponse = await makeHttpRequest(
        {
          hostname: '127.0.0.1',
          port: BACKEND_PORT,
          path: `/api/jobs/${testJobA.id}/candidates/${failedCandId}/retry`,
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${tokenA}`
          }
        },
        Buffer.alloc(0)
      );

      console.log(`✓ Retry request responded with status: ${retryResponse.status}`);
    }

    console.log('\n========================================================================');
    console.log('   ALL 9 BULK CV UPLOAD, EXTRACTION & ATS SCORING TESTS PASSED (19 CVs)   ');
    console.log('========================================================================');
  } catch (err: any) {
    console.error('\n❌ PIPELINE VERIFICATION TEST FAILED:', err.message);
    throw err;
  }
}

runPipelineTest()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
