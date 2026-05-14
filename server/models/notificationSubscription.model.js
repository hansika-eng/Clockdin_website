const mongoose = require('mongoose');

const notificationSubscriptionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  event: { type: String, required: true },
  sent: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

notificationSubscriptionSchema.index({ user: 1, event: 1 }, { unique: true });

module.exports = mongoose.model('NotificationSubscription', notificationSubscriptionSchema);
