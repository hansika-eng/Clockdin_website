const express = require('express');
const router = express.Router();
const Reminder = require('../models/reminder.model');
const Event = require('../models/event.model');
const nodemailer = require('nodemailer');

// helper to create transporter from env
function makeTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
}

// POST /api/reminders
router.post('/', async (req, res) => {
  try {
    const { user, event, email, remindAt } = req.body;
    const reminder = new Reminder({ user, event, email, remindAt });
    await reminder.save();
    res.json({ success: true, reminder });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
// POST /api/reminders/subscribe
router.post('/subscribe', async (req, res) => {

  console.log("SUBSCRIBE ROUTE HIT");

  try {

    const { eventId, eventData, email } = req.body;

    console.log("BODY:", req.body);

    if (!email) {
      return res.status(400).json({
        error: 'Email required'
      });
    }

    // avoid duplicate subscriptions
    const existing = await Reminder.findOne({
      event: eventId,
      email
    });

    if (existing) {
      return res.json({
        success: true,
        message: 'Already subscribed'
      });
    }

    // create 3 reminders

    const reminders = [
      {
        event: eventId,
        email,
        eventData,
        reminderType: '2days'
      },
      {
        event: eventId,
        email,
        eventData,
        reminderType: '1day'
      },
      {
        event: eventId,
        email,
        eventData,
        reminderType: 'deadline'
      }
    ];

    await Reminder.insertMany(reminders);

    console.log('3 reminders created');

    res.json({
      success: true
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: err.message
    });

  }

});
    

// POST /api/reminders/trigger - send any due reminders now
router.post('/trigger', async (req, res) => {
  try {
    const now = new Date();
    const reminders = await Reminder.find({ sent: false, remindAt: { $lte: now } }).populate('event');
    const transporter = makeTransporter();
      // verify transporter
      try {
        await transporter.verify();
        console.log('SMTP transporter verified');
      } catch (vErr) {
        console.error('SMTP verify failed:', vErr && vErr.message);
      }
      const results = [];
    for (const reminder of reminders) {
      try {
          const info = await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: reminder.email,
            subject: `Event Reminder: ${reminder.event?.title || 'Event'}`,
            text: `

Clockdin Event Reminder

Event:
${reminder.eventData?.title}

Description:
${reminder.eventData?.description}

Location:
${reminder.eventData?.location}

Best Regards,
Team Clockdin

`
          });
          reminder.sent = true;
          await reminder.save();
          results.push({ id: reminder._id, status: 'sent', info: { messageId: info.messageId, accepted: info.accepted, rejected: info.rejected, response: info.response } });
      } catch (err) {
          results.push({ id: reminder._id, status: 'error', error: err.message });
      }
    }
    res.json({ triggered: results.length, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reminders/list - debug: list reminders with event and user info
router.get('/list', async (req, res) => {
  try {
    const reminders = await Reminder.find().populate('event').populate('user', 'email name');
    const out = reminders.map(r => ({
      id: r._id,
      user: r.user ? { id: r.user._id, email: r.user.email, name: r.user.name } : r.user,
      event: r.event ? { id: r.event._id, title: r.event.title, eventDate: r.event.eventDate } : r.event,
      email: r.email,
      remindAt: r.remindAt,
      sent: r.sent,
      createdAt: r.createdAt
    }));
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reminders/send-test - send a test email (body: { to, subject, text })
router.post('/send-test', async (req, res) => {
  try {
    const { to, subject, text } = req.body;
    if (!to) return res.status(400).json({ error: 'to required' });
    const transporter = makeTransporter();
    try {
      await transporter.verify();
      console.log('SMTP transporter verified (send-test)');
    } catch (vErr) {
      console.error('SMTP verify failed (send-test):', vErr && vErr.message);
    }
    const info = await transporter.sendMail({ from: process.env.EMAIL_USER, to, subject: subject || 'Test', text: text || 'Test email' });
    // return a small serializable debug object
    const debug = {
      messageId: info?.messageId,
      accepted: info?.accepted,
      rejected: info?.rejected,
      response: info?.response
    };
    console.log('send-test info:', debug);
    res.json({ success: true, info: debug });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reminders/bookmark-notifications - notify users about bookmarked events ending in 2 days
router.post('/bookmark-notifications', async (req, res) => {
  try {
    const twoDaysFromNow = new Date();
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
    console.log('Calculated twoDaysFromNow:', twoDaysFromNow);

    // Find events with deadlines in 2 days that are bookmarked
    const eventsEndingSoon = await Event.find({
      deadline: { $lte: twoDaysFromNow },
      isBookmarked: true
    }).populate('user');

    console.log('Events found for notification:', eventsEndingSoon);

    const transporter = makeTransporter();
    try {
      await transporter.verify();
      console.log('SMTP transporter verified (bookmark-notifications)');
    } catch (vErr) {
      console.error('SMTP verify failed (bookmark-notifications):', vErr && vErr.message);
    }

    const results = [];
    for (const event of eventsEndingSoon) {
      try {
        const info = await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: event.user.email,
          subject: `Event Deadline Approaching: ${event.title}`,
          text: `Hi ${event.user.name},\n\nThe event "${event.title}" you bookmarked has a deadline on ${event.deadline.toLocaleString()}.\n\nDon't miss it!\n\nBest regards,\nClockdin Team`
        });
        results.push({ eventId: event._id, status: 'sent', info: { messageId: info.messageId, accepted: info.accepted, rejected: info.rejected, response: info.response } });
      } catch (err) {
        results.push({ eventId: event._id, status: 'error', error: err.message });
      }
    }

    res.json({ notified: results.length, results });
  } catch (err) {
    console.error('Error in bookmark-notifications route:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;