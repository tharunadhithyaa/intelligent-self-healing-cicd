// ============================================================================
// CivicPulse AI — MongoDB Database Initialization Script
// ============================================================================
// Initializes default database schemas, collections, and indexes on container boot.
// ============================================================================
const dbName = (typeof process !== 'undefined' && process && process.env && process.env.MONGO_INITDB_DATABASE)
  ? process.env.MONGO_INITDB_DATABASE
  : 'civicpulse';

db = db.getSiblingDB(dbName);

// Create collections safely
const existingCollections = db.getCollectionNames();

if (!existingCollections.includes('users')) {
  db.createCollection('users');
}
if (!existingCollections.includes('complaints')) {
  db.createCollection('complaints');
}
if (!existingCollections.includes('chats')) {
  db.createCollection('chats');
}

// Basic indexes
db.users.createIndex({ email: 1 }, { unique: true });
db.complaints.createIndex({ status: 1 });
db.complaints.createIndex({ createdAt: -1 });

print('CivicPulse MongoDB Initialized Successfully');

