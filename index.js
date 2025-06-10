// const express = require('express');
// const axios = require('axios');
// const bodyParser = require('body-parser');
// const { Expo } = require('expo-server-sdk');

// const app = express();
// app.use(bodyParser.json());

// // Cache for tokens + last notification count
// let expoTokens = [];
// let lastLeadCount = 0;

// // Expo SDK
// let expo = new Expo();

// // Route: Register Expo Push Token
// app.post('/register-token', (req, res) => {
//   const { token } = req.body;
//   console.log("Got the token: ",token);
//   if (!Expo.isExpoPushToken(token)) {
//     return res.status(400).json({ error: 'Invalid Expo token' });
//   }
//   if (!expoTokens.includes(token)) {
//     expoTokens.push(token);
//     console.log(`Registered new token: ${token}`);
//   }
//   res.json({ success: true });
// });

// // Polling Function
// const checkNotifications = async () => {
//   try {
//     const response = await axios.get(
//       'https://test-api.propfusion.io/notifications/?page=2&size=10',
//       {
//         headers: {
//           Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6OTg4MCwicm9sZSI6InN1cGVyX2FkbWluIiwidHlwZSI6ImFnZW50IiwiZXhwIjoxNzUxMjE5MjE0fQ.VcnSbkewyAr1vLkAfv0AQfV54OkEmBlEgJkWBG3SUv0',
//           Accept: 'application/json'
//         }
//       }
//     );

//     const data = response.data;
//     const newLeadCount = data.unseenNotificationCountsByType.leads;

//     if (newLeadCount > lastLeadCount) {
//       // Get latest notification
//       const latestNotification = data.notifications.find(n => n.type === 'leads' && n.seen === false);

//       if (latestNotification) {
//         console.log('New lead detected, sending push notifications...');
//         sendPushNotifications(latestNotification);
//       }

//       lastLeadCount = newLeadCount;
//     }

//   } catch (error) {
//     console.error('Error checking notifications:', error.message);
//   }
// };

// // Send Expo Push Notifications
// const sendPushNotifications = async (notification) => {
//   let messages = [];
//   for (let token of expoTokens) {
//     if (!Expo.isExpoPushToken(token)) continue;

//     messages.push({
//       to: token,
//       sound: 'default',
//       title: notification.subject,
//       body: notification.description,
//       data: { link: notification.link }
//     });
//   }

//   let chunks = expo.chunkPushNotifications(messages);
//   for (let chunk of chunks) {
//     try {
//       let receipts = await expo.sendPushNotificationsAsync(chunk);
//       console.log(receipts);
//     } catch (error) {
//       console.error('Error sending push notification:', error);
//     }
//   }
// };

// // Start Polling every 10 seconds
// setInterval(checkNotifications, 10000);

// // Start Server
// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => console.log(`Server running on port ${PORT}`));



const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const { Expo } = require('expo-server-sdk');

const app = express();
app.use(bodyParser.json());

// Cache for tokens + last notification count
let expoTokens = [];
let lastLeadCount = 0;

// Expo SDK
let expo = new Expo();

// Route: Register Expo Push Token
app.post('/register-token', (req, res) => {
  const { token } = req.body;
  console.log('Got the token:', token);
  if (!Expo.isExpoPushToken(token)) {
    return res.status(400).json({ error: 'Invalid Expo token' });
  }
  if (!expoTokens.includes(token)) {
    expoTokens.push(token);
    console.log(`Registered new token: ${token}`);
  }
  res.json({ success: true });
});

// Route: Deregister Expo Push Token (Optional)
app.post('/deregister-token', (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }
  expoTokens = expoTokens.filter(t => t !== token);
  console.log(`Deregistered token: ${token}`);
  res.json({ success: true });
});

// Polling Function
const checkNotifications = async () => {
  try {
    console.log('Polling API for new notifications...');
    const response = await axios.get(
      'https://test-api.propfusion.io/notifications/?page=1&size=10', // Changed to page=1
      {
        headers: {
          Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6OTg4MCwicm9sZSI6InN1cGVyX2FkbWluIiwidHlwZSI6ImFnZW50IiwiZXhwIjoxNzUxMjE5MjE0fQ.VcnSbkewyAr1vLkAfv0AQfV54OkEmBlEgJkWBG3SUv0',
          Accept: 'application/json',
        },
      }
    );

    const data = response.data;
    const newLeadCount = data.unseenNotificationCountsByType.leads;
    console.log(`New lead count: ${newLeadCount}, Last lead count: ${lastLeadCount}`);

    if (newLeadCount !== lastLeadCount) {
      // Get all unseen lead notifications
      const newLeadNotifications = data.notifications.filter(
        n => n.type === 'leads' && n.seen === false
      );

      if (newLeadNotifications.length > 0) {
        console.log(`New leads detected (${newLeadNotifications.length}), sending push notifications...`);
        for (const notification of newLeadNotifications) {
          await sendPushNotifications(notification);
        }
      }

      lastLeadCount = newLeadCount; // Update lastLeadCount regardless of new leads
    } else {
      console.log('No new leads detected.');
    }
  } catch (error) {
    console.error('Error checking notifications:', error.message);
  }
};

// Send Expo Push Notifications
const sendPushNotifications = async (notification) => {
  let messages = [];
  for (let token of expoTokens) {
    if (!Expo.isExpoPushToken(token)) {
      console.log(`Invalid token found: ${token}, removing from cache.`);
      expoTokens = expoTokens.filter(t => t !== token);
      continue;
    }

    messages.push({
      to: token,
      sound: 'default',
      title: notification.subject,
      body: notification.description,
      data: { link: notification.link },
    });
  }

  if (messages.length === 0) {
    console.log('No valid tokens to send notifications to.');
    return;
  }

  let chunks = expo.chunkPushNotifications(messages);
  for (let chunk of chunks) {
    try {
      let receipts = await expo.sendPushNotificationsAsync(chunk);
      console.log('Push notification receipts:', receipts);

      // Check for invalid tokens in receipts
      receipts.forEach((receipt, index) => {
        if (receipt.status === 'error' && receipt.details?.error === 'DeviceNotRegistered') {
          const invalidToken = chunk[index].to;
          console.log(`Removing invalid token: ${invalidToken}`);
          expoTokens = expoTokens.filter(t => t !== invalidToken);
        }
      });
    } catch (error) {
      console.error('Error sending push notification:', error.message);
    }
  }
};

// Start Polling every 10 seconds
setInterval(checkNotifications, 3600000);

app.get('/', (req, res) => {
  res.json({ status: 'OK', message: 'Notification service is running' });
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));