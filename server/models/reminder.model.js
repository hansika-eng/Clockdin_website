const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },

  email: { type: String, required: true },

  remindAt: { type: Date, required: true },

  sent: { type: Boolean, default: false },

  eventData: Object
});

module.exports = mongoose.model('Reminder', reminderSchema);