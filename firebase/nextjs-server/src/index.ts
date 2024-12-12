import { onRequest } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = getFirestore();

// API endpoint to handle note generation requests
export const generateNote = onRequest(async (req, res) => {
  try {
    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*');
    
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'GET, POST');
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.status(204).send('');
      return;
    }

    // Verify authentication
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const userId = decodedToken.uid;

    // Rate limiting check
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const isPremium = userData?.isPremium || false;
    const rateLimit = isPremium ? 180 : 60; // Requests per day

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const requestsToday = await db
      .collection('notes')
      .where('userId', '==', userId)
      .where('createdAt', '>=', today)
      .count()
      .get();

    if (requestsToday.data().count >= rateLimit) {
      res.status(429).json({ 
        error: 'Rate limit exceeded',
        limit: rateLimit,
        resetTime: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString()
      });
      return;
    }

    // Process the request
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const { prompt, options } = req.body;
    if (!prompt || !options) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Store the request in Firestore
    const noteRef = db.collection('notes').doc();
    await noteRef.set({
      userId,
      prompt,
      options,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'pending'
    });

    // Return the note ID for client-side polling
    res.status(200).json({ 
      noteId: noteRef.id,
      message: 'Note generation request received'
    });

  } catch (error) {
    console.error('Error in generateNote:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API endpoint to check note generation status
export const getNoteStatus = onRequest(async (req, res) => {
  try {
    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*');
    
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'GET');
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.status(204).send('');
      return;
    }

    // Verify authentication
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const userId = decodedToken.uid;

    // Get note ID from query params
    const noteId = req.query.noteId as string;
    if (!noteId) {
      res.status(400).json({ error: 'Missing note ID' });
      return;
    }

    // Get note from Firestore
    const noteDoc = await db.collection('notes').doc(noteId).get();
    if (!noteDoc.exists) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }

    const noteData = noteDoc.data();
    if (noteData?.userId !== userId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    res.status(200).json({
      status: noteData?.status,
      content: noteData?.content,
      error: noteData?.error
    });

  } catch (error) {
    console.error('Error in getNoteStatus:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
