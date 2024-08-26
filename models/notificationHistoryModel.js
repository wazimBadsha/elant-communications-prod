const mongoose = require('mongoose');
const { Schema } = mongoose;

const NotificationHistorySchema = new Schema({
  // Inlining the BaseModel fields here if they exist.
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  typeId: {
    type: Schema.Types.ObjectId,
    required: true,
  },
  type: {
    type: String,
    required: true,
  },
  parentType: {
    type: String,
    required: true,
  },
  payloadData: {
    type: Map,
    of: String,
    required: true,
  },
  receiversList: [
    {
      type: Schema.Types.ObjectId,
      required: true,
    }
  ],
  isCommon: {
    type: Boolean,
    required: true,
  },
  read: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
});

// Pre-save hook to update the `updatedAt` field automatically
NotificationHistorySchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

const NotificationHistory = mongoose.model('NotificationHistory', NotificationHistorySchema);

module.exports = NotificationHistory;