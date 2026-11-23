
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
const ACTIVE = ['booked', 'pending', 'confirmed'];

app.use(helmet());

app.use(cors({
  origin: (process.env.CORS_ORIGINS ||
    'http://localhost:5173,http://localhost:5174,http://localhost:5175')
    .split(',')
    .map(s => s.trim())
}));

app.use(express.json({ limit: '32kb' }));

// General API protection.
// Supports multiple dashboards refreshing regularly.
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1200,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: 'Too many requests. Please try again shortly.'
  }
}));

// Stricter protection for login attempts.
app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: 'Too many login attempts. Please try again later.'
  }
}));

const secret = process.env.JWT_SECRET;

if (!secret || secret.length < 32) {
  console.error('Set JWT_SECRET to at least 32 characters');
  process.exit(1);
}

const safe = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const publicUser = user => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role
});

function auth(req, res, next) {
  try {
    const token = (req.headers.authorization || '')
      .replace(/^Bearer /i, '');

    req.identity = jwt.verify(token, secret);
    next();
  } catch {
    res.status(401).json({
      error: 'Authentication required'
    });
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

const doctorEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Enter a valid Gmail address')
  .regex(
    /^[a-zA-Z0-9._%+-]+@gmail\.com$/,
    'Doctor login email must end with @gmail.com'
  );

const doctorPasswordSchema = z
  .string()
  .min(8, 'Password must contain at least 8 characters')
  .max(128, 'Password must not exceed 128 characters')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[0-9]/, 'Password must contain a number')
  .regex(
    /[^A-Za-z0-9]/,
    'Password must contain a special symbol'
  );

const doctorCredentialsSchema = z.object({
  email: doctorEmailSchema,
  password: doctorPasswordSchema
}).strict();


const appointmentPopulate = [
  {
    path: 'doctorId',
    select: 'name specialty hospital contact email'
  },
  {
    path: 'patientId',
    select: 'name email'
  }
];

// ---------- DATE HELPERS ----------

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
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
    parts.find(part => part.type === type)?.value;

  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`
  };
}

function validId(id) {
  return mongoose.isValidObjectId(id);
}

async function myDoctor(userId) {
  return Doctor.findOne({ userId });
}

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
    name: z.string()
      .trim()
      .min(2, 'Invalid name: enter at least 2 letters')
      .max(80, 'Name is too long')
      .regex(
        /^[\p{L}]+(?:[ .'-][\p{L}]+)*$/u,
        'Invalid name: only letters are allowed'
      )
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
    return res.status(404).json({
      error: 'User not found'
    });
  }

  res.json({ user: publicUser(user) });
}));

// ---------- EXISTING CAREBOT ----------

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
      if (!validId(conversationId)) {
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
            doctorId: String(
              conversation.pendingBooking.doctorId
            ),
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

// ---------- ADMIN DOCTOR MANAGEMENT ----------

const doctorSchema = z.object({
  name: z.string().trim().min(2).max(80),
  specialty: z.string().trim().min(2).max(100),
  qualification: z.string().trim().max(160).default(''),
  experience: z.coerce.number().int().min(0).max(80).default(0),
  hospital: z.string().trim().max(160).default(''),
  contact: z.string().trim().max(40).default(''),
  email: z.union([
    z.literal(''),
    z.string().email()
  ]).default(''),
  bio: z.string().trim().max(2000).default(''),
  registrationNumber: z.string().trim().max(100).default(''),
  consultationFee: z.coerce.number().min(0).default(0),
  slots: z.array(
    z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  ).max(48).default([]),
  isActive: z.boolean().default(true)
});

app.get(
  '/api/admin/doctors',
  auth,
  allow('admin'),
  safe(async (_req, res) => {
    const doctors = await Doctor.find()
      .populate('userId', 'name email role')
      .sort({ name: 1 })
      .lean();

    res.json(doctors);
  })
);

app.post(
  '/api/admin/doctors',
  auth,
  allow('admin'),
  safe(async (req, res) => {
    const data = doctorSchema.parse(req.body);

    const doctor = await Doctor.create({
      ...data,
      slots: [...new Set(data.slots)].sort()
    });

    res.status(201).json(doctor);
  })
);

app.patch(
  '/api/admin/doctors/:id',
  auth,
  allow('admin'),
  safe(async (req, res) => {
    if (!validId(req.params.id)) {
      return res.status(400).json({
        error: 'Invalid doctor ID'
      });
    }

    const data = doctorSchema.partial().strict()
      .parse(req.body);

    if (data.slots) {
      data.slots = [...new Set(data.slots)].sort();
    }

    const doctor = await Doctor.findByIdAndUpdate(
      req.params.id,
      { $set: data },
      { new: true, runValidators: true }
    );

    if (!doctor) {
      return res.status(404).json({
        error: 'Doctor not found'
      });
    }

    res.json(doctor);
  })
);

// Admin creates login for an existing doctor.

app.post(
  '/api/admin/doctors/:id/account',
  auth,
  allow('admin'),
  safe(async (req, res) => {
    if (!validId(req.params.id)) {
      return res.status(400).json({
        error: 'Invalid doctor ID'
      });
    }

    const { email, password } = doctorCredentialsSchema.parse(req.body);

    const doctor = await Doctor.findById(req.params.id);

    if (!doctor) {
      return res.status(404).json({
        error: 'Doctor not found'
      });
    }

    if (doctor.userId) {
      return res.status(409).json({
        error: 'Doctor already has a login account'
      });
    }

    const normalizedEmail = email.toLowerCase();

    if (await User.exists({ email: normalizedEmail })) {
      return res.status(409).json({
        error: 'Email already registered'
      });
    }

    const user = await User.create({
      name: doctor.name,
      email: normalizedEmail,
      passwordHash: await bcrypt.hash(password, 12),
      role: 'doctor'
    });

    try {
      doctor.userId = user.id;
      doctor.email = normalizedEmail;
      await doctor.save();
    } catch (error) {
      await User.deleteOne({ _id: user.id });
      throw error;
    }

    res.status(201).json({
      success: true,
      doctorId: doctor.id,
      user: publicUser(user)
    });
  })
);


 // ---------- ADMIN DOCTOR LOGIN MANAGEMENT ----------

 // View the linked login account for a doctor.
 app.get(
   '/api/admin/doctors/:id/account',
   auth,
   allow('admin'),
   safe(async (req, res) => {
     if (!validId(req.params.id)) {
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

     if (!doctor.userId) {
       return res.status(404).json({
         error: 'Doctor has no login account'
       });
     }

     const user = await User.findOne({
       _id: doctor.userId,
       role: 'doctor'
     });

     if (!user) {
       return res.status(404).json({
         error: 'Linked doctor login account not found'
       });
     }

     res.json({
       doctorId: doctor.id,
       user: publicUser(user)
     });
   })
 );

 // Admin changes a doctor's login email.
 app.patch(
   '/api/admin/doctors/:id/account/email',
   auth,
   allow('admin'),
   safe(async (req, res) => {
     if (!validId(req.params.id)) {
       return res.status(400).json({
         error: 'Invalid doctor ID'
       });
     }

     const { email } = z.object({
  email: doctorEmailSchema
}).strict().parse(req.body);
     const doctor = await Doctor.findById(req.params.id);

     if (!doctor || !doctor.userId) {
       return res.status(404).json({
         error: 'Doctor login account not found'
       });
     }

     const normalizedEmail = email.toLowerCase();

     const existing = await User.findOne({
       email: normalizedEmail,
       _id: { $ne: doctor.userId }
     });

     if (existing) {
       return res.status(409).json({
         error: 'Email is already registered'
       });
     }

     const user = await User.findOne({
       _id: doctor.userId,
       role: 'doctor'
     });

     if (!user) {
       return res.status(404).json({
         error: 'Linked doctor account not found'
       });
     }

     const oldEmail = user.email;

     user.email = normalizedEmail;

     await user.save();

     try {
       doctor.email = normalizedEmail;
       await doctor.save();
     } catch (error) {
       // Best-effort rollback if profile update fails.
       await User.updateOne(
         { _id: user.id, email: normalizedEmail },
         { $set: { email: oldEmail } }
       ).catch(rollbackError => {
         console.error('Email rollback failed:', rollbackError);
       });

       throw error;
     }

     res.json({
       success: true,
       message: 'Doctor login email updated',
       user: publicUser(user)
     });
   })
 );

 // Admin resets a doctor's password.
 app.patch(
   '/api/admin/doctors/:id/account/password',
   auth,
   allow('admin'),
   safe(async (req, res) => {
     if (!validId(req.params.id)) {
       return res.status(400).json({
         error: 'Invalid doctor ID'
       });
     }

     const { password } = z.object({
  password: doctorPasswordSchema
}).strict().parse(req.body);
     const doctor = await Doctor.findById(req.params.id);

     if (!doctor || !doctor.userId) {
       return res.status(404).json({
         error: 'Doctor login account not found'
       });
     }

     const user = await User.findOne({
       _id: doctor.userId,
       role: 'doctor'
     });

     if (!user) {
       return res.status(404).json({
         error: 'Linked doctor account not found'
       });
     }

     user.passwordHash = await bcrypt.hash(password, 12);

     await user.save();

     res.json({
       success: true,
       message: 'Doctor password reset successfully'
     });
   })
 );

// ---------- ADMIN PATIENT RECORDS ----------

app.get(
  '/api/admin/patients',
  auth,
  allow('admin'),
  safe(async (_req, res) => {
    const patients = await User.find({ role: 'patient' })
      .select('name email createdAt')
      .sort({ createdAt: -1 })
      .lean();

    res.json(patients);
  })
);

app.get(
  '/api/admin/patients/:id/appointments',
  auth,
  allow('admin'),
  safe(async (req, res) => {
    if (!validId(req.params.id)) {
      return res.status(400).json({
        error: 'Invalid patient ID'
      });
    }

    const appointments = await Appointment.find({
      patientId: req.params.id
    })
      .populate(appointmentPopulate)
      .sort({ createdAt: -1 })
      .lean();

    res.json(appointments);
  })
);

// ---------- DOCTOR DASHBOARD API ----------

app.get(
  '/api/doctor/me',
  auth,
  allow('doctor'),
  safe(async (req, res) => {
    const doctor = await myDoctor(req.identity.id);

    if (!doctor) {
      return res.status(404).json({
        error: 'Doctor profile not found'
      });
    }

    res.json(doctor);
  })
);

app.patch(
  '/api/doctor/availability',
  auth,
  allow('doctor'),
  safe(async (req, res) => {
    const data = z.object({
      slots: z.array(
        z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      ).max(48)
    }).parse(req.body);

    const doctor = await Doctor.findOneAndUpdate(
      { userId: req.identity.id },
      {
        $set: {
          slots: [...new Set(data.slots)].sort()
        }
      },
      { new: true, runValidators: true }
    );

    if (!doctor) {
      return res.status(404).json({
        error: 'Doctor profile not found'
      });
    }

    res.json(doctor);
  })
);

// Doctor confirms, cancels, or completes appointments.

app.patch(
  '/api/doctor/appointments/:id/status',
  auth,
  allow('doctor'),
  safe(async (req, res) => {
    const { status } = z.object({
      status: z.enum([
        'confirmed',
        'cancelled',
        'completed'
      ])
    }).parse(req.body);

    if (!validId(req.params.id)) {
      return res.status(400).json({
        error: 'Invalid appointment ID'
      });
    }

    const doctor = await myDoctor(req.identity.id);

    if (!doctor) {
      return res.status(404).json({
        error: 'Doctor profile not found'
      });
    }

    const appointment = await Appointment.findOne({
      _id: req.params.id,
      doctorId: doctor.id
    });

    if (!appointment) {
      return res.status(404).json({
        error: 'Appointment not found'
      });
    }

    const transitions = {
      booked: ['confirmed', 'cancelled', 'completed'],
      pending: ['confirmed', 'cancelled'],
      confirmed: ['cancelled', 'completed'],
      cancelled: [],
      completed: []
    };

    if (!(transitions[appointment.status] || [])
      .includes(status)) {
      return res.status(409).json({
        error: 'Invalid appointment status transition'
      });
    }

    if (status === 'completed' &&
        appointment.slot > new Date()) {
      return res.status(400).json({
        error: 'Cannot complete a future appointment'
      });
    }

    const updated = await Appointment.findOneAndUpdate(
      {
        _id: appointment.id,
        doctorId: doctor.id,
        status: appointment.status
      },
      { $set: { status } },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(409).json({
        error: 'Appointment changed. Refresh and try again.'
      });
    }

    res.json(updated);
  })
);

// ---------- PUBLIC DOCTOR LIST FOR PATIENTS ----------

app.get('/api/doctors', auth, safe(async (req, res) => {
  const filter = {
    isActive: { $ne: false }
  };

  if (req.query.specialty) {
    filter.specialty = String(req.query.specialty);
  }

  const doctors = await Doctor.find(filter)
    .select('-__v')
    .sort({ name: 1 })
    .lean();

  res.json(doctors);
}));

app.get('/api/doctors/match', auth, safe(async (req, res) => {
  const specialty = specialtyFor(
    String(req.query.query || '')
  );

  const doctors = await Doctor.find({
    specialty,
    isActive: { $ne: false }
  }).lean();

  res.json({ specialty, doctors });
}));

// ---------- DOCTOR AVAILABLE SLOTS ----------

app.get(
  '/api/doctors/:id/slots',
  auth,
  safe(async (req, res) => {
    if (!validId(req.params.id)) {
      return res.status(400).json({
        error: 'Invalid doctor ID'
      });
    }

    const doctor = await Doctor.findById(req.params.id);

    if (!doctor || doctor.isActive === false) {
      return res.status(404).json({
        error: 'Doctor not available'
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
      status: { $in: ACTIVE },
      slot: { $gte: start, $lt: end }
    }).select('slot').lean();

    const occupied = new Set(
      taken.map(a => a.slot.toISOString())
    );

    const slots = doctor.slots
      .map(time =>
        localSlotToUTC(date, time).toISOString()
      )
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

// ---------- GET APPOINTMENTS ----------

app.get(
  '/api/appointments',
  auth,
  safe(async (req, res) => {
    const filter = {};

    if (req.identity.role === 'patient') {
      filter.patientId = req.identity.id;
    } else if (req.identity.role === 'doctor') {
      const doctor = await myDoctor(req.identity.id);

      if (!doctor) return res.json([]);

      filter.doctorId = doctor.id;
    } else if (req.identity.role !== 'admin') {
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

// ---------- PATIENT BOOKING ----------

app.post(
  '/api/appointments',
  auth,
  allow('patient'),
  safe(async (req, res) => {
    const data = z.object({
      doctorId: z.string(),
      slot: z.string().datetime({ offset: true })
    }).parse(req.body);

    if (!validId(data.doctorId)) {
      return res.status(400).json({
        error: 'Invalid doctor ID'
      });
    }

    const doctor = await Doctor.findById(data.doctorId);

    if (!doctor || doctor.isActive === false) {
      return res.status(404).json({
        error: 'Doctor not available'
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
        status: 'pending'
      });

      res.status(201).json(appointment);
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({
          error: 'This appointment slot is already booked'
        });
      }

      throw error;
    }
  })
);

// ---------- CANCEL APPOINTMENT ----------

app.patch(
  '/api/appointments/:id/cancel',
  auth,
  safe(async (req, res) => {
    if (!validId(req.params.id)) {
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

    if (req.identity.role === 'patient' &&
        String(appointment.patientId) !==
        String(req.identity.id)) {
      return res.status(403).json({
        error: 'You cannot cancel this appointment'
      });
    }

    if (req.identity.role === 'doctor') {
      const doctor = await myDoctor(req.identity.id);

      if (!doctor ||
          String(appointment.doctorId) !==
          String(doctor.id)) {
        return res.status(403).json({
          error: 'Forbidden'
        });
      }
    }

    if (!['patient', 'doctor', 'admin']
      .includes(req.identity.role)) {
      return res.status(403).json({
        error: 'Forbidden'
      });
    }

    if (appointment.status === 'completed') {
      return res.status(409).json({
        error: 'Completed appointments cannot be cancelled'
      });
    }

    if (appointment.status === 'cancelled') {
      return res.json(appointment);
    }

    const updated = await Appointment.findOneAndUpdate(
      {
        _id: appointment.id,
        status: { $in: ACTIVE }
      },
      { $set: { status: 'cancelled' } },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(409).json({
        error: 'Appointment changed. Refresh and try again.'
      });
    }

    res.json(updated);
  })
);

// ---------- PRESERVE APPOINTMENT HISTORY ----------

app.delete(
  '/api/admin/appointments/:id',
  auth,
  allow('admin'),
  safe(async (req, res) => {
    if (!validId(req.params.id)) {
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

    res.status(409).json({
      error:
        'Permanent deletion is disabled to preserve patient records. Cancel the appointment instead.'
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
      const doctor = await myDoctor(req.identity.id);

      if (!doctor) {
        return res.json({
          appointments: 0,
          booked: 0,
          pending: 0,
          confirmed: 0,
          cancelled: 0,
          completed: 0,
          doctors: 0,
          patients: 0
        });
      }

      filter.doctorId = doctor.id;
    }

    const [
      appointments,
      booked,
      pending,
      confirmed,
      cancelled,
      completed,
      doctors,
      patients
    ] = await Promise.all([
      Appointment.countDocuments(filter),
      Appointment.countDocuments({
        ...filter,
        status: { $in: ACTIVE }
      }),
      Appointment.countDocuments({
        ...filter,
        status: 'pending'
      }),
      Appointment.countDocuments({
        ...filter,
        status: 'confirmed'
      }),
      Appointment.countDocuments({
        ...filter,
        status: 'cancelled'
      }),
      Appointment.countDocuments({
        ...filter,
        status: 'completed'
      }),
      req.identity.role === 'admin'
        ? Doctor.countDocuments()
        : Promise.resolve(1),
      req.identity.role === 'admin'
        ? User.countDocuments({ role: 'patient' })
        : Appointment.distinct('patientId', filter)
            .then(ids => ids.length)
    ]);

    res.json({
      appointments,
      booked,
      pending,
      confirmed,
      cancelled,
      completed,
      doctors,
      patients
    });
  })
);

// ---------- ERROR HANDLING ----------

app.use((error, _req, res, _next) => {
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      error: error.issues.map(i => i.message).join('; ')
    });
  }

  if (error.code === 11000) {
    return res.status(409).json({
      error: 'Appointment slot or record already exists'
    });
  }

  console.error(error);

  res.status(500).json({
    error: 'Server error'
  });
});

// ---------- MONGODB CONNECTION ----------

await mongoose.connect(
  process.env.MONGODB_URI ||
  'mongodb://127.0.0.1:27017/wellness_hub'
);

// Keep the old booked-only index.
// Add a separate index covering all active bookings.
// Do not start accepting new bookings if index creation fails.

await Appointment.collection.createIndex(
  { doctorId: 1, slot: 1 },
  {
    name: 'unique_active_doctor_slot_v2',
    unique: true,
    partialFilterExpression: {
      status: { $in: ACTIVE }
    }
  }
);

console.log('MongoDB connected successfully');

app.listen(PORT, () => {
  console.log(
    `Wellness Hub API running at http://localhost:${PORT}`
  );
});
