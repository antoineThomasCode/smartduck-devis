const express = require('express');
const db = require('./db');

const router = express.Router();

// Middleware auth simple
function authMiddleware(req, res, next) {
  const authCookie = req.cookies?.admin_auth;
  if (authCookie === process.env.ADMIN_PASSWORD) {
    return next();
  }
  
  // Si c'est une requête API, renvoyer 401
  if (req.path.startsWith('/api')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Sinon afficher le formulaire de login
  res.send(getLoginPage());
}

// Login
router.post('/login', express.urlencoded({ extended: true }), (req, res) => {
  const { password } = req.body;
  
  if (password === process.env.ADMIN_PASSWORD) {
    res.cookie('admin_auth', password, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 jours
    });
    return res.redirect('/admin');
  }
  
  res.send(getLoginPage('Mot de passe incorrect'));
});

// Dashboard
router.get('/', authMiddleware, (req, res) => {
  res.send(getDashboardPage());
});

// API: Liste des visites
router.get('/api/visits', authMiddleware, (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const utm = req.query.utm;
  
  let query = 'SELECT * FROM visits';
  const params = [];
  
  if (utm) {
    query += ' WHERE utm_source = ?';
    params.push(utm);
  }
  
  query += ' ORDER BY timestamp DESC LIMIT ?';
  params.push(limit);
  
  const visits = db.prepare(query).all(...params);
  res.json(visits);
});

// API: Stats
router.get('/api/stats', authMiddleware, (req, res) => {
  const totalViews = db.prepare('SELECT COUNT(*) as count FROM visits').get();
  const uniqueVisitors = db.prepare('SELECT COUNT(DISTINCT session_id) as count FROM visits').get();
  const avgDuration = db.prepare('SELECT AVG(duration) as avg FROM visits WHERE duration > 0').get();
  const lastVisit = db.prepare('SELECT timestamp FROM visits ORDER BY timestamp DESC LIMIT 1').get();
  const bySource = db.prepare(`
    SELECT utm_source, COUNT(*) as count 
    FROM visits 
    GROUP BY utm_source 
    ORDER BY count DESC
  `).all();
  
  res.json({
    totalViews: totalViews.count,
    uniqueVisitors: uniqueVisitors.count,
    avgDuration: Math.round(avgDuration?.avg || 0),
    lastVisit: lastVisit?.timestamp,
    bySource
  });
});

// Logout
router.get('/logout', (req, res) => {
  res.clearCookie('admin_auth');
  res.redirect('/admin');
});

function getLoginPage(error = '') {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin - SmartDuck Devis</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      background: #0a0a0a;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .login-box {
      background: #141414;
      padding: 40px;
      border-radius: 16px;
      width: 100%;
      max-width: 360px;
    }
    h1 {
      color: #fff;
      font-size: 24px;
      margin-bottom: 8px;
    }
    .subtitle {
      color: #71717a;
      font-size: 14px;
      margin-bottom: 24px;
    }
    input {
      width: 100%;
      padding: 12px 16px;
      border: 1px solid #27272a;
      border-radius: 8px;
      background: #0a0a0a;
      color: #fff;
      font-size: 14px;
      margin-bottom: 16px;
    }
    input:focus {
      outline: none;
      border-color: #6366f1;
    }
    button {
      width: 100%;
      padding: 12px;
      background: #E63946;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
    button:hover {
      background: #d63340;
    }
    .error {
      color: #E63946;
      font-size: 13px;
      margin-bottom: 16px;
    }
  </style>
</head>
<body>
  <div class="login-box">
    <h1>Admin</h1>
    <p class="subtitle">SmartDuck × Cohorte Devis</p>
    ${error ? `<p class="error">${error}</p>` : ''}
    <form method="POST" action="/admin/login">
      <input type="password" name="password" placeholder="Mot de passe" autofocus>
      <button type="submit">Connexion</button>
    </form>
  </div>
</body>
</html>
  `;
}

function getDashboardPage() {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin - SmartDuck Devis</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      background: #0a0a0a;
      color: #fff;
      min-height: 100vh;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 40px;
      border-bottom: 1px solid #1a1a1a;
    }
    .header h1 {
      font-size: 18px;
      font-weight: 600;
    }
    .header h1 span {
      color: #E63946;
    }
    .logout {
      color: #71717a;
      text-decoration: none;
      font-size: 13px;
    }
    .logout:hover {
      color: #fff;
    }
    .container {
      max-width: 1000px;
      margin: 0 auto;
      padding: 40px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 40px;
    }
    .stat-card {
      background: #141414;
      padding: 24px;
      border-radius: 12px;
      text-align: center;
    }
    .stat-value {
      font-size: 32px;
      font-weight: 700;
      color: #fff;
      margin-bottom: 4px;
    }
    .stat-label {
      font-size: 12px;
      color: #71717a;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .section-title {
      font-size: 14px;
      font-weight: 600;
      color: #71717a;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 16px;
    }
    .visits-table {
      width: 100%;
      background: #141414;
      border-radius: 12px;
      overflow: hidden;
    }
    .visits-table th,
    .visits-table td {
      padding: 14px 16px;
      text-align: left;
      font-size: 13px;
    }
    .visits-table th {
      background: #1a1a1a;
      color: #71717a;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-size: 11px;
    }
    .visits-table tr:not(:last-child) td {
      border-bottom: 1px solid #1a1a1a;
    }
    .utm-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 100px;
      font-size: 11px;
      font-weight: 600;
    }
    .utm-herve { background: #E63946; color: #fff; }
    .utm-aurelien { background: #6366f1; color: #fff; }
    .utm-antoine { background: #22c55e; color: #fff; }
    .utm-direct { background: #27272a; color: #71717a; }
    .device-badge {
      color: #71717a;
    }
    .duration {
      color: #71717a;
    }
    .refresh-btn {
      background: #1a1a1a;
      border: none;
      color: #fff;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
      margin-bottom: 16px;
    }
    .refresh-btn:hover {
      background: #27272a;
    }
    @media (max-width: 768px) {
      .stats-grid {
        grid-template-columns: repeat(2, 1fr);
      }
      .container {
        padding: 20px;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Smart<span>Duck</span> × Cohorte — Admin</h1>
    <a href="/admin/logout" class="logout">Déconnexion</a>
  </div>
  
  <div class="container">
    <div class="stats-grid" id="stats">
      <div class="stat-card">
        <div class="stat-value" id="total-views">-</div>
        <div class="stat-label">Vues totales</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" id="unique-visitors">-</div>
        <div class="stat-label">Visiteurs uniques</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" id="avg-duration">-</div>
        <div class="stat-label">Durée moyenne</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" id="last-visit">-</div>
        <div class="stat-label">Dernière visite</div>
      </div>
    </div>

    <button class="refresh-btn" onclick="loadData()">🔄 Rafraîchir</button>
    
    <h2 class="section-title">Visites récentes</h2>
    <table class="visits-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Source</th>
          <th>Device</th>
          <th>Durée</th>
          <th>Scroll</th>
          <th>Chat</th>
        </tr>
      </thead>
      <tbody id="visits-list">
        <tr><td colspan="4" style="text-align: center; color: #71717a;">Chargement...</td></tr>
      </tbody>
    </table>
  </div>

  <script>
    async function loadData() {
      // Load stats
      const statsRes = await fetch('/admin/api/stats');
      const stats = await statsRes.json();
      
      document.getElementById('total-views').textContent = stats.totalViews;
      document.getElementById('unique-visitors').textContent = stats.uniqueVisitors;
      document.getElementById('avg-duration').textContent = formatDuration(stats.avgDuration);
      document.getElementById('last-visit').textContent = stats.lastVisit ? timeAgo(new Date(stats.lastVisit)) : 'Aucune';
      
      // Load visits
      const visitsRes = await fetch('/admin/api/visits?limit=20');
      const visits = await visitsRes.json();
      
      const tbody = document.getElementById('visits-list');
      tbody.innerHTML = visits.map(v => \`
        <tr>
          <td>\${formatDate(v.timestamp)}</td>
          <td><span class="utm-badge utm-\${v.utm_source}">\${v.utm_source}</span></td>
          <td class="device-badge">\${v.device_type}</td>
          <td class="duration">\${formatDuration(v.duration)}</td>
          <td>\${v.max_scroll ? v.max_scroll + '%' : '-'}</td>
          <td>\${v.chat_used ? '💬' : '-'}</td>
        </tr>
      \`).join('');
    }
    
    function formatDuration(seconds) {
      if (!seconds) return '-';
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return \`\${mins}m \${secs}s\`;
    }
    
    function formatDate(dateStr) {
      const date = new Date(dateStr);
      return date.toLocaleDateString('fr-FR', { 
        day: '2-digit', 
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    
    function timeAgo(date) {
      const seconds = Math.floor((new Date() - date) / 1000);
      if (seconds < 60) return 'À l\\'instant';
      if (seconds < 3600) return \`Il y a \${Math.floor(seconds / 60)}min\`;
      if (seconds < 86400) return \`Il y a \${Math.floor(seconds / 3600)}h\`;
      return \`Il y a \${Math.floor(seconds / 86400)}j\`;
    }
    
    loadData();
    // Auto-refresh toutes les 30s
    setInterval(loadData, 30000);
  </script>
</body>
</html>
  `;
}

module.exports = router;
