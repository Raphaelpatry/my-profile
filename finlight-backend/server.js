require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '15mb' }));

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const PORT = process.env.PORT || 3001;

if (!ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY manquante. Copiez .env.example vers .env et renseignez votre clé.');
  process.exit(1);
}

const SYSTEM_PROMPT = `Tu es un assistant qui aide des particuliers français à repérer des anomalies sur leurs factures (énergie, assurance, télécom) et à rédiger une lettre de réclamation standard si besoin.

Règles strictes :
- Tu ne donnes jamais de conseil juridique personnalisé, tu appliques des règles générales et objectives (hausse de prix inexpliquée, incohérence de calcul, mention d'une clause de résiliation type loi Hamon/Chatel après 1 an d'engagement, double facturation apparente, absence d'éléments obligatoires).
- Si tu n'es pas sûr qu'il y ait une anomalie, dis-le clairement plutôt que d'inventer un problème.
- Réponds UNIQUEMENT en JSON valide, sans texte avant ni après, sans balises markdown, selon ce schéma exact :
{
  "anomalie_detectee": true ou false,
  "titre_verdict": "courte phrase (fournisseur ou société identifié si visible, sinon générique)",
  "explication": "2 à 4 phrases en français, claires, expliquant ce qui a été trouvé ou pourquoi rien d'anormal n'a été détecté",
  "base_legale": "référence courte si pertinente (ex: loi Hamon, loi Chatel, obligation de facturation), ou chaîne vide si non pertinent",
  "donnees_extraites": { "fournisseur": "...", "montant": "...", "periode": "...", "reference_client_ou_contrat": "..." },
  "lettre": "texte complet de la lettre si anomalie_detectee est true, en français, format lettre recommandée avec en-tête [Vos nom/prénom/adresse], [Nom et adresse du fournisseur], objet, corps expliquant le motif précis trouvé, pièces jointes à mentionner, formule de politesse. Utilise des espaces réservés entre crochets pour les informations que le prototype ne peut pas connaître (nom, adresse, numéro de client). Si anomalie_detectee est false, mets une chaîne vide."
}`;

app.post('/api/analyze', async (req, res) => {
  const { factureType, isPdf, mediaType, fileBase64 } = req.body || {};

  if (!fileBase64) {
    return res.status(400).json({ error: 'Aucun fichier reçu.' });
  }

  const contentBlock = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileBase64 } }
    : { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: fileBase64 } };

  const userText = `Type de facture indiqué par l'utilisateur : ${factureType || 'autre'}. Analyse le document ci-joint.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1800,
        system: SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: [contentBlock, { type: 'text', text: userText }] },
        ],
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      return res.status(response.status).json({ error: `Erreur API Anthropic (${response.status})`, details });
    }

    const data = await response.json();
    const textBlock = (data.content || []).find((b) => b.type === 'text');
    if (!textBlock) {
      return res.status(502).json({ error: 'Réponse vide du modèle.' });
    }

    const cleaned = textBlock.text.trim().replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();

    let result;
    try {
      result = JSON.parse(cleaned);
    } catch {
      return res.status(502).json({ error: 'Réponse du modèle non valide (JSON).', raw: cleaned });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Finlight backend démarré sur http://localhost:${PORT}`));
