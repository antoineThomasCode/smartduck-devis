require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { trackingMiddleware } = require('./tracking');
const adminRouter = require('./admin');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Security
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      scriptSrcAttr: ["'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
    },
  },
}));

app.use(cookieParser());
app.use(express.json());

// Trust proxy (pour Traefik)
app.set('trust proxy', 1);

// Rate limiting pour le chat
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requêtes par fenêtre
  message: { error: 'Trop de requêtes, réessayez plus tard.' }
});

// Tracking middleware
app.use(trackingMiddleware);

// Admin routes
app.use('/admin', adminRouter);

// API: Update tracking data (beacon)
app.post('/api/track', (req, res) => {
  const { sessionId, duration, maxScroll, sectionsViewed, chatUsed } = req.body;
  if (sessionId) {
    try {
      const stmt = db.prepare(`
        UPDATE visits
        SET duration = COALESCE(?, duration),
            max_scroll = COALESCE(?, max_scroll),
            sections_viewed = COALESCE(?, sections_viewed),
            chat_used = COALESCE(?, chat_used)
        WHERE session_id = ?
        AND id = (SELECT MAX(id) FROM visits WHERE session_id = ?)
      `);
      stmt.run(
        duration ? Math.round(duration) : null,
        maxScroll || null,
        sectionsViewed ? JSON.stringify(sectionsViewed) : null,
        chatUsed ? 1 : 0,
        sessionId,
        sessionId
      );
    } catch (err) {
      console.error('Track update error:', err);
    }
  }
  res.status(204).end();
});

// API: Chatbot
app.post('/api/chat', chatLimiter, async (req, res) => {
  const { message, sessionId } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Message requis' });
  }

  // Log la question
  try {
    const logStmt = db.prepare('INSERT INTO chat_logs (session_id, role, message) VALUES (?, ?, ?)');
    logStmt.run(sessionId || 'anonymous', 'user', message);
  } catch (err) {
    console.error('Chat log error:', err);
  }

  // Si pas de clé API, réponse par défaut
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'sk-ant-xxxxx') {
    const defaultResponse = "Je suis l'assistant du devis SmartDuck. Pour toute question détaillée, contactez Antoine directement. Voici les infos principales : Option 1 (Standard) à 1200€ HT en 3-4 jours, Option 2 (Optimisée) à 1800€ HT en 5-6 jours avec tracking et analytics.";
    return res.json({ response: defaultResponse });
  }

  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const systemPrompt = `Tu es l'assistant du devis SmartDuck × Cohorte. Tu réponds aux questions sur ce devis d'intégration du système de réservation Booker.

Informations clés :
- Option 1 (Standard) : 1 200€ HT, délai 3-4 jours
  Inclus : Connexion API Booker, sélection centre, choix soin, calendrier temps réel, formulaire client, email confirmation, synchro Booker
  
- Option 2 (Tunnel Optimisé) : 1 800€ HT, délai 5-6 jours (RECOMMANDÉE)
  Inclus : Tout l'option 1 + Design UX travaillé, barre de progression, géolocalisation auto, tracking par étape, dashboard analytics, prêt pour A/B testing

Process : 
1. Choix de l'option (client)
2. Récupération credentials API (Pure Informatique) 
3. Développement et tests (Cohorte)
4. Validation ensemble
5. Mise en production

Antoine de Cohorte Agency gère le projet. Cohorte est spécialisé en AI-Augmented Development.

Sois concis, professionnel et amical. Si la question dépasse le cadre du devis, suggère de contacter Antoine directement.`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: 'user', content: message }]
    });

    const assistantMessage = response.content[0].text;

    // Log la réponse
    try {
      const logStmt = db.prepare('INSERT INTO chat_logs (session_id, role, message) VALUES (?, ?, ?)');
      logStmt.run(sessionId || 'anonymous', 'assistant', assistantMessage);
    } catch (err) {
      console.error('Chat log error:', err);
    }

    res.json({ response: assistantMessage });

  } catch (err) {
    console.error('Chat API error:', err);
    res.status(500).json({ error: 'Erreur du chatbot' });
  }
});

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// Catch-all pour SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Admin dashboard: http://localhost:${PORT}/admin`);
});
