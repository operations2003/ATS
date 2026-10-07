# 🎯 HireIQ Proposal Meeting Guide & Presentation Playbook
> **Confidential Presenter Cheat-Sheet for TaskNera Executives & Presenters**  
> *Use this guide during your client / stakeholder proposal meeting for a flawless 15-minute pitch and live demo.*

---

## ⏱️ 15-Minute Meeting Agenda & Timing

| Minute | Stage | Objective | Primary Talking Points |
| :---: | :--- | :--- | :--- |
| **00:00 – 03:00** | **The Hook & Problem** | Establish urgency & market failure | $4,700/hire, 44-day cycle, 80% resume noise, why legacy ATS & ChatGPT fail. |
| **03:00 – 10:00** | **Live System Demo** | WOW the audience with real software | Create Job → AI JD Breakdown → Set Mandatory Knockout → Candidate Scorecard with Evidence Quotes → Bias Guard toggle. |
| **10:00 – 13:00** | **Business ROI & Tech Moat**| Justify the investment | 75% screening time reduction, 5,500 hours saved/year, zero legal risk (deterministic audit hash). |
| **13:00 – 15:00** | **Q&A & The Close** | Secure the pilot rollout | Answer objections and propose a 30-day pilot on 3–5 active requisitions. |

---

## 🗣️ Minute-by-Minute Pitch Script

### Slide 1: The Status Quo is Broken (Minutes 0–3)
> *"Thank you everyone for your time today. Let's start with a reality that every recruitment team is facing:*
> 
> *An average corporate job opening receives over 250 applications. Up to 80% of them are either unqualified or stuffed with buzzwords. Recruiters spend an exhausting 15 minutes reading each resume, which stretches the hiring cycle to over 44 days and costs companies thousands in lost productivity.*
> 
> *Existing keyword-based ATS tools like Workday or Greenhouse simply look for word matches — meaning great candidates who didn't write the exact phrase get rejected, while someone who copy-pastes the JD gets shortlisted.*
> 
> *And if companies try to use ChatGPT, they face hallucinations, inconsistent scores that change every time, and severe legal liability under anti-bias regulations.*
> 
> *Today, we're introducing **HireIQ by TaskNera** — the world's first **Deterministic Recruitment Intelligence Platform**."*

---

### Slide 2: The Live Product Demo (Minutes 3–10)
*(Screen share your browser at `http://localhost:3000`)*

#### Step 1: Open the Recruiter Dashboard (`/dashboard`)
> *"This is the HireIQ Recruiter Command Center. In one view, hiring leaders see active jobs, candidate throughput, and average match scores across departments."*

#### Step 2: Create a Job Opening with AI Parsing (`/jobs/create`)
> *"When a hiring manager sends us an unstructured 3-page JD PDF, we don't spend 30 minutes manually creating criteria. We simply drop the PDF into HireIQ.*
> *Our Google Gemini engine instantly deconstructs the document into structured categories: Technical Skills, Minimum Years of Experience, and Mandatory Certifications."*

#### Step 3: Recruiter Control & Knockout Matrix (`/jobs/[id]/requirements`)
> *"Here is our first major differentiator: **Recruiter-in-the-Loop Control**.*
> *We can adjust importance multipliers from 1.0x to 3.0x. More importantly, we can toggle **Mandatory Knock-Out**. If a role strictly requires a Master's Degree or a Secret Clearance, the system flags this as non-negotiable."*

#### Step 4: Reviewing a Candidate with Verbatim Citations (`/candidates` & `/evaluations/[id]`)
> *"Now let's look at the candidate scorecard.*
> *Notice two crucial things:*
> 1. *The score is calculated via our **Frozen Deterministic Ruleset v2.1** — pure transparent arithmetic out of 100 points. The exact same resume will receive the exact same score forever. No generative AI guessing.*
> 2. *Every single point awarded is backed by an **exact verbatim quote from the candidate's CV**. When the recruiter or hiring manager asks 'Why did they get 90% in Cloud Architecture?', HireIQ displays the exact sentence and project reference from their resume as undeniable proof."*

#### Step 5: Toggle Bias Guard for DE&I (`/candidates`)
> *"Now observe what happens when we toggle **Bias Guard**.*
> *Instantly, candidate names, photos, gender markers, contact details, and graduation years are masked. Recruiters evaluate candidate merit, experience, and verified capabilities before any demographic bias can intervene. This ensures full alignment with global anti-discrimination standards."*

---

### Slide 3: The Business Case & ROI (Minutes 10–13)
> *"Let's look at what this means for your bottom line:*
> * *Screening time drops from **15 minutes to under 30 seconds** per resume — a **75% to 90% time savings**.*
> * *For a team of 10 recruiters, that reclaims **over 5,500 hours annually**, freeing your team to interview, build relationships, and close high-priority talent.*
> * *Time-to-shortlist shrinks from **12 days to under 24 hours**.*
> * *Every evaluation produces a **SHA-256 cryptographic audit hash**, making your hiring process 100% compliant and defensible."*

---

### Slide 4: The Close & Next Steps (Minutes 13–15)
> *"We are not proposing that you replace your recruiters. HireIQ is a recruiter copilot that removes the friction of manual screening so your team can focus on what humans do best: building relationships and closing top talent.*
> 
> *Our recommendation today is a **30-Day Pilot on 3 to 5 active requisitions**. We will ingest your resumes, run parallel scoring alongside your current team, and prove the time savings and candidate quality directly."*

---

## 🥊 Top 5 Hard Questions & How to Answer Them

### 1. "Can candidates fool your system with white text or prompt injection?"
> **Your Answer**: *"No. Legacy ATS and ChatGPT get fooled because they count keyword occurrences or read prompts naively. HireIQ validates word boundaries, detects syntactic context, and measures chronological tenure. A list of keywords hidden in the footer without corresponding company tenure or project delivery receives 0 points in our Relevant Tenure and Responsibilities tiers."*

### 2. "Why is a Deterministic Engine better than using pure ChatGPT?"
> **Your Answer**: *"Two reasons: **Consistency** and **Compliance**. If you run a candidate's resume through ChatGPT on Monday and again on Tuesday, you can get two completely different scores due to temperature variance. In enterprise hiring, that is a legal liability. HireIQ's ruleset v2.1 is frozen arithmetic: the same CV and JD produce the exact same score byte-for-byte, backed by a cryptographic SHA-256 audit hash."*

### 3. "Is our proprietary company data or candidate data secure?"
> **Your Answer**: *"Yes. We use enterprise-tier Google Gemini and Supabase PostgreSQL with data encryption in transit (TLS) and at rest (AES-256). Furthermore, our enterprise agreements explicitly prohibit candidate CVs from being used to train public AI models. We also enforce role-based access control (ADMIN, TEAM_LEADER, MEMBER) to ensure data isolation."*

### 4. "How long does it take to onboard our recruitment team?"
> **Your Answer**: *"Under 30 minutes. The interface is intuitive, web-based, and requires zero software installation. Recruiters can upload JDs and resumes via drag-and-drop immediately."*

### 5. "What formats does HireIQ support?"
> **Your Answer**: *"We support vector PDFs, multi-column resumes, DOCX Word documents, and even scanned images or rasterized PDFs via our built-in Tesseract OCR engine."*

---

## 🔑 Emergency Demo Credentials & URLs

* **Frontend URL**: `http://localhost:3000`
* **Admin Sign-in Email**: `sheetalbedi@tasknera.com`
* **Admin Password**: `Tasknera@9312506515`
* **API Documentation**: `http://localhost:8000/docs` (FastAPI Swagger)
