
import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const opts = { timestamps: true };

// ---------- USERS ----------

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

// ---------- DOCTORS ----------

export const Doctor = model('Doctor', new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  name: { type: String, required: true, trim: true },
  specialty: { type: String, required: true, trim: true },
  qualification: String,
  experience: Number,
  hospital: String,
  contact: String,
  email: String,
  bio: String,
  slots: [String],

  // New doctor management fields
  registrationNumber: {
    type: String,
    trim: true
  },
  consultationFee: {
    type: Number,
    default: 0,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, opts));

// ---------- AI CONVERSATIONS ----------

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
    role: {
      type: String,
      enum: ['user', 'assistant']
    },
    content: String,
    createdAt: { type: Date, default: Date.now }
  }]
}, opts));

// ---------- APPOINTMENTS ----------

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
  slot: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: [
      'booked',
      'pending',
      'confirmed',
      'cancelled',
      'completed'
    ],
    default: 'booked'
  }
}, opts);

// Preserve the existing booking index for now.
// The backend and MongoDB index will be updated together
// before new appointments use pending/confirmed statuses.
appointmentSchema.index(
  { doctorId: 1, slot: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'booked' }
  }
);

export const Appointment = model(
  'Appointment',
  appointmentSchema
);
