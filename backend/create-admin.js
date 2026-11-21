
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from './src/models.js';

const email = 'admin@gmail.com';
const password = 'Admin@12345';

try {
  await mongoose.connect(
    process.env.MONGODB_URI ||
    'mongodb://127.0.0.1:27017/wellness_hub'
  );

  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await User.findOne({ email });

  if (existing) {
    existing.passwordHash = passwordHash;
    existing.role = 'admin';
    await existing.save();
    console.log('Admin password updated successfully!');
  } else {
    await User.create({
      name: 'Wellness Hub Admin',
      email,
      passwordHash,
      role: 'admin',
    });

    console.log('New admin account created successfully!');
  }

  console.log('Admin email:', email);
} catch (error) {
  console.error('ERROR:', error.message);
} finally {
  await mongoose.disconnect();
}
