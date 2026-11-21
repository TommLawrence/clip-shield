/**
 * ClipShield — universal sensitive-information taxonomy.
 *
 * CATEGORIES is the runtime metadata for every category the deterministic +
 * contextual detectors can emit. Each entry carries the placeholder prefix,
 * an exposure weight/severity, the taxonomy `group` it belongs to, and a
 * human label. Categories listed in TAXONOMY_GROUPS but absent from CATEGORIES
 * have no deterministic detector yet — they are surfaced for policy toggling,
 * custom-term protection and the local semantic layer, never silently.
 *
 * Nothing here classifies every monetary amount, name, date, location or
 * project number as sensitive. Sensitivity is resolved by detector confidence
 * and the active protection policy, with every finding kept reviewable.
 */

export const SEVERITY_ORDER = { critical: 4, high: 3, medium: 2, low: 1 };

export const PLACEHOLDER_PATTERN = /\[(?:[A-Z]+)_\d+\]/g;

export const GROUPS = {
  personal: "Personal identity & contact",
  credentials: "Credentials & authentication",
  financial: "Financial & commercial",
  healthcare: "Healthcare",
  education: "Education",
  technical: "Technical & infrastructure",
  business: "Business-confidential",
  legal: "Legal & regulatory",
};

export const CATEGORIES = {
  // Credentials & authentication — always masked in every policy.
  PRIVATE_KEY: { id: "PRIVATE_KEY", label: "Private key block", prefix: "PRIVATE_KEY", weight: 40, severity: "critical", group: "credentials" },
  AWS_KEY: { id: "AWS_KEY", label: "Cloud access key", prefix: "AWS_KEY", weight: 32, severity: "critical", group: "credentials" },
  SECRET: { id: "SECRET", label: "API key or secret", prefix: "SECRET", weight: 30, severity: "critical", group: "credentials" },
  BEARER: { id: "BEARER", label: "Bearer token", prefix: "BEARER", weight: 28, severity: "critical", group: "credentials" },
  JWT: { id: "JWT", label: "JSON web token", prefix: "JWT", weight: 26, severity: "high", group: "credentials" },
  VPN_CRED: { id: "VPN_CRED", label: "VPN / remote-access credential", prefix: "SECRET", weight: 30, severity: "critical", group: "credentials" },
  SVCACCT: { id: "SVCACCT", label: "Service account", prefix: "SVCACCT", weight: 16, severity: "high", group: "credentials" },

  // Personal identity & contact.
  PERSON: { id: "PERSON", label: "Personal name", prefix: "PERSON", weight: 14, severity: "medium", group: "personal" },
  EMAIL: { id: "EMAIL", label: "Email address", prefix: "EMAIL", weight: 12, severity: "medium", group: "personal" },
  PHONE: { id: "PHONE", label: "Phone number", prefix: "PHONE", weight: 10, severity: "medium", group: "personal" },
  ADDRESS: { id: "ADDRESS", label: "Physical address", prefix: "ADDRESS", weight: 12, severity: "medium", group: "personal" },
  DOB: { id: "DOB", label: "Date of birth", prefix: "DOB", weight: 12, severity: "medium", group: "personal" },
  GOV_ID: { id: "GOV_ID", label: "Government-issued identifier", prefix: "GOV_ID", weight: 18, severity: "high", group: "personal" },

  // Financial & commercial — validated identifiers are masked; pricing is not.
  IBAN: { id: "IBAN", label: "Bank account (IBAN)", prefix: "FINANCIAL_ID", weight: 20, severity: "high", group: "financial" },
  CARD: { id: "CARD", label: "Payment card number", prefix: "FINANCIAL_ID", weight: 22, severity: "high", group: "financial" },
  SALARY: { id: "SALARY", label: "Payroll / salary figure", prefix: "FINANCIAL_ID", weight: 16, severity: "high", group: "financial" },
  TAX_ID: { id: "TAX_ID", label: "Tax identifier", prefix: "FINANCIAL_ID", weight: 16, severity: "high", group: "financial" },
  FIN_REF: { id: "FIN_REF", label: "Financial account reference", prefix: "ACCOUNT", weight: 14, severity: "medium", group: "financial" },

  // Healthcare — contextual, require an explicit clinical label.
  PATIENT_ID: { id: "PATIENT_ID", label: "Patient identifier", prefix: "PATIENT_ID", weight: 16, severity: "high", group: "healthcare" },
  MRN: { id: "MRN", label: "Medical record number", prefix: "PATIENT_ID", weight: 16, severity: "high", group: "healthcare" },

  // Education — contextual, require an explicit admissions/student label.
  STUDENT_ID: { id: "STUDENT_ID", label: "Student / admission identifier", prefix: "STUDENT_ID", weight: 14, severity: "medium", group: "education" },

  // Technical & infrastructure.
  IPV4: { id: "IPV4", label: "IP address", prefix: "IPV4", weight: 6, severity: "low", group: "technical" },
  CIDR: { id: "CIDR", label: "Network range (CIDR)", prefix: "CIDR", weight: 8, severity: "low", group: "technical" },
  HOST: { id: "HOST", label: "Workstation / server identifier", prefix: "HOST", weight: 10, severity: "medium", group: "technical" },
  INFRA: { id: "INFRA", label: "Infrastructure / equipment identifier", prefix: "ASSET", weight: 12, severity: "medium", group: "technical" },
  SERIAL: { id: "SERIAL", label: "Hardware serial number", prefix: "ASSET", weight: 10, severity: "medium", group: "technical" },

  // Business-confidential.
  CUSTOM: { id: "CUSTOM", label: "Custom sensitive term", prefix: "CUSTOM", weight: 18, severity: "high", group: "business" },
  CUSTOMER_ID: { id: "CUSTOMER_ID", label: "Customer / supplier identifier", prefix: "ACCOUNT", weight: 12, severity: "medium", group: "business" },
  PROJECT_CODE: { id: "PROJECT_CODE", label: "Internal project / engagement code", prefix: "ACCOUNT", weight: 10, severity: "medium", group: "business" },
  CASE_ID: { id: "CASE_ID", label: "Case / matter identifier", prefix: "ACCOUNT", weight: 12, severity: "medium", group: "legal" },
  MANUAL: { id: "MANUAL", label: "Manually masked selection", prefix: "MANUAL", weight: 14, severity: "medium", group: "business" },
};

/**
 * Full classification taxonomy for policy configuration and UI. Categories
 * marked `deterministic: false` have no built-in detector; they are protected
 * through custom terms, the local semantic layer, or a strict policy that
 * masks anything a contextual detector surfaces.
 */
export const TAXONOMY_GROUPS = [
  {
    id: "personal",
    label: GROUPS.personal,
    categories: ["PERSON", "EMAIL", "PHONE", "ADDRESS", "DOB", "GOV_ID"],
  },
  {
    id: "credentials",
    label: GROUPS.credentials,
    categories: ["PRIVATE_KEY", "AWS_KEY", "SECRET", "BEARER", "JWT", "VPN_CRED", "SVCACCT"],
  },
  {
    id: "financial",
    label: GROUPS.financial,
    categories: ["IBAN", "CARD", "SALARY", "TAX_ID", "FIN_REF"],
  },
  {
    id: "healthcare",
    label: GROUPS.healthcare,
    categories: ["PATIENT_ID", "MRN"],
  },
  {
    id: "education",
    label: GROUPS.education,
    categories: ["STUDENT_ID"],
  },
  {
    id: "technical",
    label: GROUPS.technical,
    categories: ["IPV4", "CIDR", "HOST", "INFRA", "SERIAL"],
  },
  {
    id: "business",
    label: GROUPS.business,
    categories: ["CUSTOM", "CUSTOMER_ID", "PROJECT_CODE", "MANUAL"],
  },
  {
    id: "legal",
    label: GROUPS.legal,
    categories: ["CASE_ID"],
  },
];