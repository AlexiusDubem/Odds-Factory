import fetch from 'node-fetch';

async function test() {
  try {
    const res = await fetch('https://www.sportybet.com/api/ng/orders/share/BC5J5R', {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Origin': 'https://www.sportybet.com',
        'Referer': 'https://www.sportybet.com/ng/'
      }
    });
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Response:', text.substring(0, 200));
  } catch (err) {
    console.error('Fetch error:', err);
  }
}
test();
