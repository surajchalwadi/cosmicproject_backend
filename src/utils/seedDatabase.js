const User = require('../models/User');
const Project = require('../models/Project');
const logger = require('./logger');
const { DEFAULT_USERS } = require('./constants');

/**
 * Seed super admin user
 */
const seedSuperAdmin = async () => {
  try {
    // Check if super admin already exists
    const existingSuperAdmin = await User.findOne({ role: 'superadmin' });
    
    if (existingSuperAdmin) {
      console.log('✅ Super admin already exists');
      return existingSuperAdmin;
    }

    // Create default super admin
    const superAdmin = new User({
      name: 'System Administrator',
      email: 'admin@cosmicsolutions.com',
      password: 'admin123',
      role: 'superadmin',
      department: 'Administration'
    });

    await superAdmin.save();
    
    console.log('✅ Default super admin created');
    console.log('📧 Email: admin@cosmicsolutions.com');
    console.log('🔑 Password: admin123');
    console.log('⚠️  Please change the default password after first login!');
    
    return superAdmin;
  } catch (error) {
    console.error('❌ Error creating super admin:', error);
    throw error;
  }
};

/**
 * Seed sample managers and technicians
 */
const seedSampleData = async () => {
  try {
    // Create sample managers
    const managers = [
      {
        name: 'John Manager',
        email: 'john.manager@cosmicsolutions.com',
        password: 'manager123',
        role: 'manager',
        department: 'Security Systems',
        phone: '+1234567890'
      },
      {
        name: 'Sarah Wilson',
        email: 'sarah.wilson@cosmicsolutions.com',
        password: 'manager123',
        role: 'manager',
        department: 'Installation',
        phone: '+1234567891'
      }
    ];

    // Create sample technicians
    const technicians = [
      {
        name: 'Mike Technician',
        email: 'mike.tech@cosmicsolutions.com',
        password: 'tech123',
        role: 'technician',
        department: 'Field Operations',
        phone: '+1234567892'
      },
      {
        name: 'Lisa Brown',
        email: 'lisa.brown@cosmicsolutions.com',
        password: 'tech123',
        role: 'technician',
        department: 'Maintenance',
        phone: '+1234567893'
      }
    ];

    const allSampleUsers = [...managers, ...technicians];

    // Create users if they don't exist
    for (const userData of allSampleUsers) {
      const existingUser = await User.findOne({ email: userData.email });
      if (!existingUser) {
        const user = new User(userData);
        await user.save();
        console.log(`✅ Sample ${userData.role} created: ${user.name}`);
      }
    }

    return allSampleUsers;
  } catch (error) {
    console.error('❌ Error creating sample data:', error);
    throw error;
  }
};

/**
 * Seed database with default users from constants
 */
const seedDefaultUsers = async () => {
  try {
    // Check if users already exist
    const existingUserCount = await User.countDocuments();
    
    if (existingUserCount > 0) {
      logger.info('Database already seeded with users');
      return;
    }

    // Create default users from constants
    const users = await User.insertMany(DEFAULT_USERS);
    
    logger.info(`✅ Database seeded with ${users.length} default users`);
    
    // Log default credentials
    logger.info('Default login credentials:');
    users.forEach(user => {
      const defaultUser = DEFAULT_USERS.find(du => du.email === user.email);
      logger.info(`${user.role}: ${user.email} / ${defaultUser.password}`);
    });

    return users;
  } catch (error) {
    logger.error(`❌ Database seeding failed: ${error.message}`);
    throw error;
  }
};

/**
 * Master seed function that orchestrates all seeding operations
 */
const seedDatabase = async () => {
  try {
    console.log('🌱 Starting database seeding...');
    
    // Check if database is already seeded
    const existingUserCount = await User.countDocuments();
    
    if (existingUserCount > 0) {
      console.log('✅ Database already contains users, skipping seeding');
      logger.info('Database already seeded with users');
      return;
    }

    // Seed super admin first
    await seedSuperAdmin();
    
    // Seed sample data
    await seedSampleData();
    
    // Seed default users if constants are available
    if (DEFAULT_USERS && DEFAULT_USERS.length > 0) {
      await seedDefaultUsers();
    }
    
    console.log('🎉 Database seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Database seeding failed:', error.message);
    logger.error(`❌ Database seeding failed: ${error.message}`);
    throw error;
  }
};

module.exports = {
  seedDatabase,
  seedSuperAdmin,
  seedSampleData,
  seedDefaultUsers
};