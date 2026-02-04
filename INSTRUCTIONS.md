# Projet : Devis SmartDuck Interactif

## Objectif
Créer une page de devis interactive hébergée sur `smartduck.cohorte.tech` avec :
- Tracking des visites (UTM, timestamp, user agent)
- Dashboard admin pour voir qui a consulté
- Chatbot intégré pour répondre aux questions
- Design responsive (mobile-first)

## Stack technique
- **Frontend** : HTML/CSS/JS vanilla (déjà fourni dans `devis.html`)
- **Backend** : Node.js + Express
- **Database** : SQLite (fichier local, simple)
- **Deploy** : Docker sur VPS via Traefik

## Structure du projet

```
smartduck-devis/
├── public/
│   ├── index.html          # Page du devis (fournie)
│   ├── styles.css          # Styles additionnels si besoin
│   └── chatbot.js          # Widget chatbot
├── src/
│   ├── server.js           # Serveur Express
│   ├── tracking.js         # Middleware de tracking
│   ├── admin.js            # Routes admin
│   └── db.js               # SQLite setup
├── data/
│   └── visits.db           # Base SQLite (créée auto)
├── Dockerfile
├── docker-compose.yml
├── package.json
└── .env.example
```

## Fonctionnalités détaillées

### 1. Tracking des visites
Capturer à chaque visite :
- `timestamp` : Date/heure de visite
- `utm_source` : Paramètre UTM (ex: "herve", "aurelien", "antoine")
- `ip` : Adresse IP (anonymisée)
- `user_agent` : Navigateur/Device
- `referrer` : D'où vient le visiteur
- `page_path` : Quelle page visitée
- `duration` : Temps passé sur la page (via beacon API au unload)

### 2. Dashboard Admin (/admin)
- Login simple (mot de passe en .env)
- Liste des visites avec filtres :
  - Par UTM source
  - Par date
  - Par device (mobile/desktop)
- Stats globales :
  - Nombre de vues total
  - Vues uniques
  - Temps moyen passé
  - Dernière visite

### 3. Chatbot
Widget en bas à droite qui :
- S'ouvre au clic
- Répond aux questions sur le devis via Claude API
- Contexte pré-chargé avec les infos du devis
- Log les conversations dans la DB

### 4. Responsive
- Mobile-first
- Breakpoints : 480px, 768px, 1024px
- Menu burger si nécessaire
- Cards empilées en mobile

## Variables d'environnement (.env)

```env
PORT=3000
ADMIN_PASSWORD=smartduck2025
ANTHROPIC_API_KEY=sk-ant-xxxxx
NODE_ENV=production
```

## Docker Compose (pour Traefik)

```yaml
version: '3.8'

services:
  smartduck-devis:
    build: .
    container_name: smartduck-devis
    restart: unless-stopped
    environment:
      - NODE_ENV=production
    volumes:
      - ./data:/app/data
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.smartduck-devis.rule=Host(`smartduck.cohorte.tech`)"
      - "traefik.http.routers.smartduck-devis.entrypoints=websecure"
      - "traefik.http.routers.smartduck-devis.tls.certresolver=letsencrypt"
      - "traefik.http.services.smartduck-devis.loadbalancer.server.port=3000"
    networks:
      - traefik-network

networks:
  traefik-network:
    external: true
```

## Routes API

| Method | Route | Description |
|--------|-------|-------------|
| GET | / | Page du devis (avec tracking auto) |
| GET | /admin | Dashboard admin (protégé) |
| POST | /admin/login | Authentification admin |
| GET | /api/visits | Liste des visites (admin only) |
| GET | /api/stats | Stats globales (admin only) |
| POST | /api/track | Endpoint pour tracking (beacon) |
| POST | /api/chat | Endpoint chatbot |

## Liens UTM à générer

Pour Hervé :
`https://smartduck.cohorte.tech/?utm_source=herve`

Pour Aurélien :
`https://smartduck.cohorte.tech/?utm_source=aurelien`

Pour toi (test) :
`https://smartduck.cohorte.tech/?utm_source=antoine`

## Étapes de développement

1. [ ] Setup projet Node.js + Express
2. [ ] Intégrer le HTML du devis dans public/
3. [ ] Ajouter les media queries responsive
4. [ ] Créer le système de tracking SQLite
5. [ ] Créer le dashboard admin
6. [ ] Intégrer le widget chatbot
7. [ ] Connecter le chatbot à l'API Claude
8. [ ] Dockeriser
9. [ ] Déployer sur VPS via MCP Hostinger

## Design du Dashboard Admin

```
┌─────────────────────────────────────────────────────────┐
│  SMARTDUCK DEVIS - ADMIN                    [Logout]    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │    12    │  │     5    │  │  2m 34s  │  │  il y a │ │
│  │  Vues    │  │ Uniques  │  │  Moy.    │  │  2h     │ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │
│                                                         │
│  VISITES RÉCENTES                                       │
│  ┌─────────────────────────────────────────────────────┐│
│  │ 14:32  herve     Desktop  Chrome   3m 12s          ││
│  │ 11:15  aurelien  Mobile   Safari   1m 45s          ││
│  │ 09:00  antoine   Desktop  Chrome   0m 30s          ││
│  └─────────────────────────────────────────────────────┘│
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Contexte Chatbot

Le chatbot doit connaître :
- Les deux options du devis (Standard 1200€, Optimisé 1800€)
- Les délais (3-4 jours vs 5-6 jours)
- Ce qui est inclus dans chaque option
- Le process (5 étapes)
- Qui est Antoine / Cohorte Agency

Prompt système suggéré :
```
Tu es l'assistant du devis SmartDuck × Cohorte. Tu réponds aux questions sur :
- Option 1 (Standard) : 1200€ HT, 3-4 jours, intégration basique Booker
- Option 2 (Optimisée) : 1800€ HT, 5-6 jours, tunnel UX + tracking + analytics
- Le process : Choix option → Credentials API → Dev → Validation → Prod
- Antoine de Cohorte Agency gère le projet

Sois concis, professionnel, et redirige vers Antoine pour les questions complexes.
```

## Notes importantes

- Le fichier `devis.html` fourni contient déjà tout le design
- Il faut juste ajouter le tracking JS et le widget chatbot
- La DB SQLite permet de garder les données même si le container redémarre
- Penser à ajouter un rate limit sur /api/chat pour éviter les abus
