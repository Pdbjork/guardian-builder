/**
 * Hayden LinkedIn posting endpoint (official OAuth only).
 *
 * Env:
 *   HAYDEN_POSTING_TOKEN       — shared secret for Hayden → this API
 *   LINKEDIN_ACCESS_TOKEN      — member or org-capable OAuth access token
 *   LINKEDIN_PERSON_URN        — urn:li:person:… (personal posts)
 *   LINKEDIN_ORGANIZATION_URN  — urn:li:organization:… (company posts)
 *   LINKEDIN_DEFAULT_TARGET    — personal | organization | both (default: personal)
 *   LINKEDIN_VERSION           — Rest.li version header (default 202505)
 *
 * Body:
 *   { "text": "...", "target": "personal"|"organization"|"both", "dryRun": true }
 */

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function optionalEnv(name) {
  return process.env[name] || '';
}

function validatePostText(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new Error('Post text is required.');
  if (text.length > 2900) throw new Error('Post text is too long for LinkedIn.');
  return text;
}

function restPostPayload(authorUrn, text) {
  return {
    author: authorUrn,
    commentary: text,
    visibility: 'PUBLIC',
    distribution: {
      feedDistribution: 'MAIN_FEED',
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  };
}

function ugcPayload(authorUrn, text) {
  return {
    author: authorUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        shareMediaCategory: 'NONE',
      },
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
    },
  };
}

async function postToLinkedIn(accessToken, authorUrn, text) {
  const version = optionalEnv('LINKEDIN_VERSION') || '202505';
  const restRes = await fetch('https://api.linkedin.com/rest/posts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
      'LinkedIn-Version': version,
    },
    body: JSON.stringify(restPostPayload(authorUrn, text)),
  });
  const restText = await restRes.text();
  if (restRes.ok) {
    return {
      ok: true,
      api: 'rest/posts',
      status: restRes.status,
      id: restRes.headers.get('x-restli-id') || null,
      body: restText || null,
    };
  }

  const ugcRes = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(ugcPayload(authorUrn, text)),
  });
  const ugcText = await ugcRes.text();
  if (!ugcRes.ok) {
    const err = new Error('LinkedIn rejected the post.');
    err.details = {
      rest: { status: restRes.status, body: restText.slice(0, 500) },
      ugc: { status: ugcRes.status, body: ugcText.slice(0, 500) },
    };
    throw err;
  }
  return {
    ok: true,
    api: 'v2/ugcPosts',
    status: ugcRes.status,
    body: ugcText || null,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
  }

  try {
    const expectedToken = requireEnv('HAYDEN_POSTING_TOKEN');
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${expectedToken}`) {
      return sendJson(res, 401, { ok: false, error: 'Unauthorized.' });
    }

    const accessToken = requireEnv('LINKEDIN_ACCESS_TOKEN');
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    const text = validatePostText(body.text);
    const target = String(
      body.target || optionalEnv('LINKEDIN_DEFAULT_TARGET') || 'personal'
    ).toLowerCase();

    const personUrn = optionalEnv('LINKEDIN_PERSON_URN');
    const orgUrn = optionalEnv('LINKEDIN_ORGANIZATION_URN');

    const authors = [];
    if (target === 'personal' || target === 'both') {
      if (!personUrn.startsWith('urn:li:person:')) {
        throw new Error(
          'LINKEDIN_PERSON_URN is not configured (urn:li:person:…). Required for personal posts.'
        );
      }
      authors.push({ kind: 'personal', urn: personUrn });
    }
    if (target === 'organization' || target === 'both') {
      if (!orgUrn.startsWith('urn:li:organization:')) {
        throw new Error(
          'LINKEDIN_ORGANIZATION_URN is not configured. Required for company posts.'
        );
      }
      authors.push({ kind: 'organization', urn: orgUrn });
    }
    if (!authors.length) {
      throw new Error(`Unknown target: ${target}`);
    }

    if (body.dryRun === true) {
      return sendJson(res, 200, {
        ok: true,
        dryRun: true,
        target,
        authors: authors.map((a) => a.urn),
        text,
      });
    }

    const results = [];
    for (const a of authors) {
      const posted = await postToLinkedIn(accessToken, a.urn, text);
      results.push({ ...a, ...posted });
    }

    return sendJson(res, 200, { ok: true, target, results });
  } catch (error) {
    console.error(error);
    return sendJson(res, error.details ? 502 : 500, {
      ok: false,
      error: error.message || 'Posting failed.',
      details: error.details || undefined,
    });
  }
}
