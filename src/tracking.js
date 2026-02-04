const db = require('./db');
const crypto = require('crypto');

function getDeviceType(userAgent) {
  if (/mobile/i.test(userAgent)) return 'mobile';
  if (/tablet/i.test(userAgent)) return 'tablet';
  return 'desktop';
}

function anonymizeIP(ip) {
  if (!ip) return 'unknown';
  // Anonymise en gardant les 3 premiers octets
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
  }
  return ip.substring(0, ip.length - 4) + 'xxxx';
}

function trackingMiddleware(req, res, next) {
  // Skip pour les assets et API
  if (req.path.startsWith('/api') || 
      req.path.startsWith('/admin') ||
      req.path.includes('.')) {
    return next();
  }

  const sessionId = req.cookies?.session_id || crypto.randomUUID();
  
  // Set cookie si pas présent
  if (!req.cookies?.session_id) {
    res.cookie('session_id', sessionId, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24h
    });
  }

  const visit = {
    utm_source: req.query.utm_source || 'direct',
    ip: anonymizeIP(req.ip || req.connection?.remoteAddress),
    user_agent: req.get('User-Agent') || 'unknown',
    referrer: req.get('Referrer') || 'direct',
    page_path: req.path,
    device_type: getDeviceType(req.get('User-Agent') || ''),
    session_id: sessionId
  };

  try {
    const stmt = db.prepare(`
      INSERT INTO visits (utm_source, ip, user_agent, referrer, page_path, device_type, session_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      visit.utm_source,
      visit.ip,
      visit.user_agent,
      visit.referrer,
      visit.page_path,
      visit.device_type,
      visit.session_id
    );
  } catch (err) {
    console.error('Tracking error:', err);
  }

  req.sessionId = sessionId;
  next();
}

function updateDuration(sessionId, duration) {
  try {
    const stmt = db.prepare(`
      UPDATE visits 
      SET duration = ?
      WHERE session_id = ? 
      AND id = (SELECT MAX(id) FROM visits WHERE session_id = ?)
    `);
    stmt.run(duration, sessionId, sessionId);
  } catch (err) {
    console.error('Duration update error:', err);
  }
}

module.exports = { trackingMiddleware, updateDuration };
