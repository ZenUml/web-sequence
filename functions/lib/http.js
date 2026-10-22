// Shared request handling for the HTTP functions (#862): one way to read and
// verify the caller's ID token, and one way to turn failures into a JSON
// { error } response with the right status.

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Authorization: Bearer <token> first. A raw Authorization header (legacy
// /authenticate callers) and body.token (legacy app + web create-share) are
// accepted while callers migrate.
function readToken(req) {
  const header = req.get('Authorization');
  if (header) return header.startsWith('Bearer ') ? header.slice('Bearer '.length) : header;
  return req.body?.token || null;
}

const EMULATOR_TOKEN = 'local-dev-token';

async function requireUser(req, { verify, emulator = process.env.FUNCTIONS_EMULATOR === 'true' }) {
  const token = readToken(req);
  if (!token) throw new HttpError(401, 'Missing ID token');
  if (emulator && token === EMULATOR_TOKEN) return { uid: 'local-test-user' };
  try {
    return await verify(token);
  } catch {
    throw new HttpError(401, 'Invalid or expired ID token');
  }
}

function handler(fn, { fallbackMessage = 'Internal error' } = {}) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (error) {
      if (res.headersSent) return;
      if (error instanceof HttpError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      console.error(fallbackMessage, error);
      res.status(500).json({ error: fallbackMessage });
    }
  };
}

module.exports = { HttpError, readToken, requireUser, handler, EMULATOR_TOKEN };
