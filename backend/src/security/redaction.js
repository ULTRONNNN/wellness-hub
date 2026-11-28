// Basic personal information redaction.
// This is not guaranteed anonymization.

export function redactPersonalInfo(text) {
  if (typeof text !== 'string') {
    throw new Error('Invalid report text');
  }

  let cleaned = text;

  // Remove email addresses
  cleaned = cleaned.replace(
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    '[EMAIL REMOVED]'
  );

  // Remove Indian mobile numbers
  cleaned = cleaned.replace(
    /(?<!\d)(?:\+91[\s-]?)?[6-9]\d{9}(?!\d)/g,
    '[PHONE REMOVED]'
  );

  // Remove Aadhaar-like numbers
  cleaned = cleaned.replace(
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    '[IDENTIFIER REMOVED]'
  );

  // Remove labeled personal information
  cleaned = cleaned.replace(
    /^[ \t]*(?:patient\s*name|name|address|patient\s*id|report\s*id|hospital\s*id|date\s*of\s*birth|dob|uhid|mrn)\s*:[^\r\n]*/gim,
    '[PERSONAL INFORMATION REMOVED]'
  );

  return cleaned.trim();
}