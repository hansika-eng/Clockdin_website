const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const Reminder = require('./models/reminder.model');
const Event = require('./models/event.model');
const User = require('./models/user.model'); // Import User model

const reminders = require('./routes/reminders');
const CLIENT_URL =
(process.env.CLIENT_URL || 'https://clockdin-website.vercel.app').trim();
const FALLBACK_CLIENT_URL =
'https://clockdin-website.vercel.app';
const LOCAL_CLIENT_URL = 'http://localhost:3000';
const allowedOrigins = new Set([CLIENT_URL, FALLBACK_CLIENT_URL, LOCAL_CLIENT_URL]);
const app = express();

app.use(cors({
  origin: [...allowedOrigins],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  family: 4,
  retryWrites: true,
  w: 'majority',
})
.then(async () => {

  console.log('MongoDB connected');

  console.log('Reminder cron scheduled.');

})
  .catch(err => console.error('MongoDB error:', err));
// Setup nodemailer transporter (use your SMTP credentials)
const transporter = nodemailer.createTransport({
  service: 'gmail', // or your email provider
  auth: {
    user: process.env.EMAIL_USER, // set in .env
    pass: process.env.EMAIL_PASS  // set in .env
  }
});

// Cron job: runs every 1 minute
// =======================================
// CLOCKDIN REMINDER CRON
// =======================================

cron.schedule('* * * * *', async () => {

  console.log('Running reminder cron');

  try {

    const reminders = await Reminder.find({
      sent: false
    });

    const now = new Date();

    for (const reminder of reminders) {

      const event = reminder.eventData;

      if (!event?.deadline) continue;

      const deadline = new Date(event.deadline);

      const diffMs = deadline - now;

      const diffDays = Math.ceil(
  diffMs / (1000 * 60 * 60 * 24)
);
console.log("EVENT:", event.title);
console.log("DIFF DAYS:", diffDays);
console.log("NOW:", now);
console.log("DEADLINE:", deadline);

      let shouldSend = false;

      if (
        reminder.reminderType === '2days' &&
        diffDays === 2
      ) {
        shouldSend = true;
      }

      if (
        reminder.reminderType === '1day' &&
        diffDays === 1
      ) {
        shouldSend = true;
      }

      if (
        reminder.reminderType === 'sameDay' &&
        diffDays === 0
      ) {
        shouldSend = true;
      }

      if (!shouldSend) continue;

      await transporter.sendMail({

        from: process.env.EMAIL_USER,

        to: reminder.email,

        subject: `⏰ Clockdin Reminder: ${event.title}`,

        html: `

<div style="
  font-family: Arial, sans-serif;
  max-width: 650px;
  margin: auto;
  background: #ffffff;
  padding: 25px;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
">

  <h1 style="
    color:#4F46E5;
    font-size:36px;
    margin-bottom:15px;
  ">
    <span style="color:black;">
      Clockdin
    </span>
    Event Reminder
  </h1>

  <hr style="
    border:none;
    border-top:1px solid #d1d5db;
    margin-bottom:25px;
  "/>

  <h2 style="
    font-size:34px;
    color:#222;
    margin-bottom:20px;
  ">
    ${event.title}
  </h2>

  <p style="
    font-size:20px;
    color:#444;
    line-height:1.6;
    margin-bottom:30px;
  ">
    ${event.description || 'No description available'}
  </p>

  <p style="font-size:18px;">
    📅 <b>Event Date:</b>
    ${new Date(event.eventDate).toDateString()}
  </p>

  <p style="font-size:18px;">
    ⏳ <b>Deadline:</b>
    ${new Date(event.deadline).toDateString()}
  </p>

  <p style="font-size:18px;">
    📍 <b>Location:</b>
    ${event.location || 'Not specified'}
  </p>

  <p style="font-size:18px;">
    💻 <b>Mode:</b>
    ${event.mode || 'N/A'}
  </p>

  <p style="font-size:18px;">
    ⚡ <b>Difficulty:</b>
    ${event.difficulty || 'N/A'}
  </p>

  <p style="font-size:18px;">
    🏷️ <b>Tags:</b>
    ${event.tags?.join(', ') || 'None'}
  </p>

  <br/>

  <a
    href="${event.applyLink}"
    target="_blank"
    style="
      display:inline-block;
      background:#4F46E5;
      color:white;
      text-decoration:none;
      padding:14px 28px;
      border-radius:10px;
      font-size:18px;
      font-weight:bold;
    "
  >
    Apply Now
  </a>

  <br/><br/><br/>

  <hr style="
    border:none;
    border-top:1px solid #d1d5db;
    margin-top:20px;
  "/>

  <p style="
    color:gray;
    font-size:15px;
    margin-top:20px;
  ">
    Sent by <b>Clockdin</b>
  </p>

</div>

`
      });

      reminder.sent = true;

      await reminder.save();

      console.log(
        `Reminder sent to ${reminder.email}`
      );
    }

  } catch (err) {

    console.error(err);

  }

});
// ========================================
// MY EVENTS PERSONAL REMINDERS
// ========================================

cron.schedule('* * * * *', async () => {

  try {

    const now = new Date();

    const reminders = await Reminder
      .find({
        sent: false,
        remindAt: { $lte: now }
      })
      .populate('event')
      .populate('user');

   for (const reminder of reminders) {

  const event = reminder.eventData;

  // skip if no event
  if (!event) {

    reminder.sent = true;

    await reminder.save();

    continue;
  }

  console.log(
    `Sending PERSONAL reminder to ${reminder.email}`
  );

      await transporter.sendMail({

        from: process.env.EMAIL_USER,

        to: reminder.email,

        subject: `⏰ Personal Reminder: ${event.title}`,

        html: `

<div style="
  font-family: Arial, sans-serif;
  padding: 25px;
  max-width: 600px;
">

  <h1 style="
    color:#4F46E5;
    font-size:32px;
    margin-bottom:10px;
  ">
    ⏰ Clockdin Event Reminder
  </h1>

  <hr style="
    border:none;
    border-top:1px solid #ddd;
    margin:20px 0;
  "/>

  <p style="
    font-size:18px;
    margin-bottom:20px;
  ">
    Your personal event reminder.
  </p>

  <div style="
    background:#f5f7ff;
    padding:20px;
    border-radius:12px;
  ">

    <p style="font-size:18px;">
      <b>📌 Event:</b>
      ${event.title}
    </p>

    <p style="font-size:18px;">
      <b>📝 Description:</b>
      ${event.description || 'No description'}
    </p>

    <p style="font-size:18px;">
      <b>📍 Location:</b>
      ${event.location || 'Not specified'}
    </p>

  </div>

  <br/>

  <p style="
    color:gray;
    font-size:14px;
  ">
    Sent by Clockdin
  </p>

</div>

`
      });

      // VERY IMPORTANT
      reminder.sent = true;

      await reminder.save();

      console.log(
        `Personal reminder sent to ${reminder.email}`
      );

    }

  } catch (err) {

    console.error(
      'Personal reminder cron error:',
      err
    );

  }

});
// Setup logging
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}
const logFilePath = path.join(logsDir, 'server.log');
const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

function logMessage(message) {
  const timestamp = new Date().toISOString();
  logStream.write(`[${timestamp}] ${message}\n`);
}

// Middleware to log requests
app.use((req, res, next) => {
  logMessage(`Incoming request: ${req.method} ${req.url}`);
  next();
});

app.get('/', (_req, res) => res.send('Clockdin API is live.'));

// Log errors
app.use((err, req, res, next) => {
  logMessage(`Error: ${err.message}`);
  next(err);
});

// Routes
app.use('/api/users', require('./routes/users'));
app.use('/api/chatbot', require('./routes/chatbot'));
app.use('/api/events', require('./routes/events'));
app.use('/api/reminders', reminders);
app.use('/api/auth', require('./routes/auth'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

// Initialize passport Google strategy only when credentials are provided
const passport = require('passport');
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  try {
    require('./config/passportGoogle')(passport);
    app.use(passport.initialize());
  } catch (err) {
    console.error('Failed to initialize Google passport strategy:', err.message);
  }
} else {
  console.log('Google OAuth not configured; skipping passport Google strategy initialization.');
}