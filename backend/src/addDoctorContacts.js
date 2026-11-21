
import 'dotenv/config';
import mongoose from 'mongoose';
import { Doctor } from './models.js';

const MONGODB_URI =
  process.env.MONGODB_URI ||
  'mongodb://127.0.0.1:27017/wellness_hub';

async function main() {
  await mongoose.connect(MONGODB_URI);

  const doctors = await Doctor.find({})
    .sort({ specialty: 1, name: 1 });

  let updated = 0;

  for (let i = 0; i < doctors.length; i++) {
    const doctor = doctors[i];

    // Safe fictional contact information for demonstration.
    // No real phone calls or emails can be sent to these values.
    const demoPhone =
      `+1-202-555-${String(100 + i).padStart(4, '0')}`;

    const demoEmail =
      `doctor${String(i + 1).padStart(2, '0')}@example.com`;

    doctor.contact = demoPhone;
    doctor.email = demoEmail;

    await doctor.save();
    updated++;
  }

  console.log(
    `Updated contact information for ${updated} demo doctors.`
  );

  await mongoose.disconnect();
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
