import type { VercelRequest, VercelResponse } from '@vercel/node'
import * as admin from 'firebase-admin'

// Initialize Firebase Admin lazily to avoid cold start issues on Vercel
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}')
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    })
  } catch (error) {
    console.error('Firebase Admin Init Error:', error)
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Verify authorization (optional, but good practice for crons. Vercel sends a CRON_SECRET header if configured)
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // Early exit if Firebase isn't properly initialized (e.g., missing env var)
  if (!admin.apps.length) {
    return res.status(500).json({ error: 'Firebase Admin not configured.' })
  }

  try {
    const db = admin.firestore()
    
    // 2. We use a collectionGroup query to find all active slips across all users.
    // NOTE: This requires a Firestore Composite Index if we query heavily, but since we just
    // query by status == 'active', we might just need to ensure the index exists in Firebase Console.
    const activeSlipsSnapshot = await db.collectionGroup('slips').where('status', '==', 'active').get()

    if (activeSlipsSnapshot.empty) {
      return res.status(200).json({ message: 'No active slips to monitor.' })
    }

    let processedCount = 0
    let notificationsSent = 0

    // For mocking purposes in this implementation, we simulate checking the API.
    // In production, we'd batch the unique Match IDs and ping Sportmonks / API-Football.
    const liveMatchesMockData: Record<string, 'won' | 'lost' | 'pending'> = {}

    // Process each slip
    for (const docSnap of activeSlipsSnapshot.docs) {
      const slip = docSnap.data()
      const slipRef = docSnap.ref
      const userId = slipRef.parent.parent?.id // ref path is users/{userId}/slips/{slipId}

      if (!userId) continue

      const legs = slip.legs || []
      
      // MOCK LOGIC: Randomly decide if a slip has "won" for demonstration purposes.
      // REPLACE THIS with actual API verification.
      const isWinner = Math.random() > 0.8 // 20% chance to mock a win

      if (isWinner) {
        // Mark slip as won
        await slipRef.update({ status: 'won' })

        // Retrieve user's FCM token
        const userDoc = await db.collection('users').doc(userId).get()
        const userData = userDoc.data()
        
        if (userData?.fcmToken) {
          // Send FCM Notification
          const message = {
            notification: {
              title: '🚨 BOOM! Ticket Cashed!',
              body: `Your ticket "${slip.name || 'Optimized Slip'}" just won! Combined Odds: ${slip.combinedOdds?.toFixed(2)}`,
            },
            token: userData.fcmToken,
          }

          try {
            await admin.messaging().send(message)
            notificationsSent++
          } catch (fcmErr) {
            console.error(`Failed to send FCM to user ${userId}:`, fcmErr)
          }
        }
      }
      processedCount++
    }

    return res.status(200).json({ 
      success: true, 
      processed: processedCount, 
      notificationsSent 
    })

  } catch (error: any) {
    console.error('Cron Error:', error)
    return res.status(500).json({ error: error.message })
  }
}
