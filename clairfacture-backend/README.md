# ClairFacture — backend

Petit serveur qui garde la clé API Anthropic côté serveur, pour que
`clairfacture_mvp.html` n'ait jamais besoin de l'exposer dans le navigateur.

## Démarrage

```bash
cd clairfacture-backend
npm install
cp .env.example .env   # puis renseigner ANTHROPIC_API_KEY dans .env
npm start
```

Le serveur écoute par défaut sur `http://localhost:3001`.

## Utilisation avec le frontend

`clairfacture_mvp.html` envoie les factures à `http://localhost:3001/api/analyze`.
Démarrez le backend avant de cliquer sur « Analyser la facture » dans la page.

## Sécurité

- Ne commitez jamais votre fichier `.env` (il est déjà dans `.gitignore`).
- Ce serveur est un prototype local : avant tout déploiement public, ajoutez une
  limitation de débit (rate limiting), une restriction CORS à votre propre domaine,
  et une taille maximale de fichier cohérente avec votre cas d'usage.
