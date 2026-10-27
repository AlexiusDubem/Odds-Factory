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
    const { title, message, url = '/builder', broadcastId = `broadcast-${Date.now()}` } = req.body || {}
    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required for push notification' })
    }

    const db = admin.firestore(app)
    const [subscribers, users, userTokens] = await Promise.all([
      db.collection('push_subscribers').get(),
      db.collection('users').get(),
      db.collectionGroup('fcmTokens').get(),
    ])

    const tokenSet = new Set()
    subscribers.forEach(doc => {
      const token = doc.data().token
      if (typeof token === 'string' && token.length > 40) tokenSet.add(token)
    })
    users.forEach(doc => {
      const token = doc.data().fcmToken
      if (typeof token === 'string' && token.length > 40) tokenSet.add(token)
    })
    userTokens.forEach(doc => {
      const token = doc.data().token
      if (typeof token === 'string' && token.length > 40) tokenSet.add(token)
    })

    // Every account receives an in-app inbox record; browser/phone delivery is
    // additionally attempted for every real FCM device token.
    const allUsers = users.docs
    for (let index = 0; index < allUsers.length; index += 400) {
      const batch = db.batch()
      allUsers.slice(index, index + 400).forEach(user => {
        batch.set(user.ref.collection('notifications').doc(broadcastId), {
          title, message, url, read: false, createdAt: admin.firestore.FieldValue.serverTimestamp(), broadcastId,
        }, { merge: true })
      })
      await batch.commit()
    }

    let successCount = 0
    let failureCount = 0
    const deviceTokens = [...tokenSet]
    for (let index = 0; index < deviceTokens.length; index += 500) {
      const response = await admin.messaging(app).sendEachForMulticast({
        tokens: deviceTokens.slice(index, index + 500),
        notification: { title, body: message },
        webpush: {
          notification: { icon: '/logo.png', badge: '/logo.png' },
          fcmOptions: { link: url },
        },
        data: { title, message, url },
      })
      successCount += response.successCount
      failureCount += response.failureCount
    }

    return res.status(200).json({
      success: true,
      broadcastedCount: successCount,
      failedCount: failureCount,
      inAppRecipientCount: allUsers.length,
      registeredDeviceCount: deviceTokens.length,
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
