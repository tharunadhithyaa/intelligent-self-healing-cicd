// Default MongoDB Initialization Script
// This script creates the database and default collections
const dbName = process.env.MONGO_INITDB_DATABASE || 'civicpulse';

db = db.getSiblingDB(dbName);

// Create collections
db.createCollection('users');
db.createCollection('complaints');
db.createCollection('chats');

// Basic indexes
db.users.createIndex({ email: 1 }, { unique: true });
db.complaints.createIndex({ status: 1 });
db.complaints.createIndex({ createdAt: -1 });

print('CivicPulse MongoDB Initialized Successfully');
