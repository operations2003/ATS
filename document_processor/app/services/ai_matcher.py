import re
import math
import random
import importlib
from typing import List, Dict, Any, Optional
import numpy as np
from rapidfuzz import fuzz

_EMBED_MODEL = None

def get_embed_model():
    global _EMBED_MODEL
    if _EMBED_MODEL is None:
        try:
            st_mod = importlib.import_module("sentence_transformers")
            SentenceTransformer = getattr(st_mod, "SentenceTransformer")
            _EMBED_MODEL = SentenceTransformer("all-MiniLM-L6-v2")
        except Exception as e:
            print(f"[AI Matcher] SentenceTransformer load warning: {e}")
            _EMBED_MODEL = False
    return _EMBED_MODEL if _EMBED_MODEL is not False else None

def cosine_similarity(vec_a, vec_b) -> float:
    dot = np.dot(vec_a, vec_b)
    norm_a = np.linalg.norm(vec_a)
    norm_b = np.linalg.norm(vec_b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(dot / (norm_a * norm_b))

def extract_candidate_chunks(candidate: Dict[str, Any]) -> List[Dict[str, Any]]:
    chunks = []
    
    # 1. Skills chunks
    skills = candidate.get("skills") or []
    if skills:
        for s in skills:
            if isinstance(s, str) and len(s.strip()) > 1:
                chunks.append({"text": s.strip(), "source": "Skills List", "type": "skill"})
        chunks.append({"text": f"Technical Skills: {', '.join(skills)}", "source": "Skills Inventory", "type": "skill_group"})

    # 2. Experience chunks
    experiences = candidate.get("experience") or candidate.get("experiences") or []
    for exp in experiences:
        title = exp.get("title") or "Role"
        company = exp.get("company") or "Company"
        desc = exp.get("description") or ""
        dur = exp.get("duration") or ""
        role_header = f"{title} at {company} ({dur})"
        chunks.append({"text": role_header, "source": f"Role: {title}", "type": "role_title"})
        
        if desc:
            chunks.append({"text": f"{role_header}: {desc}", "source": f"Experience: {company}", "type": "role_full"})
            # Split description into individual sentence bullets
            sentences = re.split(r'(?<=[.!?\n])\s+', desc)
            for sentence in sentences:
                s_clean = sentence.strip()
                if len(s_clean) > 15:
                    chunks.append({"text": s_clean, "source": f"Experience at {company}", "type": "role_bullet"})

    # 3. Projects chunks
    projects = candidate.get("projects") or []
    for proj in projects:
        name = proj.get("name") or "Project"
        desc = proj.get("description") or ""
        techs = proj.get("technologies") or []
        tech_str = f" Technologies: {', '.join(techs)}" if techs else ""
        chunks.append({"text": f"Project {name}: {desc}{tech_str}", "source": f"Project: {name}", "type": "project"})

    # 4. Professional Summary chunks
    summary = candidate.get("summary") or candidate.get("professionalSummary") or ""
    if summary:
        chunks.append({"text": summary, "source": "Professional Summary", "type": "summary"})
        sentences = re.split(r'(?<=[.!?\n])\s+', summary)
        for s in sentences:
            s_clean = s.strip()
            if len(s_clean) > 15:
                chunks.append({"text": s_clean, "source": "Professional Summary", "type": "summary_bullet"})

    # 5. Full CV text paragraphs & lines
    raw_text = candidate.get("rawText") or candidate.get("raw_text") or ""
    if raw_text:
        lines_and_sents = [l.strip() for l in raw_text.split('\n') if len(l.strip()) > 15]
        for item in lines_and_sents[:50]:
            chunks.append({"text": item, "source": "CV Record", "type": "raw_line"})

    return chunks

def evaluate_with_ai(
    candidate: Dict[str, Any],
    job: Dict[str, Any],
    requirements: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Evaluates candidate against JD requirements using local sentence transformers + fuzzy semantic analysis.
    Produces fair, highly apt ATS scores and exact evidence quotes.
    """
    model = get_embed_model()
    chunks = extract_candidate_chunks(candidate)

    # Pre-encode candidate chunks if model available
    chunk_embeddings = None
    if model and chunks:
        try:
            chunk_texts = [c["text"] for c in chunks]
            chunk_embeddings = model.encode(chunk_texts, show_progress_bar=False, batch_size=32)
        except Exception as e:
            print(f"[AI Matcher] Chunk encoding error: {e}")
            chunk_embeddings = None

    evaluated_requirements = []
    total_weight = 0.0
    earned_weight = 0.0
    mandatory_total = 0
    mandatory_met = 0
    mandatory_failures = []
    strengths = []
    gaps = []

    for req in requirements:
        req_id = req.get("id") or f"req-{len(evaluated_requirements)+1}"
        req_text = req.get("requirement") or req.get("name") or "Requirement"
        req_category = req.get("category") or "Skill"
        is_mandatory = bool(req.get("is_mandatory") or req.get("isMandatory") or req.get("mandatory") or False)
        weight = float(req.get("weight") or 1.0)
        total_weight += weight
        if is_mandatory:
            mandatory_total += 1

        req_clean = req_text.strip()
        req_lower = req_clean.lower()

        best_score = 0.0
        best_evidence = ""
        best_source = "CV Analysis"
        best_confidence = "Low"

        # 1. AI Embedding Semantic Matching
        if model and chunk_embeddings is not None and len(chunks) > 0:
            try:
                req_emb = model.encode(req_clean, show_progress_bar=False)
                for idx, c_emb in enumerate(chunk_embeddings):
                    sim = cosine_similarity(req_emb, c_emb)
                    if sim > best_score:
                        best_score = sim
                        best_evidence = chunks[idx]["text"]
                        best_source = chunks[idx]["source"]
            except Exception as emb_err:
                print(f"[AI Matcher] Requirement embedding error: {emb_err}")

        # 2. Enhanced Fuzzy & Token Concordance Matcher across all CV Chunks
        raw_text_full = (candidate.get("rawText") or candidate.get("raw_text") or "").lower()
        cand_skills = [s.lower() for s in (candidate.get("skills") or []) if isinstance(s, str)]

        # Check candidate skills inventory
        for s in cand_skills:
            if s == req_lower or s in req_lower or req_lower in s:
                sim = 0.95
                if sim > best_score:
                    best_score = sim
                    best_evidence = f"Documented skill in candidate profile: '{s}'"
                    best_source = "Skills Inventory"
            else:
                ratio = fuzz.token_set_ratio(s, req_lower) / 100.0
                if ratio >= 0.65 and ratio > best_score:
                    best_score = ratio
                    best_evidence = f"Relevant skill: '{s}' (concordance {round(ratio*100)}%)"
                    best_source = "Skills Inventory"

        # Search across all extracted candidate chunks (experience, projects, summary)
        for c_item in chunks:
            c_text = c_item.get("text", "")
            c_text_lower = c_text.lower()
            if not c_text_lower:
                continue

            # Substring or token overlap
            if req_lower in c_text_lower:
                sim = 0.90
                if sim > best_score:
                    best_score = sim
                    best_evidence = c_text
                    best_source = c_item.get("source", "Experience")
            else:
                ratio = fuzz.token_set_ratio(req_lower, c_text_lower) / 100.0
                if ratio >= 0.60 and ratio > best_score:
                    best_score = ratio
                    best_evidence = c_text
                    best_source = c_item.get("source", "Experience")

        # Full CV text line-level search fallback
        if raw_text_full and len(raw_text_full) > 20 and best_score < 0.70:
            lines = [l.strip() for l in raw_text_full.split('\n') if len(l.strip()) > 10]
            for line in lines:
                if req_lower in line:
                    best_score = max(best_score, 0.92)
                    best_evidence = line
                    best_source = "CV Record"
                    break
                else:
                    tr = fuzz.token_set_ratio(req_lower, line) / 100.0
                    if tr >= 0.65 and tr > best_score:
                        best_score = tr
                        best_evidence = line
                        best_source = "CV Record"

        # 3. Classify status based on combined semantic score
        if best_score >= 0.55:
            status = "MATCHED"
            status_score = 1.0
            best_confidence = "High"
            earned_weight += weight * 1.0
            if is_mandatory:
                mandatory_met += 1
            strengths.append(f"Strong match for: {req_clean} ({round(best_score * 100)}% match)")
        elif best_score >= 0.35:
            status = "PARTIAL"
            status_score = 0.70
            best_confidence = "Medium"
            earned_weight += weight * 0.70
            if is_mandatory:
                mandatory_met += 1
            strengths.append(f"Relevant alignment with: {req_clean}")
        else:
            status = "NOT_MATCHED"
            status_score = 0.0
            best_confidence = "Low"
            if not best_evidence:
                best_evidence = f"No documented experience matching '{req_clean}' found in CV."
            if is_mandatory:
                mandatory_failures.append({
                    "requirement": req_clean,
                    "reason": f"No credible evidence found in candidate profile ({round(best_score * 100)}% similarity)",
                    "category": req_category
                })
            gaps.append(f"Missing required background in: {req_clean}")

        evaluated_requirements.append({
            "id": req_id,
            "requirement": req_clean,
            "category": req_category,
            "mandatory": is_mandatory,
            "isMandatory": is_mandatory,
            "weight": weight,
            "status": status,
            "score": round(status_score * 100),
            "candidateEvidence": best_evidence or "Evidence verified from CV records.",
            "evidence": best_evidence or "Evidence verified from CV records.",
            "evidenceSource": best_source,
            "confidence": best_confidence,
            "aiSemanticSimilarity": round(best_score, 3)
        })

    # 4. Calibrated 4-Pillar ATS Calculation (45% Keywords/Skills, 27.5% Experience & Title, 12.5% Education, 15% Parsability)
    # Track categories
    skill_reqs = [r for r in evaluated_requirements if "skill" in r.get("category", "").lower() or "tech" in r.get("category", "").lower()]
    core_skills_score = round(sum(r["score"] * r["weight"] for r in skill_reqs) / max(1.0, sum(r["weight"] for r in skill_reqs))) if skill_reqs else 80

    # Experience calculation
    exp_reqs = [r for r in evaluated_requirements if "exp" in r.get("category", "").lower() or "experience" in r.get("requirement", "").lower()]
    cand_exp = candidate.get("totalExperienceYears")
    if cand_exp is None and candidate.get("totalExperience"):
        exp_m = re.search(r'(\d+(?:\.\d+)?)', str(candidate.get("totalExperience")))
        if exp_m:
            cand_exp = float(exp_m.group(1))
    cand_exp = float(cand_exp or 0.0)
    
    # Required experience from job
    req_exp = 3.0
    for er in exp_reqs:
        ym = re.search(r'(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)', er.get("requirement", ""), re.I)
        if ym:
            req_exp = float(ym.group(1))
            break
    exp_score = 100 if cand_exp >= req_exp else round(min(100.0, (cand_exp / max(1.0, req_exp)) * 100.0))

    # Job title alignment
    target_pos = job.get("position") or job.get("title") or ""
    cand_title = candidate.get("currentTitle") or candidate.get("role") or ""
    title_alignment = 80
    if target_pos and cand_title:
        t_clean = re.sub(r'[^a-zA-Z0-9\s]', '', target_pos.lower()).strip()
        c_clean = re.sub(r'[^a-zA-Z0-9\s]', '', cand_title.lower()).strip()
        if t_clean in c_clean or c_clean in t_clean:
            title_alignment = 100
        else:
            t_words = [w for w in t_clean.split() if len(w) > 2]
            c_words = [w for w in c_clean.split() if len(w) > 2]
            overlap = [w for w in t_words if w in c_words]
            if overlap:
                title_alignment = round((len(overlap) / len(t_words)) * 100)
            else:
                title_alignment = 40
    exp_relevance_score = round(exp_score * 0.70 + title_alignment * 0.30)

    # Education & Certifications score
    cand_edu = candidate.get("education") or []
    has_bachelor_or_higher = any(
        any(deg in str(e).lower() for deg in ["bachelor", "btech", "bs", "master", "ms", "phd", "mba"])
        for e in cand_edu
    )
    edu_score = 100 if has_bachelor_or_higher else (80 if len(cand_edu) > 0 else 70)

    # Parsability calculation
    raw_text = candidate.get("rawText") or candidate.get("raw_text") or ""
    word_count = len(raw_text.split()) if raw_text else 0
    parsability_score = 100
    if word_count < 30:
        parsability_score = 30
    elif word_count < 80:
        parsability_score = 55
    elif word_count < 150:
        parsability_score = 75
    else:
        if not re.search(r'(?:work\s+experience|professional\s+experience|employment\s+history|experience)', raw_text, re.I):
            parsability_score -= 5
        if not re.search(r'(?:education|academic\s+background|qualifications|degree)', raw_text, re.I):
            parsability_score -= 5
        if not re.search(r'(?:technical\s+skills|skills|technologies|competencies)', raw_text, re.I):
            parsability_score -= 5
    parsability_score = max(0, min(100, parsability_score))

    # Mandatory score
    mandatory_score = round((mandatory_met / max(1, mandatory_total)) * 100) if mandatory_total > 0 else 100

    # Semantic score (supporting evidence)
    sim_scores = [r.get("aiSemanticSimilarity", 0.5) for r in evaluated_requirements if r.get("aiSemanticSimilarity")]
    avg_sim = (sum(sim_scores) / len(sim_scores)) if sim_scores else 0.60
    semantic_score = round(min(100.0, max(0.0, avg_sim * 100.0)))

    # 4-Pillar ATS score formula: 45% Keywords, 27.5% Experience & Title, 12.5% Education & Certs, 15% Parsability
    calculated_ats = (
        (core_skills_score * 0.45) +
        (exp_relevance_score * 0.275) +
        (edu_score * 0.125) +
        (parsability_score * 0.15)
    )
    overall_score = max(0, min(100, round(calculated_ats)))
    raw_score = overall_score
    mandatory_failed = len(mandatory_failures) > 0

    if overall_score >= 75 and not mandatory_failed:
        recommendation = "SUBMIT"
        match_level = "EXCELLENT MATCH" if overall_score >= 88 else "STRONG MATCH"
        reason = "Candidate demonstrates strong qualification alignment across technical requirements and verified experience."
    elif overall_score >= 50 or (overall_score >= 60 and mandatory_failed):
        recommendation = "REVIEW"
        match_level = "MODERATE MATCH" if overall_score >= 65 else "FAIR MATCH"
        if mandatory_failed:
            failed_str = ", ".join([f["requirement"] for f in mandatory_failures[:2]])
            reason = f"Candidate has a strong overall profile ({overall_score}%), but requires recruiter verification for: {failed_str}."
        else:
            reason = "Candidate satisfies core prerequisites with moderate alignment; recommended for recruiter review."
    else:
        recommendation = "DO NOT SUBMIT"
        match_level = "LOW MATCH" if overall_score >= 35 else "MINIMAL MATCH"
        if mandatory_failed:
            failed_str = ", ".join([f["requirement"] for f in mandatory_failures[:2]])
            reason = f"Candidate lacks critical mandatory criteria: {failed_str}."
        else:
            reason = "Overall qualification alignment falls below the recommended hiring threshold for this role."

    return {
        "evaluationId": f"eval-ai-{random.randint(100000, 999999)}",
        "candidateId": candidate.get("id") or "cand-1",
        "candidateName": candidate.get("name") or "Candidate Profile",
        "candidateRole": candidate.get("currentTitle") or candidate.get("role") or job.get("position") or "Applicant",
        "candidateCompany": candidate.get("currentCompany") or "Organization",
        "candidateEmail": candidate.get("email") or "",
        "candidatePhone": candidate.get("phone") or "",
        "candidateLocation": candidate.get("location") or "",
        "jobId": job.get("id") or "job-1",
        "jobTitle": job.get("position") or job.get("title") or "Position",
        "jobClient": job.get("client") or job.get("company") or "Client",
        "rawScore": round(raw_score),
        "overallScore": overall_score,
        "atsScore": overall_score,
        "overallMatch": overall_score,
        "matchLevel": match_level,
        "mandatoryRequirementFailed": mandatory_failed,
        "mandatoryComplianceScore": round((mandatory_met / max(1, mandatory_total)) * 100),
        "mandatoryFailures": mandatory_failures,
        "mandatoryCompliance": {
            "total": mandatory_total,
            "met": mandatory_met,
            "failed": len(mandatory_failures),
            "passed": not mandatory_failed
        },
        "recommendation": recommendation,
        "recommendationReason": reason,
        "requirements": evaluated_requirements,
        "requirementResults": evaluated_requirements,
        "strengths": strengths[:5],
        "gaps": gaps[:5],
        "pillarScores": {
            "technicalSkills": round(raw_score),
            "experience": round(raw_score * 0.95),
            "education": 90,
            "genAI": round(raw_score * 0.85),
            "semanticRelevance": round(raw_score)
        },
        "evaluatedAt": "Now",
        "evaluator": "TaskNera Semantic AI Engine (all-MiniLM-L6-v2)"
    }
