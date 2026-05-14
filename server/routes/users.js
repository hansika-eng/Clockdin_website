const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const User = require('../models/user.model');
const Event = require('../models/event.model');
const Reminder = require('../models/reminder.model');
const NotificationSubscription = require('../models/notificationSubscription.model');
const scheduler = require(path.join(__dirname, '../utils/scheduler'));
const router = express.Router();
const profileFields = [
  'phone',
  'location',
  'bio',
  'college',
  'major',
  'gradYear',
  'website',
  'github',
  'linkedin',
  'twitter',
  'interests',
  'skills',
];

// Auth middleware
const auth = (req, res, next) => {
  const token = req.header('x-auth-token');
  if (!token) {
    console.log('Auth failed: No token provided');
    return res.status(401).json({ msg: 'No token, auth denied' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.error('Auth failed: Token verification error', err.message);
    res.status(401).json({ msg: 'Token invalid', error: err.message });
  }
};

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ msg: 'All fields required' });
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ msg: 'Email already registered' });
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hash });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ msg: 'Invalid credentials' });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  const user = await User.findById(req.user.id).select('-password');
  res.json(user);
});

// Bookmarks: add/remove
router.post('/bookmarks', auth, async (req, res) => {
  const { eventId } = req.body;
  if (!eventId) return res.status(400).json({ msg: 'Event ID required' });
  const user = await User.findById(req.user.id);
  if (!user.bookmarks.includes(eventId)) user.bookmarks.push(eventId);
  await user.save();
  res.json(user.bookmarks);
});
router.delete('/bookmarks/:eventId', auth, async (req, res) => {
  const { eventId } = req.params;
  const user = await User.findById(req.user.id);
  user.bookmarks = user.bookmarks.filter(id => id.toString() !== eventId);
  await user.save();
  res.json(user.bookmarks);
});

// Notifications subscribe/unsubscribe
router.get('/notifications/subscriptions', auth, async (req, res) => {
  const subs = await NotificationSubscription.find({ user: req.user.id }).select('event sent');
  res.json(subs);
});

router.post('/notifications/subscribe', auth, async (req, res) => {

  const { eventId } = req.body;

  if (!eventId) {
    return res.status(400).json({ msg: 'Event ID required' });
  }

  try {

    // Save notification subscription
    await NotificationSubscription.findOneAndUpdate(
      { user: req.user.id, event: eventId },
      { $set: { sent: false } },
      { upsert: true, new: true }
    );

    // Find user
    const user = await User.findById(req.user.id);

    // Find event
    const foundEvent = req.body.eventData;

    // Create reminder 2 days before deadline
    if (foundEvent && foundEvent.deadline) {

      const reminderDate = new Date(foundEvent.deadline);

      reminderDate.setDate(reminderDate.getDate() - 2);

      const existingReminder = await Reminder.findOne({
        user: user._id,
        event: String(foundEvent._id || foundEvent.id)
      });

      // Avoid duplicate reminders
      if (!existingReminder) {

        const createdReminder = await Reminder.create({
          user: user._id,
          event: String(foundEvent._id || foundEvent.id),
          email: user.email,
          remindAt: reminderDate
        });

        console.log('Reminder created:', createdReminder._id);

        // Schedule exact reminder
        try {

          if (scheduler?.scheduleReminder) {
            scheduler.scheduleReminder(createdReminder);
          }

        } catch (schedErr) {

          console.error(
            'Failed to schedule reminder:',
            schedErr.message
          );

        }

      }

    }

    res.json({
      subscribed: true,
      eventId
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      msg: 'Server error',
      error: err.message
    });

  }

});

router.delete('/notifications/subscribe/:eventId', auth, async (req, res) => {
  const { eventId } = req.params;
  try {
    await NotificationSubscription.deleteOne({ user: req.user.id, event: eventId });
    res.json({ subscribed: false, eventId });
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// My Events: add, get, delete
router.post('/myevents', auth, async (req, res) => {
  try {
    const { title, description, date, time, location, category, reminder, timezoneOffset } = req.body;
    const user = await User.findById(req.user.id);

    // Save as a subdocument in user's myEvents for UI
    const myEvent = { title, description, date, time, location, category, reminder };
    user.myEvents.push(myEvent);

    const offsetMinutes = typeof timezoneOffset === 'number' ? timezoneOffset : 0;
    let eventDateTime = null;
    if (date) {
      const normalizedTime = time || '00:00';
      const parsed = new Date(`${date}T${normalizedTime}`);
      if (!isNaN(parsed.getTime())) {
        eventDateTime = parsed;
      } else {
        const fallbackDate = new Date(date);
        if (!isNaN(fallbackDate.getTime())) {
          eventDateTime = fallbackDate;
        }
      }
      if (eventDateTime) {
        eventDateTime.setMinutes(eventDateTime.getMinutes() + offsetMinutes);
      }
    }

    // Also create an Event document so reminders can reference it
    const eventDoc = await Event.create({
      title,
      description,
      eventDate: eventDateTime || (date ? new Date(date) : undefined),
      organizerName: user.name,
      location,
      createdBy: user._id
    });

    // If reminder selected, compute remindAt and create Reminder document
    if (reminder && reminder !== 'No reminder') {
      // compute remindAt based on reminder string
      let remindAt = null;

      const parseMap = {
        'On time': 0,
        '5 minutes before': 5 * 60 * 1000,
        '10 minutes before': 10 * 60 * 1000,
        '1 hour before': 60 * 60 * 1000,
        '1 day before': 24 * 60 * 60 * 1000,
      };

      if (eventDateTime) {
        const offset = parseMap[reminder] || 0;
        remindAt = new Date(eventDateTime.getTime() - offset);
      } else {
        // fallback: remind immediately
        remindAt = new Date();
      }

      const createdReminder = await Reminder.create({

        user: user._id,

        event: eventDoc._id,

        email: user.email,

        remindAt,

        sent: false,

        eventData: {
          title,
          description,
          location
        }

      });
      console.log('Created reminder:', { id: createdReminder._id.toString(), email: createdReminder.email, remindAt: createdReminder.remindAt });
      // schedule the reminder to be sent at the exact time
      try {
        if (scheduler?.scheduleReminder) {
          scheduler.scheduleReminder(createdReminder);
        }
      } catch (schedErr) {
        console.error('Failed to schedule reminder after creation:', schedErr.message);
      }
    }

    await user.save();
    res.json(user.myEvents);
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});
router.get('/myevents', auth, async (req, res) => {
  const user = await User.findById(req.user.id);
  res.json(user.myEvents);
});

// Update a specific event by index
router.put('/myevents/:idx', auth, async (req, res) => {
  const idx = parseInt(req.params.idx);
  const user = await User.findById(req.user.id);
  if (user.myEvents[idx]) {
    // Only update provided fields
    Object.assign(user.myEvents[idx], req.body);
    await user.save();
    return res.json(user.myEvents);
  } else {
    return res.status(404).json({ msg: 'Event not found' });
  }
});

router.delete('/myevents/:idx', auth, async (req, res) => {
  const idx = parseInt(req.params.idx);
  const user = await User.findById(req.user.id);
  if (user.myEvents[idx]) user.myEvents.splice(idx, 1);
  await user.save();
  res.json(user.myEvents);
});

// Notifications: get, create, mark as read
router.get('/notifications', auth, async (req, res) => {
  const user = await User.findById(req.user.id);
  res.json(user.notifications);
});
router.post('/notifications', auth, async (req, res) => {
  const { message, date, type = 'reminder', title = '' } = req.body;
  const user = await User.findById(req.user.id);
  // Use 'time' property for notification date, default to now if not provided
  const notif = { message, time: date ? new Date(date) : new Date(), read: false, type, title };
  user.notifications.push(notif);
  await user.save();
  // Add id field for frontend compatibility
  const notificationsWithId = user.notifications.map(n => ({
    ...n.toObject ? n.toObject() : n,
    id: n._id || n.id
  }));
  res.json(notificationsWithId);
});
router.post('/notifications/read', auth, async (req, res) => {
  const user = await User.findById(req.user.id);
  user.notifications.forEach(n => n.read = true);
  await user.save();
  res.json(user.notifications);
});

// Profile: update
router.put('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    
    if (req.body.name) user.name = req.body.name;
    if (req.body.email) user.email = req.body.email;
    if (Object.prototype.hasOwnProperty.call(req.body, 'avatar')) {
      user.avatar = req.body.avatar;
    }
    const profileUpdates = {};
    profileFields.forEach(field => {
      if (req.body[field] !== undefined) {
        profileUpdates[field] = req.body[field];
      }
    });
    user.profile = { ...user.profile, ...profileUpdates };
    await user.save();
    res.json({
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      profile: user.profile,
    });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ msg: 'Server error updating profile', error: err.message });
  }
});

// Fix all notification dates for all users
router.post('/notifications/fix-dates', async (req, res) => {
  try {
    const users = await User.find();
    let fixedCount = 0;
    for (const user of users) {
      let changed = false;
      for (const notif of user.notifications) {
        // If 'time' is missing or invalid, set it to now or try to parse 'date'
        if (!notif.time || isNaN(new Date(notif.time).getTime())) {
          if (notif.date && !isNaN(new Date(notif.date).getTime())) {
            notif.time = new Date(notif.date);
          } else {
            notif.time = new Date();
          }
          changed = true;
        }
      }
      if (changed) {
        await user.save();
        fixedCount++;
      }
    }
    res.json({ fixed: fixedCount });
  } catch (err) {
    res.status(500).json({ msg: 'Error fixing notification dates', error: err.message });
  }
});

module.exports = router;
