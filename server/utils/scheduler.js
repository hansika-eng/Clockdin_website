const nodemailer = require('nodemailer');
const Reminder = require('../models/reminder.model');
const Event = require('../models/event.model');
const NotificationSubscription = require('../models/notificationSubscription.model');
const axios = require('axios');

const timers = new Map();

function makeTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
}

const transporter = makeTransporter();

async function sendReminder(reminder) {
  try {
    // Ensure populated event
    const rem = await Reminder.findById(reminder._id).populate('event');
    const to = rem.email;
    const subject = `Clockdin Reminder: ${rem.eventData?.title || 'Event'}`;

const text = `

Clockdin Event Reminder

Event:
${rem.eventData?.title}

Description:
${rem.eventData?.description}

Location:
${rem.eventData?.location}

Best Regards,
Team Clockdin

`;
    const info = await transporter.sendMail({ from: process.env.EMAIL_USER, to, subject, text });
    rem.sent = true;
    await rem.save();
    console.log('Scheduled reminder sent', { id: rem._id.toString(), messageId: info.messageId });
    // clear timer if present
    if (timers.has(rem._id.toString())) {
      clearTimeout(timers.get(rem._id.toString()));
      timers.delete(rem._id.toString());
    }
    return { success: true, info };
  } catch (err) {
    console.error('Error in sendReminder:', err.message);
    return { success: false, error: err.message };
  }
}

function scheduleReminder(reminder) {
  try {
    const id = reminder._id ? reminder._id.toString() : reminder.id;
    // avoid scheduling already sent reminders
    if (reminder.sent) return;
    const remindAt = new Date(reminder.remindAt);
    const now = new Date();
    const delay = remindAt.getTime() - now.getTime();
    if (delay <= 0) {
      // due now or in past => send immediately
      sendReminder(reminder);
      return;
    }
    // protect against too-large delays
    const MAX_DELAY = 0x7fffffff; // ~24.8 days
    const effectiveDelay = delay > MAX_DELAY ? MAX_DELAY : delay;
    const timer = setTimeout(async () => {
      await sendReminder(reminder);
      // if the original delay exceeded MAX_DELAY, reschedule remaining time
      if (delay > MAX_DELAY) {
        // compute remaining time
        const remaining = remindAt.getTime() - Date.now();
        if (remaining > 0) scheduleReminder({ ...reminder, remindAt });
      }
    }, effectiveDelay);
    timers.set(id, timer);
    console.log('Reminder scheduled', { id, remindAt });
  } catch (err) {
    console.error('Error scheduling reminder:', err.message);
  }
}

async function rescheduleAll() {
  try {
    const now = new Date();
    const reminders = await Reminder.find({ sent: false, remindAt: { $exists: true } });
    for (const r of reminders) {
      scheduleReminder(r);
    }
    console.log('Rescheduled', reminders.length, 'reminders');
  } catch (err) {
    console.error('Error rescheduling reminders:', err.message);
  }
}

async function notifyBookmarkedEvents() {
  try {
    const response = await axios.post('http://localhost:3000/api/reminders/bookmark-notifications');
    console.log('Bookmarked events notification job completed:', response.data);
  } catch (err) {
    console.error('Error in notifyBookmarkedEvents:', err.message);
  }
}

function scheduleBookmarkedNotifications() {
  const ONE_DAY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  setInterval(notifyBookmarkedEvents, ONE_DAY);
  console.log('Scheduled daily job for bookmarked events notifications');
}

async function sendEventNotifications() {
  try {
    const now = new Date();
    const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

    const events = await Event.find({
      deadline: { $gte: now, $lte: twoDaysFromNow },
      notificationSent: false,
    }).populate('usersToNotify');

    for (const event of events) {
      if (event.usersToNotify.length > 0) {
        const emails = event.usersToNotify.map(user => user.email);
        const subject = `Reminder: Event "${event.title}" is ending soon!`;
        const text = `Hi there,\n\nThis is a reminder that the event "${event.title}" is ending on ${event.deadline.toDateString()}.\n\nMake sure you don't miss it!\n\nBest regards,\nClockdin Team`;

        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: emails.join(','),
          subject,
          text,
        });

        console.log(`Sent deadline notification for event: ${event.title}`);
      }

      // Mark the event as notification sent to avoid re-sending
      event.notificationSent = true;
      await event.save();
    }
  } catch (error) {
    console.error('Error sending event deadline notifications:', error);
  }
}

function scheduleEventNotifications() {
  const ONE_DAY = 24 * 60 * 60 * 1000; // 24 hours
  setInterval(sendEventNotifications, ONE_DAY);
  console.log('Scheduled daily job for event deadline notifications.');
}

async function sendSubscriptionNotifications() {
  try {
    const now = Date.now();
    const TWO_DAYS = 2 * 24 * 60 * 60 * 1000; // 48 hours
    const THRESHOLD = 2 * 60 * 1000; // 2 minutes tolerance to match scheduler interval

    const subs = await NotificationSubscription.find({ sent: false })
      .populate('event')
      .populate('user');

    for (const sub of subs) {
      const deadline = sub.event?.deadline ? new Date(sub.event.deadline) : null;
      if (!deadline || !sub.user?.email) continue;

      const remaining = deadline.getTime() - now;
      // Send when deadline is approximately 48 hours away within the tolerance window
      if (remaining >= (TWO_DAYS - THRESHOLD) && remaining <= (TWO_DAYS + THRESHOLD)) {
        const to = sub.user.email;
        const subject = `Reminder: ${sub.event.title} deadline in 2 days`;
        const text = `Hi ${sub.user.name || ''},\n\nYou subscribed to be notified about "${sub.event.title}". The deadline is ${deadline.toDateString()}.\n\nGood luck!\nClockdin Team`;
        try {
          await transporter.sendMail({ from: process.env.EMAIL_USER, to, subject, text });
          sub.sent = true;
          await sub.save();
          console.log('Sent subscription notification', { sub: sub._id.toString(), event: sub.event.title, to });
        } catch (sendErr) {
          console.error('Error sending subscription email for sub', sub._id.toString(), sendErr.message);
        }
      }
    }
  } catch (err) {
    console.error('Error sending subscription notifications:', err.message);
  }
}

function scheduleSubscriptionNotifications() {
  const ONE_MINUTE = 60 * 1000;
  // Run once immediately to catch any already-due items
  sendSubscriptionNotifications();
  setInterval(sendSubscriptionNotifications, ONE_MINUTE);
  console.log('Scheduled 1-minute interval for subscription deadline notifications.');
}

// Call this function to start the scheduler
scheduleBookmarkedNotifications();
scheduleEventNotifications();
scheduleSubscriptionNotifications();

module.exports = {
  sendReminder,
  scheduleReminder,
  rescheduleAll,
  notifyBookmarkedEvents,
  scheduleBookmarkedNotifications,
  sendEventNotifications,
  scheduleEventNotifications,
  sendSubscriptionNotifications,
  scheduleSubscriptionNotifications,
};
