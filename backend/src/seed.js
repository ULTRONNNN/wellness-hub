
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, Doctor } from './models.js';

await mongoose.connect(
  process.env.MONGODB_URI ||
  'mongodb://127.0.0.1:27017/wellness_hub'
);

async function account(name, email, password, role) {
  let user = await User.findOne({ email });

  if (!user) {
    user = await User.create({
      name,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role
    });
  }

  return user;
}

const doctorAccount = await account(
  'Dr. Asha Rao',
  'doctor@wellness.test',
  'Doctor123!',
  'doctor'
);

// All profiles below are fictional demonstration records.
// They are NOT verified doctors or real clinic appointments.
const doctors = [
  // GENERAL MEDICINE
  ['Dr. Asha Rao', 'General Medicine', 'MBBS, MD', 'City Wellness Clinic'],
  ['Dr. Rahul Menon', 'General Medicine', 'MBBS, MD', 'GreenLife Medical Centre'],
  ['Dr. Kavya Sharma', 'General Medicine', 'MBBS', 'Sunrise Family Clinic'],
  ['Dr. Aditya Nair', 'General Medicine', 'MBBS, MD', 'HealthFirst Clinic'],
  ['Dr. Meera Iyer', 'General Medicine', 'MBBS, MD', 'CarePoint Medical Centre'],

  // DERMATOLOGY
  ['Dr. Neha Shah', 'Dermatology', 'MBBS, MD Dermatology', 'Skin & Care Centre'],
  ['Dr. Ananya Rao', 'Dermatology', 'MBBS, MD Dermatology', 'DermaCare Clinic'],
  ['Dr. Rohan Kapoor', 'Dermatology', 'MBBS, DDVL', 'ClearSkin Medical Centre'],
  ['Dr. Sneha Kulkarni', 'Dermatology', 'MBBS, MD Dermatology', 'Glow Dermatology Clinic'],
  ['Dr. Arvind Shetty', 'Dermatology', 'MBBS, DNB Dermatology', 'SkinHealth Centre'],

  // CARDIOLOGY
  ['Dr. Vikram Mehta', 'Cardiology', 'MD, DM Cardiology', 'Heartline Hospital'],
  ['Dr. Kiran Desai', 'Cardiology', 'MD, DM Cardiology', 'CardioCare Centre'],
  ['Dr. Nikhil Rao', 'Cardiology', 'MD, DNB Cardiology', 'HeartWell Clinic'],
  ['Dr. Pooja Malhotra', 'Cardiology', 'MD, DM Cardiology', 'Pulse Medical Centre'],
  ['Dr. Sameer Joshi', 'Cardiology', 'MD, DM Cardiology', 'HeartPlus Hospital'],

  // NEUROLOGY
  ['Dr. Priya Nair', 'Neurology', 'MD, DM Neurology', 'NeuroCare Clinic'],
  ['Dr. Amit Verma', 'Neurology', 'MD, DM Neurology', 'BrainHealth Centre'],
  ['Dr. Ishita Rao', 'Neurology', 'MD, DNB Neurology', 'NeuroLife Clinic'],
  ['Dr. Sandeep Kumar', 'Neurology', 'MD, DM Neurology', 'NeuroWell Hospital'],
  ['Dr. Divya Menon', 'Neurology', 'MD, DM Neurology', 'Mind & Brain Centre'],

  // GASTROENTEROLOGY
  ['Dr. Arjun Patel', 'Gastroenterology', 'MD Gastroenterology', 'Digestive Health Centre'],
  ['Dr. Varun Shetty', 'Gastroenterology', 'MD, DM Gastroenterology', 'GastroCare Clinic'],
  ['Dr. Nisha Gupta', 'Gastroenterology', 'MD, DNB Gastroenterology', 'Digestive Wellness Centre'],
  ['Dr. Harish Rao', 'Gastroenterology', 'MD, DM Gastroenterology', 'GutHealth Hospital'],
  ['Dr. Tanvi Mehta', 'Gastroenterology', 'MD, DM Gastroenterology', 'StomachCare Clinic'],

  // PULMONOLOGY
  ['Dr. Sana Khan', 'Pulmonology', 'MD Pulmonology', 'Breathwell Clinic'],
  ['Dr. Farhan Ali', 'Pulmonology', 'MD Respiratory Medicine', 'LungCare Hospital'],
  ['Dr. Swathi Rao', 'Pulmonology', 'MD Pulmonary Medicine', 'BreatheEasy Clinic'],
  ['Dr. Imran Shaikh', 'Pulmonology', 'MD, DNB Pulmonology', 'Respira Medical Centre'],
  ['Dr. Akash Menon', 'Pulmonology', 'MD Pulmonary Medicine', 'Airway Health Clinic'],

  // PSYCHIATRY
  ['Dr. Riya Sen', 'Psychiatry', 'MD Psychiatry', 'Mindwell Centre'],
  ['Dr. Anjali Sharma', 'Psychiatry', 'MD Psychiatry', 'MindCare Clinic'],
  ['Dr. Rohit Bhat', 'Psychiatry', 'MD Psychiatry', 'Mental Wellness Centre'],
  ['Dr. Shreya Nair', 'Psychiatry', 'DNB Psychiatry', 'PeaceMind Clinic'],
  ['Dr. Vivek Rao', 'Psychiatry', 'MD Psychiatry', 'Harmony Mental Health Centre']
];

const schedules = [
  ['09:00', '10:00', '11:00', '14:00'],
  ['10:00', '11:00', '12:00', '15:00'],
  ['09:30', '10:30', '14:30', '16:00'],
  ['11:00', '12:00', '15:00', '16:00'],
  ['09:00', '12:00', '14:00', '17:00']
];

try {
  for (let i = 0; i < doctors.length; i++) {
    const [name, specialty, qualification, hospital] = doctors[i];

    const userId = name === 'Dr. Asha Rao'
      ? doctorAccount.id
      : null;

    await Doctor.updateOne(
      { name },
      {
        $set: {
          name,
          specialty,
          qualification,
          hospital,
          userId,
          experience: 5 + (i % 12),
          contact: 'Demo profile — no real contact',
          bio: `Fictional demonstration profile for ${specialty}.`,
          slots: schedules[i % schedules.length]
        }
      },
      { upsert: true }
    );
  }

  console.log(`Seed complete: ${doctors.length} demo doctors configured.`);
} finally {
  await mongoose.disconnect();
}
