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
const CLIENT_URL = (process.env.CLIENT_URL || 'https://clockdin000007.vercel.app').trim();
const FALLBACK_CLIENT_URL = 'https://clockdin000007.vercel.app';
const LOCAL_CLIENT_URL = 'http://localhost:3000';
const allowedOrigins = new Set([CLIENT_URL, FALLBACK_CLIENT_URL, LOCAL_CLIENT_URL]);
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
};
const app = express();
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://clockdin-website.vercel.app'
  ],
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

  const now = new Date();

  console.log(`Cron job triggered at: ${now}`);

  try {

    const reminders = await Reminder.find({
  sent: false,
  "eventData.deadline": { $exists: true }
});

    console.log(`Reminders found: ${reminders.length}`);

    for (const reminder of reminders) {

      const event = reminder.eventData;

      if (!event || !event.deadline) continue;

      const deadline = new Date(event.deadline);

      const diffMs = deadline - now;

      const diffDays = Math.ceil(
        diffMs / (1000 * 60 * 60 * 24)
      );

      // SEND ONLY:
      // 2 days before
      // 1 day before
      // same day

      if (![2, 1, 0].includes(diffDays)) {
        continue;
      }

      console.log(
        `Sending reminder for ${event.title} (${diffDays} day left)`
      );

      try {

        await transporter.sendMail({

          from: process.env.EMAIL_USER,

          to: reminder.email,

          subject: `⏰ Clockdin Reminder: ${event.title}`,

          html: `

            <div style="font-family: Arial; padding: 20px;">

              <h1 style="color:#4F46E5;">
                Clockdin Event Reminder
              </h1>

              <hr/>

              <h2>${event.title}</h2>

              <p>
                ${event.description}
              </p>

              <br/>

              <p>
                <b>📅 Event Date:</b>
                ${new Date(event.eventDate).toDateString()}
              </p>

              <p>
                <b>⏳ Deadline:</b>
                ${deadline.toDateString()}
              </p>

              <p>
                <b>📍 Location:</b>
                ${event.location}
              </p>

              <p>
                <b>💻 Mode:</b>
                ${event.mode}
              </p>

              <p>
                <b>⚡ Difficulty:</b>
                ${event.difficulty}
              </p>

              <p>
                <b>🏷️ Tags:</b>
                ${event.tags.join(', ')}
              </p>

              <br/>

              <a
                href="${event.applyLink}"
                style="
                  background:#4F46E5;
                  color:white;
                  padding:12px 20px;
                  text-decoration:none;
                  border-radius:8px;
                "
              >
                Apply Now
              </a>

              <br/><br/>

              <hr/>

              <p style="color:gray;">
                Sent by Clockdin
              </p>

            </div>

          `
        });

        console.log(
          `Reminder sent to ${reminder.email}`
        );
        reminder.sent = true;
        await reminder.save();
        console.log("Reminder marked as sent");
      } catch (err) {

        console.error(
          `Error sending reminder to ${reminder.email}:`,
          err
        );

      }

    }

  } catch (err) {

    console.error('Error finding reminders:', err);

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