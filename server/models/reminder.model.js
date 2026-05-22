const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event'
  },

  email: {
    type: String,
    required: true
  },

  eventData: {
    type: Object,
    required: true
  },

  reminderType: {
    type: String,
    enum: ['2days', '1day', 'sameDay'],
    required: true
  },

  sent: {
    type: Boolean,
    default: false
  }

}, { timestamps: true });

module.exports = mongoose.model('Reminder', reminderSchema);