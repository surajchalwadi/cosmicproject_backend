require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

async function createAdmin() {
  await mongoose.connect(process.env.MONGODB_URI);

  const email = 'admin@cosmicsolutions.com';
  const password = 'Admin@123';

  // Remove any existing user with this email
  await User.deleteMany({ email });

  const admin = new User({
    name: 'Super Admin',
    email,
    password, // plain password, will be hashed by pre-save hook
    role: 'superadmin'
  });

  await admin.save();
  console.log('Admin user created!');
  mongoose.disconnect();
}

createAdmin().catch(err => {
  console.error(err);
  mongoose.disconnect();
});