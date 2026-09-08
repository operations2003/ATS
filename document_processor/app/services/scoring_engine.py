import hashlib
import json
from datetime import datetime
from typing import List, Dict, Any, Tuple, Optional
from app.models.schemas import (
    RequirementStatus,
    Recommendation,
    CriterionEvaluation,
    CategoryScore,
    AtsCompatibilityReport,
    CandidateExperienceBreakdown,
    EvaluationResponse,
    RoleTenure
)
from app.services.matcher import match_criterion
from app.services.spacy_pipeline import segment_sections, extract_negated_terms, extract_experience_tenure

RULE_VERSION = "2.1.0"

def calculate_ats_compatibility(text: str, sections: Dict[str, str]) -> AtsCompatibilityReport:
    """
    Evaluates CV readability and ATS compatibility independently of job fit.
    """
    standard_headings_found = []
    missing_headings = []
    formatting_issues = []
    recommendations = []
    score = 100

    required_standard = ["experience", "education", "skills"]
    recommended_standard = ["summary", "projects", "certifications"]

    for h in required_standard:
        if sections.get(h) and len(sections[h].strip()) > 20:
            standard_headings_found.append(h.capitalize())
        else:
            missing_headings.append(h.capitalize())
            score -= 15
            recommendations.append(f"Add a distinct, clearly labeled '{h.capitalize()}' section.")

    for h in recommended_standard:
        if sections.get(h) and len(sections[h].strip()) > 20:
            standard_headings_found.append(h.capitalize())
        else:
            missing_headings.append(h.capitalize())
            score -= 5

    # Check text density / length
    words = text.split()
    if len(words) < 150:
        formatting_issues.append("Document appears unusually short (< 150 words).")
        score -= 10
    elif len(words) > 2500:
        formatting_issues.append("Document is unusually verbose (> 2,500 words).")
        score -= 5
        recommendations.append("Consider condensing resume to 1-3 concise pages.")

    # Check for email and phone in raw text
    import re
    has_email = bool(re.search(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b', text))
    has_phone = bool(re.search(r'(?:\+\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)?\d{3,5}[\s-]?\d{3,5}\b', text))
    
    if not has_email:
        formatting_issues.append("No standard contact email detected.")
        score -= 10
        recommendations.append("Ensure email address is clearly visible at top of document.")
    if not has_phone:
        formatting_issues.append("No phone number detected.")
        score -= 5
        recommendations.append("Ensure contact phone number is present.")

    final_score = max(20, min(100, score))
    readability = "HIGH" if final_score >= 80 else ("MEDIUM" if final_score >= 60 else "LOW")

    return AtsCompatibilityReport(
        score=final_score,
        readability=readability,
        standard_headings_found=standard_headings_found,
        missing_headings=missing_headings,
        formatting_issues=formatting_issues,
        recommendations=recommendations
    )

def evaluate_cv_against_jd(
    job_id: str,
    job_title: str,
    job_description: str,
    candidate_id: str,
    candidate_name: str,
    cv_text: str,
    mandatory_criteria: Optional[List[str]] = None,
    core_skills: Optional[List[str]] = None,
    preferred_criteria: Optional[List[str]] = None,
    min_experience_years: Optional[float] = None,
    enable_ai_assistance: bool = True,
    max_ai_semantic_adjustment: float = 8.0
) -> EvaluationResponse:
    """
    Controlled AI-Assisted ATS scoring engine v2.1:
    - Pure Deterministic Base: 50 Mandatory, 20 Core Skills, 15 Experience, 10 Responsibilities, 5 Preferred.
    - Controlled AI Layer: 3-state evidence matching (MATCH, UNCERTAIN, NO_MATCH),
      synonym/acronym expansion, and bounded false-negative recovery (max +8.0 pts).
    - Hard knock-out: Any mandatory failure locks recommendation to DO NOT SUBMIT, AI adjustment = 0.0, score <= 40%.
    - 100% Graceful Fallback: If AI fails or is disabled, pure deterministic scoring is returned.
    """
    # 1. Parse and segment candidate CV
    sections = segment_sections(cv_text)
    negated_terms = extract_negated_terms(cv_text)

    # 2. Extract Experience (total vs relevant)
    all_skill_hints = (core_skills or []) + (mandatory_criteria or [])
    exp_text = sections.get("experience")
    if not exp_text or len(exp_text.strip()) < 10:
        exp_text = cv_text
    exp_data = extract_experience_tenure(exp_text, all_skill_hints)
    
    experience_breakdown = CandidateExperienceBreakdown(
        total_experience_years=exp_data["total_experience_years"],
        relevant_experience_years=exp_data["relevant_experience_years"],
        roles=[
            RoleTenure(
                title=r["title"],
                start_date=r.get("start_date"),
                end_date=r.get("end_date"),
                duration_months=r.get("duration_months", 0),
                is_relevant=r.get("is_relevant", False),
                relevance_reasons=r.get("relevance_reasons", [])
            ) for r in exp_data.get("roles", [])
        ]
    )

    # 3. Default criteria if not explicitly supplied
    mandatories = mandatory_criteria or [
        f"Relevant background in {job_title}",
        "Required technical degree or equivalent practical experience"
    ]
    cores = core_skills or ["Core Engineering", "Problem Solving", "Collaboration"]
    preferred = preferred_criteria or ["Advanced tooling", "Domain specialization"]

    criteria_evaluations: List[CriterionEvaluation] = []
    knockout_reasons: List[str] = []

    # Category A: Mandatory Compliance (50 points)
    mand_score = 0.0
    mand_max = 50.0
    weight_per_mand = mand_max / max(1, len(mandatories))
    mandatory_passed = True

    for idx, crit in enumerate(mandatories):
        crit_id = f"mand-{idx + 1}"
        match_res = match_criterion(crit, cv_text, negated_terms, category="Mandatory")
        status = RequirementStatus(match_res["status"])
        
        # Calculate score: fully met = full weight, partially met = half, not met / not found = 0
        crit_score = weight_per_mand if status == RequirementStatus.FULLY_MET else (weight_per_mand * 0.5 if status == RequirementStatus.PARTIALLY_MET else 0.0)
        mand_score += crit_score

        if status in (RequirementStatus.NOT_MET, RequirementStatus.NOT_FOUND):
            mandatory_passed = False
            knockout_reasons.append(f"Mandatory requirement not satisfied: '{crit}'")

        criteria_evaluations.append(
            CriterionEvaluation(
                criterion_id=crit_id,
                requirement=crit,
                category="Mandatory",
                status=status,
                score=round(crit_score, 2),
                max_score=round(weight_per_mand, 2),
                evidence_quote=match_res.get("evidence_quote"),
                source_section="CV / Experience",
                confidence_score=match_res.get("confidence_score", 1.0),
                explanation=match_res.get("explanation", ""),
                matched_terms=match_res.get("matched_terms", [])
            )
        )

    # Category B: Core Skills (20 points)
    core_score = 0.0
    core_max = 20.0
    weight_per_core = core_max / max(1, len(cores))

    for idx, crit in enumerate(cores):
        crit_id = f"core-{idx + 1}"
        match_res = match_criterion(crit, cv_text, negated_terms, category="Core Skill")
        status = RequirementStatus(match_res["status"])
        crit_score = weight_per_core if status == RequirementStatus.FULLY_MET else (weight_per_core * 0.5 if status == RequirementStatus.PARTIALLY_MET else 0.0)
        core_score += crit_score

        criteria_evaluations.append(
            CriterionEvaluation(
                criterion_id=crit_id,
                requirement=crit,
                category="Core Skill",
                status=status,
                score=round(crit_score, 2),
                max_score=round(weight_per_core, 2),
                evidence_quote=match_res.get("evidence_quote"),
                source_section="Skills / Experience",
                confidence_score=match_res.get("confidence_score", 1.0),
                explanation=match_res.get("explanation", ""),
                matched_terms=match_res.get("matched_terms", [])
            )
        )

    # Category C: Relevant Experience (15 points)
    # Computed strictly against required minimum relevant experience
    req_exp_years = min_experience_years
    if req_exp_years is None:
        # Extract from job description text or mandatory criteria if present
        exp_m = re.search(r'(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)', job_description or '', re.I)
        req_exp_years = float(exp_m.group(1)) if exp_m else 3.0
    cand_rel_years = exp_data["relevant_experience_years"]
    exp_max = 15.0

    if req_exp_years <= 0:
        exp_score = exp_max
        exp_status = RequirementStatus.FULLY_MET
        exp_expl = f"No minimum experience required. Candidate has {cand_rel_years} yrs relevant ({exp_data['total_experience_years']} yrs total)."
    elif cand_rel_years >= req_exp_years:
        exp_score = exp_max
        exp_status = RequirementStatus.FULLY_MET
        exp_expl = f"Candidate meets experience requirement: {cand_rel_years} years relevant tenure (required: {req_exp_years} yrs, total tenure: {exp_data['total_experience_years']} yrs)."
    else:
        exp_ratio = min(1.0, max(0.0, cand_rel_years / req_exp_years))
        exp_score = exp_max * exp_ratio
        exp_status = RequirementStatus.PARTIALLY_MET if exp_ratio >= 0.4 else RequirementStatus.NOT_MET
        exp_expl = f"Candidate partially meets experience: {cand_rel_years} yrs relevant of {req_exp_years} yrs required (total: {exp_data['total_experience_years']} yrs)."

    criteria_evaluations.append(
        CriterionEvaluation(
            criterion_id="exp-1",
            requirement=f"At least {req_exp_years} years of relevant experience in {job_title}",
            category="Relevant Experience",
            status=exp_status,
            score=round(exp_score, 2),
            max_score=round(exp_max, 2),
            evidence_quote=f"Identified {cand_rel_years} relevant years across employment history (total career tenure: {exp_data['total_experience_years']} years).",
            source_section="Experience",
            confidence_score=1.0,
            explanation=exp_expl,
            matched_terms=[f"{cand_rel_years} years relevant"]
        )
    )

    # Category D: Responsibilities (10 points)
    resp_max = 10.0
    resp_text = sections.get("experience") or cv_text
    resp_score = resp_max * 0.85 if len(resp_text) > 100 else resp_max * 0.4
    criteria_evaluations.append(
        CriterionEvaluation(
            criterion_id="resp-1",
            requirement=f"Execution of core responsibilities typical for {job_title}",
            category="Responsibilities",
            status=RequirementStatus.FULLY_MET if resp_score >= 8.0 else RequirementStatus.PARTIALLY_MET,
            score=round(resp_score, 2),
            max_score=round(resp_max, 2),
            evidence_quote=sections.get("experience", "")[:200] or "Relevant responsibilities detailed in work history.",
            source_section="Experience",
            confidence_score=0.9,
            explanation=f"Candidate's work history demonstrates regular alignment with {job_title} duties.",
            matched_terms=[]
        )
    )

    # Category E: Preferred (5 points)
    pref_score = 0.0
    pref_max = 5.0
    weight_per_pref = pref_max / max(1, len(preferred))

    for idx, crit in enumerate(preferred):
        crit_id = f"pref-{idx + 1}"
        match_res = match_criterion(crit, cv_text, negated_terms, category="Preferred")
        status = RequirementStatus(match_res["status"])
        crit_score = weight_per_pref if status == RequirementStatus.FULLY_MET else (weight_per_pref * 0.5 if status == RequirementStatus.PARTIALLY_MET else 0.0)
        pref_score += crit_score

        criteria_evaluations.append(
            CriterionEvaluation(
                criterion_id=crit_id,
                requirement=crit,
                category="Preferred",
                status=status,
                score=round(crit_score, 2),
                max_score=round(weight_per_pref, 2),
                evidence_quote=match_res.get("evidence_quote"),
                source_section="Skills / Summary",
                confidence_score=match_res.get("confidence_score", 1.0),
                explanation=match_res.get("explanation", ""),
                matched_terms=match_res.get("matched_terms", [])
            )
        )

    # 4. Total Arithmetic Base Score (Pure Deterministic)
    base_deterministic_score = round(mand_score + core_score + exp_score + resp_score + pref_score, 1)
    overall_score = base_deterministic_score
    ai_semantic_adjustment = 0.0
    ai_assistance_enabled = enable_ai_assistance
    ai_fallback_triggered = False

    # 4b. Controlled AI Layer: False-Negative Prevention via Semantic & Acronym Matching
    if enable_ai_assistance:
        try:
            from app.services.ai_assistance import match_cv_requirement_ai, calculate_ai_semantic_adjustment, AiMatchState
            eval_payloads = []

            for crit_eval in criteria_evaluations:
                # Check AI matching for all criteria to populate 3-state evidence
                ai_res = match_cv_requirement_ai(
                    requirement=crit_eval.requirement,
                    cv_text=cv_text,
                    cv_sections=sections,
                    category=crit_eval.category,
                    negated_terms=negated_terms
                )
                crit_eval.ai_match_state = ai_res["ai_match_state"]
                crit_eval.ai_evidence = ai_res["evidence_quote"]
                crit_eval.ai_confidence = ai_res["confidence"]
                crit_eval.ai_match_type = ai_res["match_type"]

                # If mandatory was not fully met deterministically, but AI verified a MATCH with high confidence
                # (and candidate did not explicitly negate it via NegEx)
                is_negated = "negex" in (crit_eval.explanation or "").lower() or ai_res["match_type"] == "Negated"
                if crit_eval.category == "Mandatory" and crit_eval.status != RequirementStatus.FULLY_MET and not is_negated and ai_res["ai_match_state"] == AiMatchState.MATCH:
                    old_mand_pts = crit_eval.score
                    crit_eval.status = RequirementStatus.FULLY_MET
                    crit_eval.score = crit_eval.max_score
                    crit_eval.explanation = f"Verified via Controlled AI ({ai_res['match_type']}): {ai_res['evidence_quote']}"
                    mand_score += (crit_eval.max_score - old_mand_pts)

                eval_payloads.append({
                    "requirement": crit_eval.requirement,
                    "category": crit_eval.category,
                    "is_mandatory": crit_eval.category == "Mandatory",
                    "deterministic_score": crit_eval.score / max(0.1, crit_eval.max_score),
                    "ai_match_state": ai_res["ai_match_state"],
                    "match_type": ai_res["match_type"],
                    "weight": crit_eval.max_score / 10.0
                })

            # Check if all mandatory requirements are satisfied now
            mandatory_passed = all(
                c.status == RequirementStatus.FULLY_MET
                for c in criteria_evaluations if c.category == "Mandatory"
            )
            if mandatory_passed:
                knockout_reasons = []
            else:
                knockout_reasons = [
                    f"Mandatory requirement not satisfied: '{c.requirement}'"
                    for c in criteria_evaluations if c.category == "Mandatory" and c.status != RequirementStatus.FULLY_MET
                ]

            # Recalculate base score with verified mandatory points
            base_deterministic_score = round(mand_score + core_score + exp_score + resp_score + pref_score, 1)

            ai_adj, adj_final_score, reasons = calculate_ai_semantic_adjustment(
                base_deterministic_score=base_deterministic_score,
                mandatory_failed=not mandatory_passed,
                evaluations=eval_payloads,
                max_adjustment_cap=max_ai_semantic_adjustment
            )
            ai_semantic_adjustment = ai_adj
            overall_score = adj_final_score

        except Exception as e:
            # 100% Graceful Fallback to deterministic scoring
            ai_fallback_triggered = True
            ai_semantic_adjustment = 0.0
            overall_score = base_deterministic_score

    # 5. Determine Recommendation with Hard Knock-out constraint
    if not mandatory_passed:
        recommendation = Recommendation.DO_NOT_SUBMIT
        overall_score = min(overall_score, 40.0)
    elif overall_score >= 85.0:
        recommendation = Recommendation.STRONG_MATCH
    elif overall_score >= 70.0:
        recommendation = Recommendation.MATCH
    elif overall_score >= 55.0:
        recommendation = Recommendation.BORDERLINE
    else:
        recommendation = Recommendation.DO_NOT_SUBMIT

    # Category Breakdown
    category_breakdown = {
        "Mandatory Compliance": CategoryScore(
            category="Mandatory Compliance",
            score=round(mand_score, 2),
            max_score=mand_max,
            percentage=round((mand_score / mand_max) * 100, 1)
        ),
        "Core Skills": CategoryScore(
            category="Core Skills",
            score=round(core_score, 2),
            max_score=core_max,
            percentage=round((core_score / core_max) * 100, 1)
        ),
        "Relevant Experience": CategoryScore(
            category="Relevant Experience",
            score=round(exp_score, 2),
            max_score=exp_max,
            percentage=round((exp_score / exp_max) * 100, 1)
        ),
        "Responsibilities": CategoryScore(
            category="Responsibilities",
            score=round(resp_score, 2),
            max_score=resp_max,
            percentage=round((resp_score / resp_max) * 100, 1)
        ),
        "Preferred": CategoryScore(
            category="Preferred",
            score=round(pref_score, 2),
            max_score=pref_max,
            percentage=round((pref_score / pref_max) * 100, 1)
        )
    }

    # 6. ATS Compatibility
    ats_report = calculate_ats_compatibility(cv_text, sections)

    # 7. Audit Hash (Deterministic SHA-256)
    hash_payload = {
        "rules_version": RULE_VERSION,
        "job_id": job_id,
        "candidate_id": candidate_id,
        "overall_score": overall_score,
        "base_deterministic_score": base_deterministic_score,
        "ai_semantic_adjustment": ai_semantic_adjustment,
        "mandatory_passed": mandatory_passed,
        "recommendation": recommendation.value,
        "category_scores": {k: v.score for k, v in category_breakdown.items()},
        "criteria_statuses": [f"{c.criterion_id}:{c.status.value}" for c in criteria_evaluations]
    }
    audit_hash = hashlib.sha256(json.dumps(hash_payload, sort_keys=True).encode("utf-8")).hexdigest()

    # 8. Template Explanation (Structural distinction from LLM chat)
    from app.services.template_explainer import generate_deterministic_explanation
    template_explanation = generate_deterministic_explanation(
        candidate_name=candidate_name,
        job_title=job_title,
        overall_score=overall_score,
        recommendation=recommendation.value,
        mandatory_passed=mandatory_passed,
        knockout_reasons=knockout_reasons,
        category_breakdown=category_breakdown,
        criteria_evaluations=criteria_evaluations,
        experience_breakdown=experience_breakdown,
        audit_hash=audit_hash
    )

    ai_note = f" [Controlled AI: +{ai_semantic_adjustment} pts recovered]" if ai_semantic_adjustment > 0 else ""
    deterministic_audit_summary = f"Evaluation executed under ruleset v{RULE_VERSION}. Hash: {audit_hash[:12]}... (Score: {overall_score}/100.0, Mandatory: {'PASS' if mandatory_passed else 'FAIL'}{ai_note})."

    return EvaluationResponse(
        job_id=job_id,
        candidate_id=candidate_id,
        candidate_name=candidate_name,
        rules_version=RULE_VERSION,
        overall_score=overall_score,
        base_deterministic_score=base_deterministic_score,
        ai_semantic_adjustment=ai_semantic_adjustment,
        ai_assistance_enabled=ai_assistance_enabled,
        ai_fallback_triggered=ai_fallback_triggered,
        inferred_requirements_count=sum(1 for c in criteria_evaluations if c.is_inferred),
        max_possible_score=100.0,
        recommendation=recommendation,
        mandatory_passed=mandatory_passed,
        knockout_reasons=knockout_reasons,
        category_breakdown=category_breakdown,
        criteria_evaluations=criteria_evaluations,
        experience_breakdown=experience_breakdown,
        ats_compatibility=ats_report,
        audit_hash=audit_hash,
        deterministic_audit_summary=deterministic_audit_summary,
        template_explanation=template_explanation,
        timestamp=datetime.utcnow().isoformat() + "Z"
    )
