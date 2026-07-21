import mongoose from 'mongoose';
import config from './index';
import { logger } from '../utils/logger.util';
import Role from '../models/role.model';
import User from '../models/user.model';
import { Permissions } from '../constants/permissions.constants';

const seedDefaultRoles = async (): Promise<void> => {
  try {
    const rolesCount = await Role.countDocuments();
    if (rolesCount > 0) {
      return; // Already seeded
    }

    const defaultRoles = [
      {
        name: 'citizen',
        description: 'Default citizen role with access to submit and track own complaints.',
        permissions: [
          Permissions.COMPLAINTS_VIEW,
          Permissions.PROFILE_MANAGE
        ]
      },
      {
        name: 'officer',
        description: 'Municipal officer role with access to view, update and resolve complaints.',
        permissions: [
          Permissions.COMPLAINTS_VIEW,
          Permissions.COMPLAINTS_MANAGE,
          Permissions.PROFILE_MANAGE
        ]
      },
      {
        name: 'field_worker',
        description: 'Field worker role with access to view complaints and manage profile details.',
        permissions: [
          Permissions.COMPLAINTS_VIEW,
          Permissions.PROFILE_MANAGE
        ]
      },
      {
        name: 'admin',
        description: 'Administrator role with full access to manage users, departments, reports and logs.',
        permissions: [
          Permissions.USERS_VIEW,
          Permissions.USERS_MANAGE,
          Permissions.DEPTS_MANAGE,
          Permissions.REPORTS_GENERATE,
          Permissions.AUDIT_VIEW,
          Permissions.ANALYTICS_VIEW,
          Permissions.COMPLAINTS_VIEW,
          Permissions.COMPLAINTS_MANAGE,
          Permissions.PROFILE_MANAGE,
          Permissions.ROLES_MANAGE
        ]
      }
    ];

    await Role.insertMany(defaultRoles);
    logger.info('🔑 Default roles and permissions seeded successfully');
  } catch (error) {
    logger.error('Failed to seed default roles:', error);
  }
};

import bcrypt from 'bcrypt';

const seedDefaultAdmin = async (): Promise<void> => {
  try {
    const adminExists = await User.findOne({ role: 'admin' });
    if (adminExists) return;

    const hashedPassword = await bcrypt.hash('AdminPassword123!', 10);
    const defaultAdmin = new User({
      firstName: 'System',
      lastName: 'Admin',
      email: 'admin@civicpulse.com',
      password: hashedPassword,
      role: 'admin',
      isVerified: true
    });

    await defaultAdmin.save();
    logger.info('👤 Default admin user created successfully (admin@civicpulse.com)');
  } catch (error) {
    logger.error('Failed to seed default admin:', error);
  }
};

export const connectDatabase = async (): Promise<void> => {
  try {
    mongoose.set('strictQuery', true);

    mongoose.connection.on('connected', () => {
      logger.info('MongoDB connected successfully');
    });

    mongoose.connection.on('error', (error: Error) => {
      logger.error('MongoDB connection error:', error);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    await mongoose.connect(config.mongodbUri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    // Seed default roles & permissions
    await seedDefaultRoles();
    
    // Seed default admin
    await seedDefaultAdmin();
  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
    process.exit(1);
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected gracefully');
  } catch (error) {
    logger.error('Error disconnecting from MongoDB:', error);
  }
};
