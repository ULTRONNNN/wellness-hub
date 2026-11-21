
import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

import {
  User,
  Doctor,
  Conversation,
  Appointment
} from './models.js';

import { respond } from './ai.js';
import { specialtyFor } from './knowledge.js';

const app = express();
const PORT = Number(process.env.PORT || 4000);
const TIMEZONE = 'Asia/Kolkata';

app.use(helmet());

app.use(cors({
  origin: (process.env.CORS_ORIGINS ||
    'http://localhost:5173').split(',').map(s => s.trim())
}));

app.use(express.json({ limit: '32kb' }));

app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false
}));

const secret = process.env.JWT_SECRET;

if (!secret || secret.length < 32) {
  console.error('Set JWT_SECRET to at least 32 characters');
  process.exit(1);
}

const safe = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const publicUser = u => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role
});

function auth(req, res, next) {
  try {
    const token = (req.headers.authorization || '')
      .replace(/^Bearer /i, '');

    req.identity = jwt.verify(token, secret);
    next();
  } catch {
    res.status(401).json({ error: 'Authentication required' });
  }
}

const allow = (...roles) => (req, res, next) =>
  roles.includes(req.identity.role)
    ? next()
    : res.status(403).json({ error: 'Forbidden' });

const issue = user => jwt.sign(
  { id: user.id, role: user.role },
  secret,
  { expiresIn: '7d' }
);

const credentials = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128)
});

// ---------- DATE AND TIME HELPERS ----------

// Doctors' stored slots are treated as India-local HH:mm times.
// Example: 16:00 means 4 PM IST, not 4 PM UTC.

function validDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;

  const d = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) &&
    d.toISOString().slice(0, 10) === date;
}

function localSlotToUTC(date, time) {
  if (!validDate(date) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new Error('Invalid date or time');
  }

  return new Date(`${date}T${time}:00+05:30`);
}

function istDateTime(value) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(value);

  const get = type =>
    parts.find(p => p.type === type)?.value;

  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`
  };
}

const appointmentPopulate = [
  { path: 'doctorId', select: 'name specialty hospital contact email' },
  { path: 'patientId', select: 'name email' }
];

// ---------- HEALTH ----------

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'Wellness Hub API',
    timezone: TIMEZONE
  });
});

// ---------- AUTHENTICATION ----------

app.post('/api/auth/register', safe(async (req, res) => {
  const data = credentials.extend({
    name: z.string().min(2).max(80)
  }).parse(req.body);

  const email = data.email.toLowerCase();

  if (await User.exists({ email })) {
    return res.status(409).json({
      error: 'Email already registered'
    });
  }

  const user = await User.create({
    name: data.name,
    email,
    passwordHash: await bcrypt.hash(data.password, 12),
    role: 'patient'
  });

  res.status(201).json({
    token: issue(user),
    user: publicUser(user)
  });
}));

app.post('/api/auth/login', safe(async (req, res) => {
  const data = credentials.parse(req.body);

  const user = await User.findOne({
    email: data.email.toLowerCase()
  });

  if (!user ||
      !(await bcrypt.compare(data.password, user.passwordHash))) {
    return res.status(401).json({
      error: 'Invalid email or password'
    });
  }

  res.json({
    token: issue(user),
    user: publicUser(user)
  });
}));

app.get('/api/auth/me', auth, safe(async (req, res) => {
  const user = await User.findById(req.identity.id);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ user: publicUser(user) });
}));

// ---------- AI CONVERSATIONS ----------

app.get(
  '/api/chat/conversations',
  auth,
  allow('patient'),
  safe(async (req, res) => {
    const conversations = await Conversation.find({
      userId: req.identity.id
    })
      .sort({ updatedAt: -1 })
      .limit(30)
      .lean();

    res.json(conversations);
  })
);

app.post(
  '/api/chat',
  auth,
  allow('patient'),
  safe(async (req, res) => {
    const { message, conversationId } = z.object({
      message: z.string().trim().min(1).max(2000),
      conversationId: z.string().optional()
    }).parse(req.body);

    let conversation;

    if (conversationId) {
      if (!mongoose.isValidObjectId(conversationId)) {
        return res.status(400).json({
          error: 'Invalid conversation ID'
        });
      }

      conversation = await Conversation.findOne({
        _id: conversationId,
        userId: req.identity.id
      });

      if (!conversation) {
        return res.status(404).json({
          error: 'Conversation not found'
        });
      }
    } else {
      conversation = new Conversation({
        userId: req.identity.id,
        title: message.slice(0, 48),
        messages: []
      });
    }

    const history = [
      ...conversation.messages.map(m => ({
        role: m.role,
        content: m.content
      })),
      { role: 'user', content: message }
    ];

    const result = await respond(history, {
      patientId: req.identity.id,
      pendingBooking: conversation.pendingBooking?.doctorId
        ? {
            doctorId: String(conversation.pendingBooking.doctorId),
            slot: new Date(
              conversation.pendingBooking.slot
            ).toISOString()
          }
        : null
    });

    conversation.pendingBooking = result.pendingBooking
      ? {
          doctorId: result.pendingBooking.doctorId,
          slot: new Date(result.pendingBooking.slot)
        }
      : undefined;

    conversation.messages.push(
      { role: 'user', content: message },
      { role: 'assistant', content: result.reply }
    );

    await conversation.save();

    const { pendingBooking, ...publicResult } = result;

    res.json({
      conversationId: conversation.id,
      ...publicResult,
      messages: conversation.messages
    });
  })
);

// ---------- DOCTORS ----------

app.get('/api/doctors', auth, safe(async (req, res) => {
  const filter = req.query.specialty
    ? { specialty: String(req.query.specialty) }
    : {};

  const doctors = await Doctor.find(filter)
    .select('-__v')
    .lean();

  res.json(doctors);
}));

app.get('/api/doctors/match', auth, safe(async (req, res) => {
  const specialty = specialtyFor(
    String(req.query.query || '')
  );

  const doctors = await Doctor.find({ specialty }).lean();

  res.json({ specialty, doctors });
}));

// Available slots for a doctor's selected India-local date.
app.get(
  '/api/doctors/:id/slots',
  auth,
  safe(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        error: 'Invalid doctor ID'
      });
    }

    const doctor = await Doctor.findById(req.params.id);

    if (!doctor) {
      return res.status(404).json({
        error: 'Doctor not found'
      });
    }

    const date = String(req.query.date || '');

    if (!validDate(date)) {
      return res.status(400).json({
        error: 'Invalid appointment date'
      });
    }

    const start = localSlotToUTC(date, '00:00');
    const end = new Date(
      start.getTime() + 24 * 60 * 60 * 1000
    );

    const taken = await Appointment.find({
      doctorId: doctor.id,
      status: 'booked',
      slot: { $gte: start, $lt: end }
    }).select('slot').lean();

    const occupied = new Set(
      taken.map(a => a.slot.toISOString())
    );

    const slots = doctor.slots
      .map(time => localSlotToUTC(date, time).toISOString())
      .filter(slot =>
        new Date(slot) > new Date() &&
        !occupied.has(slot)
      );

    res.json({
      date,
      timezone: TIMEZONE,
      slots
    });
  })
);

// ---------- APPOINTMENTS ----------

// Patients see their own bookings.
// Doctors see their own bookings.
// Admins see every doctor's bookings.

app.get(
  '/api/appointments',
  auth,
  safe(async (req, res) => {
    const filter = {};

    if (req.identity.role === 'patient') {
      filter.patientId = req.identity.id;
    }

    if (req.identity.role === 'doctor') {
      const doctor = await Doctor.findOne({
        userId: req.identity.id
      });

      if (!doctor) return res.json([]);

      filter.doctorId = doctor.id;
    }

    if (!['patient', 'doctor', 'admin']
      .includes(req.identity.role)) {
      return res.status(403).json({
        error: 'Forbidden'
      });
    }

    const appointments = await Appointment.find(filter)
      .populate(appointmentPopulate)
      .sort({ slot: 1 })
      .lean();

    res.json(appointments);
  })
);

// Dedicated central admin endpoint.
app.get(
  '/api/admin/appointments',
  auth,
  allow('admin'),
  safe(async (_req, res) => {
    const appointments = await Appointment.find()
      .populate(appointmentPopulate)
      .sort({ slot: -1 })
      .lean();

    res.json(appointments);
  })
);

// Create appointment from the selected ISO timestamp.
app.post(
  '/api/appointments',
  auth,
  allow('patient'),
  safe(async (req, res) => {
    const data = z.object({
      doctorId: z.string(),
      slot: z.string().datetime({ offset: true })
    }).parse(req.body);

    if (!mongoose.isValidObjectId(data.doctorId)) {
      return res.status(400).json({
        error: 'Invalid doctor ID'
      });
    }

    const doctor = await Doctor.findById(data.doctorId);

    if (!doctor) {
      return res.status(404).json({
        error: 'Doctor not found'
      });
    }

    const slot = new Date(data.slot);

    if (Number.isNaN(slot.getTime()) ||
        slot <= new Date()) {
      return res.status(400).json({
        error: 'Appointment must be in the future'
      });
    }

    const local = istDateTime(slot);

    if (!doctor.slots.includes(local.time)) {
      return res.status(400).json({
        error: 'Doctor is unavailable at this time'
      });
    }

    // Ensure the submitted instant is exactly the advertised
    // local slot, not an incorrectly encoded UTC time.
    const expected = localSlotToUTC(
      local.date,
      local.time
    );

    if (slot.getTime() !== expected.getTime()) {
      return res.status(400).json({
        error: 'Invalid appointment slot'
      });
    }

    try {
      const appointment = await Appointment.create({
        doctorId: doctor.id,
        patientId: req.identity.id,
        slot,
        status: 'booked'
      });

      res.status(201).json(appointment);
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({
          error: 'This appointment slot is already booked'
        });
      }

      throw err;
    }
  })
);

// Cancel appointment with role-based permission checks.
app.patch(
  '/api/appointments/:id/cancel',
  auth,
  safe(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        error: 'Invalid appointment ID'
      });
    }

    const appointment = await Appointment.findById(
      req.params.id
    );

    if (!appointment) {
      return res.status(404).json({
        error: 'Appointment not found'
      });
    }

    if (
  req.identity.role === 'patient' &&
  String(appointment.patientId) !== String(req.identity.id)
) {
  return res.status(403).json({
    error: 'You do not have permission to cancel this appointment'
  });
}

    if (req.identity.role === 'doctor') {
      const doctor = await Doctor.findOne({
        userId: req.identity.id
      });

      if (!doctor ||
          String(appointment.doctorId) !== String(doctor.id)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    if (!['patient', 'doctor', 'admin']
      .includes(req.identity.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (appointment.status === 'cancelled') {
      return res.json(appointment);
    }

    appointment.status = 'cancelled';
    await appointment.save();

    res.json(appointment);
  })
);

app.delete(
  '/api/admin/appointments/:id',
  auth,
  allow('admin'),
  safe(async (req, res) => {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        error: 'Invalid appointment ID'
      });
    }

    const appointment = await Appointment.findByIdAndDelete(id);

    if (!appointment) {
      return res.status(404).json({
        error: 'Appointment not found'
      });
    }

    res.json({
      success: true,
      message: 'Appointment permanently deleted',
      deletedId: id
    });
  })
);


// ---------- DASHBOARD SUMMARY ----------

app.get(
  '/api/dashboard/summary',
  auth,
  allow('doctor', 'admin'),
  safe(async (req, res) => {
    const filter = {};

    if (req.identity.role === 'doctor') {
      const doctor = await Doctor.findOne({
        userId: req.identity.id
      });

      if (!doctor) {
        return res.json({
          appointments: 0,
          booked: 0,
          cancelled: 0,
          doctors: await Doctor.countDocuments(),
          patients: await User.countDocuments({
            role: 'patient'
          })
        });
      }

      filter.doctorId = doctor.id;
    }

    const [
      appointments,
      booked,
      cancelled,
      doctors,
      patients
    ] = await Promise.all([
      Appointment.countDocuments(filter),
      Appointment.countDocuments({
        ...filter,
        status: 'booked'
      }),
      Appointment.countDocuments({
        ...filter,
        status: 'cancelled'
      }),
      Doctor.countDocuments(),
      User.countDocuments({ role: 'patient' })
    ]);

    res.json({
      appointments,
      booked,
      cancelled,
      doctors,
      patients
    });
  })
);

// ---------- ERROR HANDLING ----------

app.use((err, _req, res, _next) => {
  if (err instanceof z.ZodError) {
    return res.status(400).json({
      error: err.issues.map(i => i.message).join('; ')
    });
  }

  if (err.code === 11000) {
    return res.status(409).json({
      error: 'Appointment slot or record already exists'
    });
  }

  console.error(err);

  res.status(500).json({
    error: 'Server error'
  });
});

// ---------- DATABASE AND SERVER ----------

await mongoose.connect(
  process.env.MONGODB_URI ||
  'mongodb://127.0.0.1:27017/wellness_hub'
);

console.log('MongoDB connected successfully');

app.listen(PORT, () => {
  console.log(
    `Wellness Hub API running at http://localhost:${PORT}`
  );
});
