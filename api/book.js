export function validateSelections(selections) {
  const invalid = selections.filter(
    (s) => !s.eventId || !s.marketId || !s.outcomeId
  );
  return {
    isValid: invalid.length === 0,
    invalidCount: invalid.length,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  
  const { selections, device = 'web', source = 'betslip' } = req.body || {};
  if (!selections || !Array.isArray(selections) || selections.length === 0) {
    return res.status(400).json({ error: 'No valid selections provided' });
  }

  const validation = validateSelections(selections);
  if (!validation.isValid) {
    return res.status(400).json({
      error: `Invalid selections payload: ${validation.invalidCount} item(s) missing marketId/outcomeId/eventId.`
    });
  }

  try {
    const response = await fetch('https://www.sportybet.com/api/ng/orders/share', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Origin': 'https://www.sportybet.com',
        'Referer': 'https://www.sportybet.com/ng/'
      },
      body: JSON.stringify({ selections, device, source })
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Book error:', error);
    return res.status(500).json({ error: 'Failed to fetch from SportyBet' });
  }
}
