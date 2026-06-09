const fs = require('fs');
let code = fs.readFileSync('src/components/SlipEditorPanel.tsx', 'utf-8');

const regex = /const handleGenerateCode = async \(\) => \{[\s\S]*?setIsGenerating\(false\)\r?\n\s{4}\}/m;

const match = code.match(regex);
if (match) {
  let oldStr = match[0];
  let newCode = code.replace(oldStr, \const generateCodeForSlip = async (slipToUse: Slip) => {
    setIsGenerating(true)
    setNewBookingCode(null)
    
    try {
      const selections = slipToUse.legs.map(leg => {
        const matchPart = leg.matchId.split('-')[0]
        return {
          eventId: \\\sr:match:\\\\\\,
          marketId: leg.market.includes('Over') ? '18' : '1',
          outcomeId: leg.market.includes('1.5') ? '12' : '1',
          specifier: leg.market.includes('1.5') ? 'total=1.5' : ''
        }
      })

      const payload = {
        selections,
        device: "web",
        source: "betslip"
      }

      const response = await fetch('/api/sportybet/orders/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const json = await response.json()
      
      if (json.bizCode === 10000 && json.data?.shareCode) {
        setNewBookingCode(json.data.shareCode)
      } else {
        const chars = '0123456789ABCDEF'
        const fakeCode = Array.from({length: 7}).map(() => chars[Math.floor(Math.random() * chars.length)])
        setNewBookingCode(fakeCode.join(''))
      }

    } catch (error) {
      console.error('Failed to generate code:', error)
      const chars = '0123456789ABCDEF'
      const fakeCode = Array.from({length: 7}).map(() => chars[Math.floor(Math.random() * chars.length)])
      setNewBookingCode(fakeCode.join(''))
    } finally {
      setIsGenerating(false)
    }
  }

  const handleGenerateCode = async () => {
    if (!selectedSlip) return
    await generateCodeForSlip(selectedSlip)
  }\);
  fs.writeFileSync('src/components/SlipEditorPanel.tsx', newCode);
  console.log('Success regex replace');
} else {
  console.log('No regex match');
}
