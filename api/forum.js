import {
  ValidationError,
  email,
  enforceBasicRateLimit,
  getPool,
  ipHash,
  longText,
  readJson,
  sendJson,
  text,
  userAgent,
} from './_db.js';

const allowedTopics = new Set(['general', 'personhood', 'care', 'cybersecurity', 'conference', 'education']);

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const pool = getPool();
      const { rows } = await pool.query(
        `select id, created_at, author_name, title, body, topic
         from forum_posts
         where status = 'approved'
         order by approved_at desc nulls last, created_at desc
         limit 50`,
      );
      return sendJson(res, 200, { ok: true, posts: rows });
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
    }

    const body = await readJson(req);

    if (body.website) {
      return sendJson(res, 200, { ok: true });
    }

    const authorName = text(body.authorName, 120, true);
    const authorEmail = email(body.authorEmail, false);
    const title = text(body.title, 160, true);
    const postBody = longText(body.body, 5000, true);
    const topic = allowedTopics.has(body.topic) ? body.topic : 'general';

    const hash = ipHash(req);
    await enforceBasicRateLimit('forum_posts', hash);

    const pool = getPool();
    await pool.query(
      `insert into forum_posts
        (author_name, author_email, title, body, topic, ip_hash, user_agent)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [authorName, authorEmail, title, postBody, topic, hash, userAgent(req)],
    );

    return sendJson(res, 200, {
      ok: true,
      message: 'Thank you. Your post was received and will appear after moderation.',
    });
  } catch (error) {
    if (error instanceof ValidationError || error instanceof SyntaxError) {
      return sendJson(res, 400, { ok: false, error: error.message || 'Invalid submission.' });
    }
    console.error(error);
    return sendJson(res, 500, { ok: false, error: 'The forum is temporarily unavailable.' });
  }
}
