// models/userModel.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const GoalInfoSchema = new Schema({
    goal: { type: String, required: true },
    paper_id: { type: String, required: true }
});

const UserSchema = new Schema({
    mobileNumber: { type: String, required: true },
    countryCode: { type: String, required: true },
    otp: { type: String, required: false, select: false },
    otpIssuedAt: { type: Date, required: false, select: false },
    name: { type: String, required: true },
    birthday: { type: String, required: true },
    gender: { type: String, enum: ['Male', 'Female', 'Other'], required: true },
    avatar_id: { type: String, required: true },
    notification_id: { type: String, required: true },
    selected_goal: { type: String, required: true },
    goal_info: [GoalInfoSchema],
    selected_course: { type: String, required: true },
    verified: { type: Boolean, required: true },
    strike_rate: { type: String, required: true },
    status: { type: Number, enum: [0, 1, 2, 3], required: true } // 0: disable, 1: active, 2: pending, 3: blocked
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);