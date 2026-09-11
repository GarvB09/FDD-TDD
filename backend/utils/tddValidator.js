/**
 * tddValidator.js
 * Validates and sanitizes the TDD JSON returned from the AI service
 * before storing or sending it to the frontend.
 */

const REQUIRED_SECTIONS = [
  "introduction",
  "system_architecture",
  "data_model",
  "api_design",
  "component_architecture",
  "non_functional_requirements",
  "deployment_architecture",
];

/**
 * Validate TDD structure and fill missing sections with empty defaults.
 * Returns { valid: boolean, warnings: string[], tdd: object }
 */
function validateAndSanitizeTDD(tdd) {
  if (!tdd || typeof tdd !== "object") {
    return {
      valid: false,
      warnings: ["TDD is null or not an object"],
      tdd: buildEmptyTDD(),
    };
  }

  const warnings = [];
  const sanitized = { ...tdd };

  // Check each required section
  for (const section of REQUIRED_SECTIONS) {
    if (!sanitized[section]) {
      warnings.push(`Missing section: ${section} — using empty default`);
      sanitized[section] = getDefaultSection(section);
    }
  }

  // Validate api_design.endpoints
  if (sanitized.api_design) {
    if (!Array.isArray(sanitized.api_design.endpoints)) {
      sanitized.api_design.endpoints = [];
      warnings.push("api_design.endpoints was not an array — reset to []");
    }
    // Ensure each endpoint has required fields
    sanitized.api_design.endpoints = sanitized.api_design.endpoints.map((ep) => ({
      method: ep.method || "GET",
      path: ep.path || "/unknown",
      description: ep.description || "",
      request_body: ep.request_body || "",
      response: ep.response || "",
      fdd_requirement: ep.fdd_requirement || "",
    }));
  }

  // Validate data_model.tables
  if (sanitized.data_model) {
    if (!Array.isArray(sanitized.data_model.tables)) {
      sanitized.data_model.tables = [];
      warnings.push("data_model.tables was not an array — reset to []");
    }
    sanitized.data_model.tables = sanitized.data_model.tables.map((t) => ({
      name: t.name || "unknown_table",
      purpose: t.purpose || "",
      columns: Array.isArray(t.columns) ? t.columns : [],
      relationships: Array.isArray(t.relationships) ? t.relationships : [],
    }));
  }

  // Validate traceability_matrix
  if (!Array.isArray(sanitized.traceability_matrix)) {
    sanitized.traceability_matrix = [];
    warnings.push("traceability_matrix was not an array — reset to []");
  }

  return {
    valid: warnings.length === 0,
    warnings,
    tdd: sanitized,
  };
}

function getDefaultSection(section) {
  const defaults = {
    introduction: {
      purpose: "",
      scope: "",
      assumptions: [],
      constraints: [],
      tech_stack: {},
    },
    system_architecture: {
      overview: "",
      architectural_pattern: "",
      components: [],
      communication: "",
      mermaid_diagram: "",
    },
    data_model: {
      overview: "",
      database_type: "",
      tables: [],
    },
    api_design: {
      overview: "",
      base_url: "/api/v1",
      authentication: "",
      endpoints: [],
    },
    component_architecture: {
      overview: "",
      frontend_components: [],
      backend_services: [],
    },
    non_functional_requirements: {
      performance: "",
      scalability: "",
      security: "",
      availability: "",
      maintainability: "",
    },
    deployment_architecture: {
      overview: "",
      environments: [],
      infrastructure: "",
      ci_cd: "",
      monitoring: "",
      mermaid_diagram: "",
    },
  };
  return defaults[section] || {};
}

function buildEmptyTDD() {
  const tdd = {};
  for (const section of REQUIRED_SECTIONS) {
    tdd[section] = getDefaultSection(section);
  }
  tdd.traceability_matrix = [];
  return tdd;
}

/**
 * Compute a completeness score (0–100) for a TDD object.
 * Useful for showing a quality indicator in the frontend.
 */
function computeCompletenessScore(tdd) {
  let score = 0;
  const checks = [
    tdd.introduction?.purpose?.length > 20,
    tdd.introduction?.scope?.length > 10,
    tdd.system_architecture?.components?.length > 0,
    tdd.system_architecture?.mermaid_diagram?.length > 10,
    tdd.data_model?.tables?.length > 0,
    tdd.api_design?.endpoints?.length > 0,
    tdd.component_architecture?.backend_services?.length > 0,
    tdd.non_functional_requirements?.security?.length > 10,
    tdd.deployment_architecture?.infrastructure?.length > 10,
    tdd.deployment_architecture?.mermaid_diagram?.length > 10,
    tdd.traceability_matrix?.length > 0,
  ];
  checks.forEach((c) => { if (c) score += Math.round(100 / checks.length); });
  return Math.min(score, 100);
}

module.exports = { validateAndSanitizeTDD, computeCompletenessScore };
