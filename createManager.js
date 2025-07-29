require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

async function createManager() {
  await mongoose.connect(process.env.MONGODB_URI);

  const email = 'manager@cosmicsolutions.com';
  const password = 'Manager@123';

  await User.deleteMany({ email });

  const manager = new User({
    name: 'Manager User',
    email,
    password,
    role: 'manager'
  });

  await manager.save();
  console.log('Manager user created!');
  mongoose.disconnect();
}

createManager().catch(err => {
  console.error(err);
  mongoose.disconnect();
});