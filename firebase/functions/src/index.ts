import { onDocumentCreated, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin
admin.initializeApp();

const db = getFirestore();
const auth = getAuth();

// Types
interface UserProfile {
  email: string | null;
  displayName: string | null;
  createdAt: FieldValue;
  updatedAt: FieldValue;
}

interface Note {
  userId: string;
  createdAt: FirebaseFirestore.Timestamp;
  archived: boolean;
}

// Function to create user profile
export const createUserProfile = onCall<{ uid: string }>(async (request) => {
  try {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const user = await auth.getUser(request.data.uid);
    const userProfile: UserProfile = {
      email: user.email || null,
      displayName: user.displayName || null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };

    await db.collection('users').doc(user.uid).set(userProfile);
    
    console.log(`Created profile for user ${user.uid}`);
    return { success: true };
  } catch (error) {
    console.error('Error creating user profile:', error);
    throw new HttpsError('internal', 'Error creating user profile');
  }
});

// Function to clean up user data
export const cleanupUserData = onCall<{ uid: string }>(async (request) => {
  try {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    // Delete user profile
    await db.collection('users').doc(request.data.uid).delete();

    // Delete user's notes
    const notesSnapshot = await db
      .collection('notes')
      .where('userId', '==', request.data.uid)
      .get();

    const batch = db.batch();
    notesSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    console.log(`Cleaned up data for user ${request.data.uid}`);
    return { success: true };
  } catch (error) {
    console.error('Error cleaning up user data:', error);
    throw new HttpsError('internal', 'Error cleaning up user data');
  }
});

// Function to handle note creation
export const onNoteCreated = onDocumentCreated('notes/{noteId}', async (event) => {
  const snapshot = event.data;
  if (!snapshot) {
    console.log('No data associated with the event');
    return;
  }

  try {
    const noteData = snapshot.data() as Note;
    console.log(`New note created by user ${noteData.userId}`);
  } catch (error) {
    console.error('Error processing new note:', error);
  }
});

// Function to handle note deletion
export const onNoteDeleted = onDocumentDeleted('notes/{noteId}', async (event) => {
  const snapshot = event.data;
  if (!snapshot) {
    console.log('No data associated with the event');
    return;
  }

  try {
    const noteData = snapshot.data() as Note;
    console.log(`Note deleted by user ${noteData.userId}`);
  } catch (error) {
    console.error('Error processing deleted note:', error);
  }
});

// Scheduled function to clean up old data (runs daily)
export const cleanupOldData = onSchedule('0 0 * * *', async (event) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const oldNotesSnapshot = await db
      .collection('notes')
      .where('createdAt', '<', admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
      .where('archived', '==', true)
      .get();

    const batch = db.batch();
    oldNotesSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    console.log('Successfully cleaned up old data');
  } catch (error) {
    console.error('Error cleaning up old data:', error);
    throw error;
  }
});
