import fs from 'fs'

const file = 'c:\\Users\\User\\Desktop\\Odds Factory\\src\\components\\AccaBuilderPanel.tsx'
let content = fs.readFileSync(file, 'utf-8')

content = content.replace(
  `            {isLiveConnected
              ? \`Connected: \${allLivePicks.length} real live markets available today\`
              : 'Statistical prediction models ready'}`,
  `            {isLoadingLive
              ? "Scanning today's live matches across all leagues..."
              : isLiveConnected
              ? \`Connected: \${allLivePicks.length} real live markets available today\`
              : 'Statistical prediction models ready'}`
)

fs.writeFileSync(file, content, 'utf-8')
console.log('✅ Used isLoadingLive in status badge')
