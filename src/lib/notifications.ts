import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';

interface NotificationData {
  type: 'new_upload' | 'comment' | 'album_shared';
  title: string;
  message: string;
  photoId?: string;
  albumId?: string;
  triggeredBy: string;
  triggeredByName: string;
}

export async function sendNotification(data: NotificationData) {
  try {
    // Get users who should be notified
    const usersQuery = query(collection(db, 'users'));
    const usersSnapshot = await getDocs(usersQuery);

    const notificationPromises = usersSnapshot.docs.map(async (userDoc) => {
      const userData = userDoc.data();
      const userId = userDoc.id;

      // Skip the user who triggered the action
      if (userId === data.triggeredBy) return;

      // Check if user has notifications enabled
      if (!userData.emailNotifications) return;

      // Check specific notification type preferences
      if (data.type === 'new_upload' && !userData.newUploadsNotification) return;
      if (data.type === 'comment' && !userData.commentsNotification) return;

      // Send email notification
      if (userData.email) {
        await fetch('/api/notifications/email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: userData.email,
            subject: data.title,
            message: data.message,
            type: data.type,
          }),
        });
      }

      // Optionally store in-app notification
      // Could add this to a 'notifications' collection
    });

    await Promise.all(notificationPromises);
    console.log('Notifications sent successfully');
  } catch (error) {
    console.error('Error sending notifications:', error);
  }
}