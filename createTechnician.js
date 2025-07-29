require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

async function createTechnician() {
  await mongoose.connect(process.env.MONGODB_URI);

  const email = 'technician@cosmicsolutions.com';
  const password = 'Technician@123';

  await User.deleteMany({ email });

  const technician = new User({
    name: 'Technician User',
    email,
    password,
    role: 'technician'
  });

  await technician.save();
  console.log('Technician user created!');
  mongoose.disconnect();
}

createTechnician().catch(err => {
  console.error(err);
  mongoose.disconnect();
});