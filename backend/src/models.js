
import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const opts = { timestamps: true };

export const User = model('User', new Schema({
  name: { type: String, required: true, trim: true },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  passwordHash: { type: String, required: true },
  role: {
    type: String,
    enum: ['patient', 'doctor', 'admin'],
    default: 'patient'
  }
}, opts));

export const Doctor = model('Doctor', new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  name: { type: String, required: true },
  specialty: { type: String, required: true },
  qualification: String,
  experience: Number,
  hospital: String,
  contact: String,
  email: String,
  bio: String,
  slots: [String]
}, opts));

export const Conversation = model('Conversation', new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: { type: String, default: 'New conversation' },
  pendingBooking: {
    doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor' },
    slot: Date
  },
  messages: [{
    role: { type: String, enum: ['user', 'assistant'] },
    content: String,
    createdAt: { type: Date, default: Date.now }
  }]
}, opts));

const appointmentSchema = new Schema({
  patientId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  doctorId: {
    type: Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true
  },
  slot: { type: Date, required: true },
  status: {
    type: String,
    enum: ['booked', 'cancelled'],
    default: 'booked'
  }
}, opts);

// Prevent two active bookings for the same doctor and time.
appointmentSchema.index(
  { doctorId: 1, slot: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'booked' }
  }
);

export const Appointment = model('Appointment', appointmentSchema);
