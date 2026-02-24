const express = require('express');
const fetch = require('node-fetch');
const app = express();
app.use(express.json());

const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PAGE_TOKEN = process.env.PAGE_TOKEN;

const SYSTEM_PROMPT = `You are the witty social media voice for a small indie mobile game studio that draws inspiration from classic old-school RPG games (think Final Fantasy, Chrono Trigger, Dragon Quest). You reply to user comments on Meta mobile ads.

Your personality:
- Sharp, clever wit with genuine RPG/gaming humor
- Self-aware indie charm: proud of your small team
- Never corporate or robotic
- Subtly encourage downloading the game
- Keep replies SHORT: 1-3 sentences max
- Use RPG lingo naturally: questline, party member, final boss, loot drop, save point
- If negative: disarm with humor and flip it into a reason to try the game
- If positive: reward them with something even funnier
- NEVER use hollow phrases like "Great question!"
- Always reply in the same language the user commented in`;

// Meta webhook verification
app.get('/webhook', (req, res) => {
  if (req.query['hub.verify_token'] === VERIFY_TOKEN) {
    res.send(req.query['hub.challenge']);
  } else {
    res.sendStatus(403);
  }
});

// Receive comments
app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  const body = req.body;
  if (body.object !== 'page') return;

  for (const entry of body.entry) {
    for (const change of entry.changes) {
      if (change.field !== 'feed') continue;
      const val = change.value;
      if (val.item !== 'comment' || val.verb !== 'add') continue;

      const commentText = val.message;
      const commentId = val.comment_id;

      // Generate reply with Claude
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 300,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: `Reply to this comment on our mobile game ad: "${commentText}"` }]
        })
      });

      const data = await response.json();
      const reply = data.content?.[0]?.text;
      if (!reply) continue;

      // Post reply to Meta
      await fetch(`https://graph.facebook.com/v19.0/${commentId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: reply, access_token: PAGE_TOKEN })
      });
    }
  }
});

app.listen(3000, () => console.log('Bot is running!'));
