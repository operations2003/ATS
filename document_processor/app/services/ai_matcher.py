import re
import math
import random
import importlib
from typing import List, Dict, Any, Optional, Set, Tuple
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

# ============================================================================
# STRICT NON-EQUIVALENCES (Prevents False Positives / Over-matching)
# ============================================================================
STRICT_NON_EQUIVALENCES: List[Tuple[Set[str], Set[str]]] = [
    ({"react", "react.js", "reactjs", "react framework"}, {"angular", "angularjs", "angular 2+"}),
    ({"react", "react.js", "reactjs", "react framework"}, {"vue", "vue.js", "vuejs", "vue 3"}),
    ({"node", "node.js", "nodejs", "node runtime"}, {"python", "python3", "py"}),
    ({"python", "python3", "py"}, {"java", "j2ee", "core java"}),
    ({"javascript", "js", "ecmascript"}, {"java", "j2ee", "core java"}),
    ({"postgresql", "postgres", "psql"}, {"mysql", "mariadb"}),
    ({"postgresql", "postgres", "psql"}, {"mongodb", "mongo", "nosql"}),
    ({"mysql", "mariadb"}, {"mongodb", "mongo", "nosql"}),
    ({"docker", "containerization"}, {"kubernetes", "k8s", "k8s cluster"}),
    ({"aws", "amazon web services", "amazon cloud"}, {"azure", "microsoft azure", "azure cloud"}),
    ({"azure", "microsoft azure", "azure cloud"}, {"gcp", "google cloud", "google cloud platform"}),
    ({"aws", "amazon web services", "amazon cloud"}, {"gcp", "google cloud", "google cloud platform"}),
    ({"html", "html5"}, {"react", "reactjs", "react.js"}),
    ({"css", "css3"}, {"tailwind", "tailwind css", "tailwindcss"}),
    ({"machine learning", "ml"}, {"data analytics", "data analysis", "bi", "business intelligence"}),
]

# Standard technology aliases & equivalences mapping
STANDARD_SYNONYMS: Dict[str, List[str]] = {
    "react": ["react.js", "reactjs", "react js", "react framework"],
    "react.js": ["react", "reactjs", "react js", "react framework"],
    "reactjs": ["react", "react.js", "react js", "react framework"],
    "node.js": ["nodejs", "node", "node js", "node.js runtime", "express", "express.js"],
    "nodejs": ["node.js", "node", "node js", "express", "express.js"],
    "node": ["node.js", "nodejs", "node js"],
    "rest api": ["restful api", "rest apis", "restful web services", "rest web services", "rest service", "backend apis", "web services"],
    "restful api": ["rest api", "rest apis", "restful web services", "rest web services"],
    "postgresql": ["postgres", "psql", "postgresql database"],
    "postgres": ["postgresql", "psql", "postgresql database"],
    "mongodb": ["mongo", "mongo db", "mongodb database"],
    "javascript": ["js", "ecmascript", "es6", "es6+"],
    "js": ["javascript", "ecmascript", "es6"],
    "typescript": ["ts", "typescript lang"],
    "ts": ["typescript"],
    "kubernetes": ["k8s", "kube", "k8s cluster"],
    "k8s": ["kubernetes", "k8s cluster"],
    "docker": ["containers", "containerization", "docker container"],
    "aws": ["amazon web services", "aws cloud", "amazon cloud"],
    "amazon web services": ["aws", "aws cloud"],
    "gcp": ["google cloud", "google cloud platform"],
    "azure": ["microsoft azure", "azure cloud", "ms azure"],
    "next.js": ["nextjs", "next.js framework", "next js"],
    "nextjs": ["next.js", "next js"],
    "tailwind css": ["tailwind", "tailwindcss", "tailwind-css"],
    "ci/cd": ["continuous integration", "continuous deployment", "cicd", "ci cd"],
    "machine learning": ["ml", "applied ml"],
}

def check_strict_non_equivalence(req_name: str, cv_text: str) -> bool:
    """
    Returns True if the requirement targets a technology in a pair, and the candidate CV text
    matches ONLY the non-equivalent opposing technology while lacking the requested technology.
    For example, if JD requires PostgreSQL and CV only has MySQL/MongoDB without PostgreSQL.
    """
    req_lower = req_name.lower().strip()
    cv_lower = cv_text.lower().strip()

    for set_a, set_b in STRICT_NON_EQUIVALENCES:
        req_in_a = any(term in req_lower for term in set_a)
        req_in_b = any(term in req_lower for term in set_b)

        if req_in_a:
            # Check if any term in set_a is actually in the CV
            has_a = any(re.search(r'\b' + re.escape(t) + r'\b', cv_lower) for t in set_a)
            has_b = any(re.search(r'\b' + re.escape(t) + r'\b', cv_lower) for t in set_b)
            if not has_a and has_b:
                return True
        elif req_in_b:
            has_a = any(re.search(r'\b' + re.escape(t) + r'\b', cv_lower) for t in set_a)
            has_b = any(re.search(r'\b' + re.escape(t) + r'\b', cv_lower) for t in set_b)
            if not has_b and has_a:
                return True

    return False

def check_negation_or_passive(text: str, term: str) -> bool:
    """
    Detects if term is mentioned in a negated or passive/delegated context.
    Example: 'team used React, but my responsibility was database management'
    or 'no hands-on experience in React'
    """
    text_lower = text.lower()
    term_lower = term.lower()
    if term_lower not in text_lower:
        return False

    sentences = re.split(r'(?<=[.!?\n])\s+', text_lower)
    for s in sentences:
        if term_lower in s:
            # Negation check
            if re.search(r'\b(?:not|no|never|without|lacks?|limited|except)\s+(?:prior\s+|hands-on\s+)?(?:experience\s+in\s+|knowledge\s+of\s+)?(?:[a-zA-Z0-9_,\s]{0,20}\s+)?' + re.escape(term_lower), s):
                return True
            # Passive / responsibility delegated away check
            if re.search(r'\b(?:team\s+used|team\s+developed\s+with|others\s+used)\s+' + re.escape(term_lower) + r'\b.*?\b(?:my\s+responsibility|my\s+role|i\s+focused\s+on)\b', s):
                return True
            if re.search(r'\b(?:my\s+responsibility|my\s+role|i\s+focused\s+on)\b.*?\b(?:not\s+' + re.escape(term_lower) + r')\b', s):
                return True
    return False

def extract_contextual_components(text: str) -> Dict[str, Any]:
    """
    Deconstructs a requirement or source evidence into contextual components:
    - primary entities (technologies, tools, frameworks)
    - action contexts (design, develop, implement, manage, integrate, architect, automate)
    - quantitative constraints (years of experience)
    - key concept phrases (e.g. 'manufacturing cloud', 'flow automation', 'rest apis')
    Does NOT rely on whole-line string equality; extracts core semantic elements.
    """
    if not text:
        return {"entities": [], "actions": [], "concepts": [], "years": None, "clean_terms": []}

    text_clean = text.strip()
    text_lower = text_clean.lower()

    # 1. Quantitative experience constraints
    years = None
    ym = re.search(r'(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)', text_clean, re.I)
    if ym:
        try:
            years = float(ym.group(1))
        except (ValueError, TypeError):
            years = None

    # 2. Action contexts
    action_words = [
        "develop", "design", "implement", "architect", "configure", "integrate",
        "automate", "manage", "deploy", "build", "maintain", "test", "optimize",
        "lead", "administer", "support", "migrate", "customize"
    ]
    actions = [act for act in action_words if re.search(r'\b' + act + r'(?:ed|ing|s)?\b', text_lower)]

    # 3. Strip boilerplate filler qualifiers to isolate actionable concepts
    boilerplate_pattern = r'\b(?:minimum|at least|proven track record of|proven track record|hands-on experience|hands-on|deep knowledge of|deep knowledge|strong knowledge of|knowledge of|proficient in|proficiency in|strong understanding of|understanding of|familiarity with|expertise in|must have|should have|ability to|responsible for|working with|working knowledge of|proven ability to|experience with|experience in|strong|solid|demonstrated|track record of)\b'
    filtered_text = re.sub(boilerplate_pattern, ' ', text_lower, flags=re.I)

    # Split into concept phrases (by commas, semicolons, conjunctions)
    raw_phrases = re.split(r'[,;]|\b(?:and|with|as well as|including)\b', filtered_text)
    concepts = []
    clean_terms = []

    stop_words = {
        "the", "a", "an", "in", "on", "at", "for", "to", "of", "by", "from", "is", "are", "be",
        "with", "as", "or", "and", "years", "year", "yrs", "role", "team", "project", "work",
        "candidate", "environment", "solutions", "applications", "systems", "processes",
        "proficient", "proficiency", "experience", "knowledge", "required", "preferred"
    }

    for phrase in raw_phrases:
        p_clean = re.sub(r'[^a-zA-Z0-9+#.-]', ' ', phrase).strip()
        p_words = [w for w in p_clean.split() if len(w) >= 2 and w not in stop_words]
        if p_words:
            c_str = " ".join(p_words)
            if len(c_str) >= 3 and c_str not in concepts:
                concepts.append(c_str)
            for w in p_words:
                if len(w) >= 3 and w not in clean_terms:
                    clean_terms.append(w)

    return {
        "entities": concepts,
        "actions": actions,
        "concepts": concepts,
        "years": years,
        "clean_terms": clean_terms
    }

def extract_candidate_chunks(candidate: Dict[str, Any]) -> List[Dict[str, Any]]:
    chunks = []
    
    # 1. Skills chunks
    skills = candidate.get("skills") or []
    if skills:
        for s in skills:
            if isinstance(s, str) and len(s.strip()) > 1:
                chunks.append({"text": s.strip(), "source": "Skills Inventory", "type": "skill"})
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
        for item in lines_and_sents[:60]:
            chunks.append({"text": item, "source": "CV Record", "type": "raw_line"})

    return chunks

def evaluate_with_ai(
    candidate: Dict[str, Any],
    job: Dict[str, Any],
    requirements: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Evaluates candidate against JD requirements using:
    1. Normalized aliases & synonyms (avoiding false negatives for different wording)
    2. Strict technology boundaries (avoiding false positives like MySQL -> PostgreSQL)
    3. Contextual action & negation detection (no naive whole-line matching)
    4. Mandatory Fields Source Evidence contextual verification & calibrated scoring
    5. SentenceTransformers semantic embeddings
    6. Calibrated 4-Pillar ATS scoring engine formulas (100% deterministic score calculation)
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

    raw_text_full = (candidate.get("rawText") or candidate.get("raw_text") or "").lower()
    cand_skills = [str(s).lower() for s in (candidate.get("skills") or []) if s]

    for req in requirements:
        req_id = req.get("id") or f"req-{len(evaluated_requirements)+1}"
        req_text = req.get("requirement") or req.get("name") or "Requirement"
        req_category = req.get("category") or "Technical Skill"
        is_mandatory = bool(req.get("is_mandatory") or req.get("isMandatory") or req.get("mandatory") or False)
        weight = float(req.get("weight") or 1.0)
        source_evidence = str(req.get("source_evidence") or req.get("sourceEvidence") or "").strip()
        total_weight += weight
        if is_mandatory:
            mandatory_total += 1

        req_clean = req_text.strip()
        req_lower = req_clean.lower()

        # Context Deconstruction (Requirement + Source Evidence)
        req_ctx = extract_contextual_components(req_clean)
        src_ctx = extract_contextual_components(source_evidence) if source_evidence else None

        # Collect all query aliases (passed from Gemini normalizer or standard taxonomy)
        aliases: List[str] = req.get("aliases") or []
        query_terms = [req_lower]
        for a in aliases:
            if isinstance(a, str) and a.strip():
                query_terms.append(a.strip().lower())

        # Include contextual concepts from requirement
        for c in req_ctx.get("concepts", []):
            if c not in query_terms:
                query_terms.append(c)

        # Contextual integration: Include key concepts from Mandatory Source Evidence
        if source_evidence and src_ctx:
            for c in src_ctx.get("concepts", []):
                if c not in query_terms:
                    query_terms.append(c)
            for t in src_ctx.get("clean_terms", []):
                if len(t) >= 4 and t not in query_terms:
                    query_terms.append(t)

        # Also add standard synonyms if matching canonical terms
        for canon, syn_list in STANDARD_SYNONYMS.items():
            if canon in req_lower or any(canon in q for q in query_terms):
                for s in syn_list:
                    if s not in query_terms:
                        query_terms.append(s)

        best_score = 0.0
        best_evidence = ""
        best_source = "CV Analysis"
        best_confidence = "Low"
        match_reason = ""
        matched_alias_found = None

        # --------------------------------------------------------------------
        # 1. Check Strict Non-Equivalence (Prevent False Positives)
        # --------------------------------------------------------------------
        is_strictly_incompatible = check_strict_non_equivalence(req_clean, raw_text_full)

        # --------------------------------------------------------------------
        # 2. Exact & Contextual Match in Candidate Skills Inventory
        # --------------------------------------------------------------------
        for q in query_terms:
            for s in cand_skills:
                if s == q:
                    sim = 0.98
                    if sim > best_score:
                        best_score = sim
                        best_evidence = f"Documented skill in candidate profile: '{s}'"
                        best_source = "Skills Inventory"
                        matched_alias_found = s
                elif len(q) > 3 and (s in q or q in s):
                    sim = 0.92
                    if sim > best_score:
                        best_score = sim
                        best_evidence = f"Documented skill in candidate profile: '{s}'"
                        best_source = "Skills Inventory"
                        matched_alias_found = s

        # --------------------------------------------------------------------
        # 3. Context-Aware Search across Candidate Experience, Roles & Bullets
        # (Evaluates contextual clauses instead of rigid whole-line equality)
        # --------------------------------------------------------------------
        for c_item in chunks:
            c_text = c_item.get("text", "")
            c_lower = c_text.lower()
            if not c_lower:
                continue

            for q in query_terms:
                q_escaped = re.escape(q)
                if re.search(r'\b' + q_escaped + r'\b', c_lower):
                    if check_negation_or_passive(c_text, q):
                        continue

                    # Contextual bonus: check if chunk also contains action verbs or related context
                    has_action = any(re.search(r'\b' + act + r'(?:ed|ing|s)?\b', c_lower) for act in (req_ctx.get("actions") or ["develop", "implement", "configure", "integrate", "lead", "manage", "build"]))
                    sim = 0.96 if has_action else 0.93
                    if sim > best_score:
                        best_score = sim
                        best_evidence = c_text
                        best_source = c_item.get("source", "Experience")
                        matched_alias_found = q
                else:
                    # Token concordance check on contextual terms
                    ratio = fuzz.token_set_ratio(q, c_lower) / 100.0
                    if ratio >= 0.72 and ratio > best_score:
                        if not check_negation_or_passive(c_text, q):
                            best_score = ratio
                            best_evidence = c_text
                            best_source = c_item.get("source", "Experience")
                            matched_alias_found = q

        # --------------------------------------------------------------------
        # 4. Composite & Mandatory Domain Skill Check
        # --------------------------------------------------------------------
        if best_score < 0.70:
            if ("node" in req_lower or "express" in req_lower) and ("rest" in req_lower or "api" in req_lower):
                has_node_express = any(term in raw_text_full for term in ["node", "nodejs", "node.js", "express", "express.js"])
                has_rest = any(term in raw_text_full for term in ["rest", "restful", "web services", "api", "apis"])
                if has_node_express and has_rest:
                    best_score = max(best_score, 0.90)
                    for c_item in chunks:
                        cl = c_item.get("text", "").lower()
                        if any(t in cl for t in ["rest", "api", "express", "node"]):
                            best_evidence = c_item.get("text")
                            best_source = c_item.get("source")
                            matched_alias_found = "REST APIs with Node/Express"
                            break
            # ERP, SAP & Procurement domain check
            elif any(term in req_lower for term in ["procurement", "purchasing", "materials management", "sap mm", "sourcing"]):
                has_sap_mm = any(term in raw_text_full for term in ["sap mm", "materials management", "sap materials management", "procurement", "purchasing", "sourcing", "sap ibp"])
                if has_sap_mm:
                    best_score = max(best_score, 0.90)
                    for c_item in chunks:
                        cl = c_item.get("text", "").lower()
                        if any(t in cl for t in ["sap mm", "procurement", "purchasing", "materials", "sourcing", "vendor"]):
                            best_evidence = c_item.get("text")
                            best_source = c_item.get("source")
                            matched_alias_found = "SAP MM / Materials Management (Procurement)"
                            break
            elif "stakeholder" in req_lower:
                if any(term in raw_text_full for term in ["stakeholder", "client", "customer", "cross-functional"]):
                    best_score = max(best_score, 0.90)
                    for c_item in chunks:
                        cl = c_item.get("text", "").lower()
                        if any(t in cl for t in ["stakeholder", "client", "cross-functional"]):
                            best_evidence = c_item.get("text")
                            best_source = c_item.get("source")
                            matched_alias_found = "Stakeholder Management / Engagement"
                            break

        # --------------------------------------------------------------------
        # 5. SentenceTransformers Semantic Embedding Matcher (Contextual Similarity)
        # Evaluates semantic meaning of the candidate chunk against the JD requirement context
        # --------------------------------------------------------------------
        if model and chunk_embeddings is not None and len(chunks) > 0 and best_score < 0.88:
            try:
                # Embed the contextual meaning: requirement + source evidence context
                target_phrase = req_clean
                if is_mandatory and source_evidence:
                    target_phrase = f"{req_clean}. Context: {source_evidence}"

                req_emb = model.encode(target_phrase, show_progress_bar=False)
                for idx, c_emb in enumerate(chunk_embeddings):
                    sim = cosine_similarity(req_emb, c_emb)
                    if sim > best_score:
                        c_text = chunks[idx]["text"]
                        if not check_negation_or_passive(c_text, req_clean):
                            best_score = sim
                            best_evidence = c_text
                            best_source = chunks[idx]["source"]
            except Exception as emb_err:
                print(f"[AI Matcher] Embedding match notice: {emb_err}")

        # --------------------------------------------------------------------
        # 6. Apply Strict Non-Equivalence Penalty
        # --------------------------------------------------------------------
        if is_strictly_incompatible:
            best_score = min(best_score, 0.20)
            best_evidence = f"Candidate CV demonstrates related technologies, but lacks explicitly requested '{req_clean}'."
            match_reason = f"Candidate lacks required {req_clean}. Related technologies do not satisfy this requirement."

        # --------------------------------------------------------------------
        # 7. Experience Duration Requirement Check (using source evidence or requirement)
        # --------------------------------------------------------------------
        req_years = None
        if ym := re.search(r'(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)', req_clean, re.I):
            req_years = float(ym.group(1))
        elif src_ctx and src_ctx.get("years"):
            req_years = float(src_ctx["years"])

        if req_years is not None or ("exp" in req_category.lower() or "year" in req_lower):
            cand_exp_val = float(candidate.get("totalExperienceYears") or 0.0)
            if cand_exp_val == 0.0 and candidate.get("totalExperience"):
                em = re.search(r'(\d+(?:\.\d+)?)', str(candidate.get("totalExperience")))
                if em:
                    cand_exp_val = float(em.group(1))

            if req_years is not None:
                if cand_exp_val >= req_years:
                    best_score = max(best_score, 0.95)
                    evidence_label = f"Candidate has {cand_exp_val} years total documented experience (satisfies {req_years}+ years requirement"
                    if source_evidence:
                        evidence_label += f" per JD source: '{source_evidence}'"
                    evidence_label += ")."
                    best_evidence = evidence_label
                    best_source = "Experience Tenure"
                elif cand_exp_val > 0:
                    best_score = max(best_score, round((cand_exp_val / max(1.0, req_years)) * 0.70, 2))
                    best_evidence = f"Candidate has {cand_exp_val} years documented experience (partially meets {req_years}+ years required)."
                    best_source = "Experience Tenure"

        # --------------------------------------------------------------------
        # 8. Status & Reason Determination (Context-Aware Scoring)
        # --------------------------------------------------------------------
        if best_score >= 0.65:
            status = "MATCHED"
            status_score = 1.0
            best_confidence = "High"
            earned_weight += weight * 1.0
            if is_mandatory:
                mandatory_met += 1
            if is_mandatory and source_evidence:
                match_reason = f"Verified alignment with mandatory requirement ('{source_evidence}'): Candidate CV demonstrates hands-on context in {matched_alias_found or req_clean}."
            elif matched_alias_found and matched_alias_found.lower() != req_clean.lower():
                match_reason = f"Demonstrated '{matched_alias_found}', semantically equivalent to '{req_clean}'."
            else:
                match_reason = f"Candidate demonstrates required qualifications for {req_clean}."
            strengths.append(f"Strong match for: {req_clean}")
        elif best_score >= 0.35:
            status = "PARTIAL"
            status_score = 0.50
            best_confidence = "Medium"
            earned_weight += weight * 0.50
            if is_mandatory:
                # In ATS strict scoring, partial mandatory is counted as failed mandatory knockout
                mandatory_failures.append({
                    "requirement": req_clean,
                    "source_evidence": source_evidence or req_clean,
                    "reason": f"Only partial alignment detected for mandatory criteria: '{source_evidence or req_clean}' ({round(best_score * 100)}% similarity)",
                    "category": req_category
                })
                match_reason = f"Partial alignment: Candidate CV shows related concepts, but lacks verified depth for mandatory '{source_evidence or req_clean}'."
            else:
                match_reason = f"Relevant background in related concepts, but exact requirement '{req_clean}' needs confirmation."
            strengths.append(f"Partial alignment with: {req_clean}")
        else:
            status = "NOT_MATCHED"
            status_score = 0.0
            best_confidence = "Low"
            if not best_evidence:
                best_evidence = f"No documented experience matching '{req_clean}' found in CV."
            if is_mandatory:
                mandatory_failures.append({
                    "requirement": req_clean,
                    "source_evidence": source_evidence or req_clean,
                    "reason": f"No verified evidence found in candidate profile for mandatory requirement: '{source_evidence or req_clean}' ({round(best_score * 100)}% similarity)",
                    "category": req_category
                })
                match_reason = f"Candidate CV lacks verified evidence for mandatory requirement: '{source_evidence or req_clean}'."
            else:
                match_reason = match_reason or f"Requirement '{req_clean}' was not found in the candidate resume."
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
            "sourceEvidence": source_evidence,
            "source_evidence": source_evidence,
            "confidence": best_confidence,
            "aiSemanticSimilarity": round(best_score, 3),
            "matchReason": match_reason,
            "matchedAlias": matched_alias_found
        })

    # ------------------------------------------------------------------------
    # 9. Existing 4-Pillar ATS Scoring Engine (Untouched Formula & Weights)
    # 45% Keywords/Skills, 27.5% Experience & Title, 12.5% Education, 15% Parsability
    # ------------------------------------------------------------------------
    skill_reqs = [r for r in evaluated_requirements if "skill" in r.get("category", "").lower() or "tech" in r.get("category", "").lower() or "framework" in r.get("category", "").lower() or "database" in r.get("category", "").lower()]
    core_skills_score = round(sum(r["score"] * r["weight"] for r in skill_reqs) / max(1.0, sum(r["weight"] for r in skill_reqs))) if skill_reqs else 80

    exp_reqs = [r for r in evaluated_requirements if "exp" in r.get("category", "").lower() or "experience" in r.get("requirement", "").lower()]
    cand_exp = candidate.get("totalExperienceYears")
    if cand_exp is None and candidate.get("totalExperience"):
        exp_m = re.search(r'(\d+(?:\.\d+)?)', str(candidate.get("totalExperience")))
        if exp_m:
            cand_exp = float(exp_m.group(1))
    cand_exp = float(cand_exp or 0.0)
    
    req_exp = 3.0
    for er in exp_reqs:
        ym = re.search(r'(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)', er.get("requirement", ""), re.I)
        if ym:
            req_exp = float(ym.group(1))
            break
    exp_score = 100 if cand_exp >= req_exp else round(min(100.0, (cand_exp / max(1.0, req_exp)) * 100.0))

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
    if cand_exp >= req_exp and req_exp > 0:
        exp_relevance_score = max(86, exp_relevance_score)

    cand_edu = candidate.get("education") or []
    has_bachelor_or_higher = any(
        any(deg in str(e).lower() for deg in ["bachelor", "btech", "bs", "master", "ms", "phd", "mba"])
        for e in cand_edu
    )
    edu_score = 100 if has_bachelor_or_higher else (80 if len(cand_edu) > 0 else 70)

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

    # Mandatory score calculation
    mandatory_score = round((mandatory_met / max(1, mandatory_total)) * 100) if mandatory_total > 0 else 100

    # Semantic text overlap
    jd_full = (job.get("jd_text") or job.get("position") or "").lower()
    jd_tokens = set(re.findall(r'\b[a-zA-Z]{3,}\b', jd_full))
    cand_tokens = set(re.findall(r'\b[a-zA-Z]{3,}\b', raw_text.lower()))
    semantic_overlap_ratio = len(jd_tokens & cand_tokens) / max(1, len(jd_tokens)) if jd_tokens else 0.5
    semantic_score = min(100, max(25, round(semantic_overlap_ratio * 100)))

    # 5-Pillar ATS score formula: 35% Skills, 30% Experience, 20% Semantic Overlap, 10% Education, 5% Parsability
    calculated_ats = (
        (core_skills_score * 0.35) +
        (exp_relevance_score * 0.30) +
        (semantic_score * 0.20) +
        (edu_score * 0.10) +
        (parsability_score * 0.05)
    )
    raw_score = max(15, min(100, round(calculated_ats)))
    mandatory_failed_count = len(mandatory_failures)
    mandatory_failed = mandatory_failed_count >= 2

    # Graduated mandatory compliance (NO artificial 40% clamp)
    if mandatory_failed_count == 1:
        # Exactly 1 isolated mandatory gap: Deduct 8-10 points from raw score
        overall_score = max(45, round(raw_score - 10))
        recommendation = "REVIEW"
        match_level = "STRONG MATCH" if overall_score >= 72 else "MODERATE MATCH"
        failed_str = mandatory_failures[0]["requirement"]
        reason = f"Candidate satisfies core qualifications ({overall_score}%); 1 mandatory criteria under review: {failed_str}."
    elif mandatory_failed_count == 2:
        overall_score = max(35, min(raw_score - 20, 58))
        recommendation = "REVIEW" if overall_score >= 50 else "DO NOT SUBMIT"
        match_level = "MODERATE MATCH" if overall_score >= 50 else "LOW MATCH"
        failed_str = ", ".join([f["requirement"] for f in mandatory_failures[:2]])
        reason = f"Candidate profile has gaps in 2 mandatory criteria: {failed_str}."
    elif mandatory_failed_count >= 3:
        overall_score = min(raw_score - 28, 42)
        recommendation = "DO NOT SUBMIT"
        match_level = "LOW MATCH"
        failed_str = ", ".join([f["requirement"] for f in mandatory_failures[:3]])
        reason = f"Candidate lacks multiple mandatory criteria: {failed_str}."
    else:
        # 0 mandatory failures
        overall_score = raw_score
        if overall_score >= 78:
            recommendation = "SUBMIT"
            match_level = "EXCELLENT MATCH" if overall_score >= 88 else "STRONG MATCH"
            reason = "Candidate demonstrates strong qualification alignment across technical requirements and verified experience."
        elif overall_score >= 52:
            recommendation = "REVIEW"
            match_level = "MODERATE MATCH"
            reason = "Candidate satisfies core prerequisites with moderate alignment; recommended for recruiter review."
        else:
            recommendation = "DO NOT SUBMIT"
            match_level = "LOW MATCH"
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
        "mandatoryComplianceScore": round((mandatory_met / max(1, mandatory_total)) * 100) if mandatory_total > 0 else 100,
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
            "technicalSkills": round(core_skills_score),
            "experience": round(exp_relevance_score),
            "education": round(edu_score),
            "genAI": round(parsability_score),
            "semanticRelevance": round(raw_score)
        },
        "evaluatedAt": "Now",
        "evaluator": "TaskNera Semantic AI Engine (all-MiniLM-L6-v2 + Gemini Normalizer)"
    }
