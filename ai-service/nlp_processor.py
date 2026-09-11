"""
NLP Processor — spaCy-free, Python 3.13 compatible
Uses regex + heuristics to extract functional components from FDD text:
- Functional requirements
- Entities (actors, data objects)
- Workflows
- Business rules
- System features
- Named entities (tech stack, integrations) via keyword lists
"""

import re
import logging
from typing import Dict, List

logger = logging.getLogger(__name__)

# ── Requirement signal phrases ────────────────────────────────────────
REQUIREMENT_PATTERNS = [
    r"(?:the system|system)\s+(?:shall|should|must|will|can)\s+[^.]+\.",
    r"(?:users?|admin|actor|role)\s+(?:shall|should|must|will|can|are able to)\s+[^.]+\.",
    r"(?:the application|application|platform)\s+(?:shall|should|must|will)\s+[^.]+\.",
    r"(?:it\s+(?:shall|should|must|will))\s+[^.]+\.",
    r"FR-\d+\s*:?\s*[^.\n]+\.",
    r"(?:instructors?|students?|admins?)\s+(?:shall|should|must|will|can)\s+[^.]+\.",
]

# ── Workflow/process signal words ─────────────────────────────────────
WORKFLOW_PATTERNS = [
    r"(?:process|flow|workflow|procedure|steps?|sequence)\s*:?\s*([^.]+\.)",
    r"(?:when|if|after|once|upon)\s+[^,]+,\s*(?:the system|system|user)\s+[^.]+\.",
    r"step\s+\d+\s*:?\s*[^.]+\.",
]

# ── Business rule patterns ────────────────────────────────────────────
BUSINESS_RULE_PATTERNS = [
    r"(?:rule|constraint|policy|regulation|compliance)\s*:?\s*([^.]+\.)",
    r"(?:must not|cannot|should not|shall not)\s+[^.]+\.",
    r"(?:only|exclusively|at least|at most|maximum|minimum)\s+[^.]+\.",
    r"BR-\d+\s*:?\s*[^.\n]+\.",
]

# ── Actor/role patterns ───────────────────────────────────────────────
ACTOR_PATTERNS = [
    r"\b(admin(?:istrator)?s?|users?|customers?|managers?|operators?|superusers?|"
    r"guests?|members?|staff|employees?|clients?|vendors?|suppliers?|"
    r"instructors?|students?|teachers?|buyers?|sellers?)\b",
]

# ── Feature/module patterns ───────────────────────────────────────────
FEATURE_PATTERNS = [
    r"(?:feature|module|component|function(?:ality)?|capability|service)\s*:?\s*([^.]+\.)",
    r"(?:the\s+)?(\w+)\s+(?:module|feature|component|service)\b",
]

# ── Known technology keywords for lightweight "NER" ──────────────────
TECH_KEYWORDS = {
    "databases":    ["postgresql", "mysql", "mongodb", "sqlite", "redis", "dynamodb",
                     "cassandra", "oracle", "mssql", "mariadb", "elasticsearch"],
    "cloud":        ["aws", "azure", "gcp", "google cloud", "heroku", "digitalocean",
                     "cloudflare", "s3", "ec2", "lambda", "ecs", "eks", "rds"],
    "frameworks":   ["react", "angular", "vue", "next.js", "express", "django", "flask",
                     "fastapi", "spring", "laravel", "rails", "nestjs", "node.js",
                     "nodejs", "fastapi", ".net", "asp.net"],
    "languages":    ["python", "javascript", "typescript", "java", "c#", "go", "rust",
                     "kotlin", "swift", "php", "ruby", "scala"],
    "integrations": ["stripe", "paypal", "twilio", "sendgrid", "firebase", "auth0",
                     "okta", "oauth", "jwt", "graphql", "rest", "grpc", "kafka",
                     "rabbitmq", "sqs", "sns", "ses"],
    "devops":       ["docker", "kubernetes", "jenkins", "github actions", "gitlab ci",
                     "terraform", "ansible", "nginx", "apache"],
}


def extract_with_patterns(text: str, patterns: List[str]) -> List[str]:
    """Extract sentences matching any of the provided regex patterns."""
    results = []
    for pattern in patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        for m in matches:
            clean = m.strip() if isinstance(m, str) else m[0].strip()
            if clean and len(clean) > 10 and clean not in results:
                results.append(clean)
    return results


def extract_tech_entities(text: str) -> Dict[str, List[str]]:
    """
    Lightweight keyword-based 'NER' for technology terms.
    Replaces spaCy NER — no external models required.
    """
    text_lower = text.lower()
    found: Dict[str, List[str]] = {cat: [] for cat in TECH_KEYWORDS}

    for category, keywords in TECH_KEYWORDS.items():
        for kw in keywords:
            # Match as whole word/phrase
            pattern = r"\b" + re.escape(kw) + r"\b"
            if re.search(pattern, text_lower):
                found[category].append(kw)

    return found


def extract_actors(text: str) -> List[str]:
    """Extract system actors/roles from text, normalized to singular."""
    actors = set()
    for pattern in ACTOR_PATTERNS:
        matches = re.findall(pattern, text, re.IGNORECASE)
        for m in matches:
            norm = m.lower().strip()
            # Singularize simple plurals (students→student, users→user)
            if norm.endswith("s") and norm not in ("staff", "sales", "lass"):
                singular = norm[:-1]
                if len(singular) >= 4:
                    norm = singular
            actors.add(norm)
    return sorted(list(actors))


def extract_data_entities(text: str) -> List[str]:
    """Heuristically extract data entities from verb-noun patterns."""
    patterns = [
        r"(?:create|manage|store|retrieve|update|delete|list|view|search|upload|download)"
        r"\s+(?:a\s+|an\s+|the\s+)?(\w+(?:\s+\w+)?)",
        r"(\w+)\s+(?:table|record|entity|object|model|schema|database)",
        r"(?:table|entity|model)\s*:?\s*(\w+)",
        r"(\w+)\s+(?:data|information|details|profile|record)s?\b",
    ]
    stopwords = {"the", "a", "an", "its", "their", "this", "that", "new",
                 "all", "any", "some", "each", "user", "system"}
    entities = set()
    for pattern in patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        for m in matches:
            val = (m.strip() if isinstance(m, str) else m[0].strip()).lower()
            if val and len(val) > 2 and val not in stopwords:
                entities.add(val)
    return sorted(list(entities))


def extract_sections(text: str) -> List[Dict]:
    """Extract document sections by detecting heading-like lines."""
    sections = []
    lines = text.split("\n")
    current_section = None
    current_content = []

    heading_pattern = re.compile(
        r"^(#{1,4}\s+.+|[A-Z][A-Z\s]{3,50}:?$|\d+\.\d*\s+[A-Z].+)",
        re.MULTILINE
    )

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if heading_pattern.match(stripped) and len(stripped) < 100:
            if current_section:
                sections.append({
                    "heading": current_section,
                    "content": " ".join(current_content).strip()[:500]
                })
            current_section = stripped
            current_content = []
        else:
            current_content.append(stripped)

    if current_section:
        sections.append({
            "heading": current_section,
            "content": " ".join(current_content).strip()[:500]
        })

    return sections[:25]


def extract_nfrs(text: str) -> List[str]:
    """Extract non-functional requirement statements."""
    nfr_patterns = [
        r"NFR-\d+\s*:?\s*[^.\n]+\.",
        r"(?:the system|system)\s+(?:shall|must|should)\s+(?:support|handle|provide|ensure|maintain)\s+[^.]+\.",
        r"(?:response time|latency|uptime|availability|performance|scalability|security|reliability)"
        r"\s+(?:shall|must|should|will)\s+[^.]+\.",
        r"(?:up to|at least|no more than|within|less than)\s+\d+[^.]+\.",
    ]
    return extract_with_patterns(text, nfr_patterns)[:10]


def extract_functional_components(text: str) -> Dict:
    """
    Full NLP pipeline — pure Python, no external ML models.
    Returns structured dict of all extracted functional components.
    """
    logger.info("Starting NLP extraction pipeline (spaCy-free)...")

    requirements  = extract_with_patterns(text, REQUIREMENT_PATTERNS)
    workflows     = extract_with_patterns(text, WORKFLOW_PATTERNS)
    business_rules= extract_with_patterns(text, BUSINESS_RULE_PATTERNS)
    actors        = extract_actors(text)
    features      = extract_with_patterns(text, FEATURE_PATTERNS)
    data_entities = extract_data_entities(text)
    tech_entities = extract_tech_entities(text)
    sections      = extract_sections(text)
    nfrs          = extract_nfrs(text)

    result = {
        "functional_requirements": requirements[:30],
        "workflows":               workflows[:20],
        "business_rules":          business_rules[:20],
        "actors":                  actors,
        "features":                features[:20],
        "data_entities":           data_entities[:30],
        "non_functional_requirements": nfrs,
        "tech_entities":           tech_entities,   # replaces ner_entities
        "ner_entities":            tech_entities,   # kept for backward compat
        "document_sections":       sections,
        "stats": {
            "requirements_found":   len(requirements),
            "workflows_found":      len(workflows),
            "business_rules_found": len(business_rules),
            "actors_found":         len(actors),
            "features_found":       len(features),
            "data_entities_found":  len(data_entities),
        }
    }

    logger.info(f"NLP extraction complete: {result['stats']}")
    return result
