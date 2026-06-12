import fetch from 'node-fetch';

async function testPost() {
  const selections = [
    {
      "eventId": "sr:match:40000000",
      "marketId": "1",
      "specifier": "",
      "outcomeId": "1"
    }
  ];

  try {
    const res = await fetch('https://www.sportybet.com/api/ng/orders/share', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Origin': 'https://www.sportybet.com',
        'Referer': 'https://www.sportybet.com/ng/'
      },
      body: JSON.stringify({ selections, device: 'web', source: 'betslip' })
    });
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Response:', text.substring(0, 300));
  } catch (err) {
    console.error('Fetch error:', err);
  }
}
testPost();
