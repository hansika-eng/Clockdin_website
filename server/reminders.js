require('dotenv').config();

const express = require('express');
const router = express.Router();

const Reminder = require('../models/reminder.model');
const NotificationSubscription = require('../models/notificationSubscription.model');

// =========================
// SUBSCRIBE ROUTE
// =========================

router.post('/subscribe', async (req, res) => {

  try {

    console.log("BODY:", req.body);

    const { userId, eventId, eventData, email } = req.body;

    if (!eventData) {

      return res.status(400).json({
        message: 'Event data missing'
      });

    }

    // TEST -> send after 1 minute
    const remindAt = new Date(Date.now() + 60000);

    // Save subscription
    const subscription = new NotificationSubscription({
      user: userId || "681111111111111111111111",
      event: String(eventId),
    });

    await subscription.save();

    console.log("Subscription saved");

    // Save reminder
    const reminder = new Reminder({

      user: userId || "681111111111111111111111",

      event: String(eventId),

      email: email,

      remindAt,

      sent: false,

      // IMPORTANT
      eventData: eventData

    });

    await reminder.save();

    console.log("REMINDER SAVED");

    res.status(201).json({
      success: true,
      message: 'Reminder created',
      reminder
    });

  } catch (err) {

    console.error("REMINDER ERROR:", err);

    res.status(500).json({
      success: false,
      error: err.message
    });

  }

});

module.exports = router;