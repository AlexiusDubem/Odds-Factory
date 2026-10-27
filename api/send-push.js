import * as admin from 'firebase-admin'

function getAdminApp() {
  if (admin.apps.length) return admin.app()
  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!rawServiceAccount) throw new Error('Firebase Admin is not configured.')
  const serviceAccount = JSON.parse(rawServiceAccount)
  return admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  try {
    const app = getAdminApp()
    const authorization = req.headers.authorization || ''
    const idToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
    if (!idToken) return res.status(401).json({ success: false, error: 'Authentication is required.' })
    const decoded = await admin.auth(app).verifyIdToken(idToken)
    if (decoded.email?.toLowerCase() !== 'alexiusdubem7@gmail.com') {
      return res.status(403).json({ success: false, error: 'Only the administrator can send phone alerts.' })
    }
    const { title, message, url = '/builder', tokens = [] } = req.body || {}
    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required for push notification' })
    }

    const uniqueTokens = [...new Set((Array.isArray(tokens) ? tokens : []).filter(token => typeof token === 'string' && token.length > 40))]
    if (uniqueTokens.length === 0) {
      return res.status(400).json({ success: false, error: 'No registered phone-alert devices found.' })
    }
    const response = await admin.messaging(app).sendEachForMulticast({
      tokens: uniqueTokens.slice(0, 500),
      notification: { title, body: message },
      webpush: {
        notification: { icon: '/logo.png', badge: '/logo.png' },
        fcmOptions: { link: url },
      },
      data: { title, message, url },
    })

    return res.status(200).json({
      success: true,
      broadcastedCount: response.successCount,
      failedCount: response.failureCount,
      title,
      message,
      url,
      sentAt: new Date().toISOString()
    })
  } catch (err) {
    console.error('Push broadcast error:', err.message)
    return res.status(500).json({ success: false, error: err.message })
  }
}
