import {
  ValidationError,
  email,
  enforceBasicRateLimit,
  getPool,
  ipHash,
  longText,
  readJson,
  sendJson,
  stringArray,
  text,
  userAgent,
} from './_db.js';

const allowedAreas = [
  'founding-board',
  'advisor',
  'research',
  'conference',
  'education',
  'cybersecurity',
  'fundraising',
  'volunteer',
];

const roleMap = {
  'founding-board': 'board_member',
  advisor: 'advisor',
  research: 'researcher',
  fundraising: 'donor',
  volunteer: 'volunteer',
};

function foundationRoles(role, interestAreas) {
  const haystack = `${role || ''} ${interestAreas.join(' ')}`.toLowerCase();
  const roles = new Set(interestAreas.map((area) => roleMap[area]).filter(Boolean));
  if (/donor|fund|grant|philanthrop|sponsor/.test(haystack)) roles.add('donor');
  if (/board|director|governance/.test(haystack)) roles.add('board_member');
  if (/member|join|community/.test(haystack)) roles.add('member');
  if (!roles.size) roles.add('member');
  return [...roles];
}

async function submitToFoundationCapture({ name, email, organization, role, interestAreas, message, userAgent }) {
  const noteParts = [];
  if (role) noteParts.push(`Role/background: ${role}`);
  if (interestAreas.length) noteParts.push(`Areas: ${interestAreas.join(', ')}`);
  if (message) noteParts.push(`Message: ${message}`);

  const response = await fetch(process.env.GBF_CAPTURE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': userAgent || 'guardianbuilder.org/api/interest',
    },
    body: JSON.stringify({
      name,
      email,
      organization,
      roles: foundationRoles(role, interestAreas),
      note: noteParts.join('\n\n'),
      contribution_interest: interestAreas.join(', '),
      consent_to_contact: true,
      source: 'guardianbuilder.org/api/interest',
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) {
    throw new Error(result.error || 'Foundation capture service unavailable');
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
  }

  try {
    const body = await readJson(req);

    if (body.website) {
      return sendJson(res, 200, { ok: true });
    }

    const name = text(body.name, 120, true);
    const contactEmail = email(body.email, true);
    const organization = text(body.organization, 180, false);
    const role = text(body.role, 180, false);
    const interestAreas = stringArray(body.interestAreas, allowedAreas);
    const message = longText(body.message, 3000, false);
    const consentToContact = body.consentToContact === true;

    if (!consentToContact) {
      throw new ValidationError('Please consent to being contacted about Guardian Builder.');
    }

    const hash = ipHash(req);
    if (!process.env.GBF_CAPTURE_URL) {
      await enforceBasicRateLimit('interest_submissions', hash);
    }

    if (process.env.GBF_CAPTURE_URL) {
      await submitToFoundationCapture({
        name,
        email: contactEmail,
        organization,
        role,
        interestAreas,
        message,
        userAgent: userAgent(req),
      });
    } else {
      const pool = getPool();
      await pool.query(
        `insert into interest_submissions
          (name, email, organization, role, interest_areas, message, consent_to_contact, ip_hash, user_agent)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [name, contactEmail, organization, role, interestAreas, message, consentToContact, hash, userAgent(req)],
      );
    }

    return sendJson(res, 200, { ok: true, message: 'Thank you. Your interest has been recorded.' });
  } catch (error) {
    if (error instanceof ValidationError || error instanceof SyntaxError) {
      return sendJson(res, 400, { ok: false, error: error.message || 'Invalid submission.' });
    }
    console.error(error);
    return sendJson(res, 500, { ok: false, error: 'The form is temporarily unavailable.' });
  }
}
