import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// 1. Users Table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase / Auth UID
  email: text('email').notNull(),
  displayName: text('display_name'),
  photoUrl: text('photo_url'),
  role: text('role').default('user'),
  lastActive: timestamp('last_active').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 2. Activity / Usage Logs Table (Track every usage of the app)
export const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  userUid: text('user_uid').notNull(),
  userEmail: text('user_email'),
  module: text('module').notNull(), // 'antropometri', 'checkup-gigi', 'checkup-anak', 'consultation', 'iot', 'satusehat'
  action: text('action').notNull(), // 'APP_OPENED', 'ANALYSIS_PERFORMED', 'RECORD_SAVED', 'CONSULTATION_SENT', etc.
  details: text('details'), // JSON details or description
  metadata: text('metadata'), // JSON string
  createdAt: timestamp('created_at').defaultNow(),
});

// 3. Medical Records (Antropometri, Gigi, Anak, RME)
export const medicalRecords = pgTable('medical_records', {
  id: serial('id').primaryKey(),
  recordId: text('record_id').notNull().unique(),
  userId: integer('user_id').references(() => users.id),
  userUid: text('user_uid').notNull(),
  patientName: text('patient_name').notNull(),
  patientNik: text('patient_nik'),
  recordType: text('record_type').notNull(), // 'dental', 'child-growth', 'antropometri', 'consultation'
  analysisResult: text('analysis_result'), // Diagnosis / AI output
  payload: text('payload'), // Full JSON
  satusehatSynced: text('satusehat_synced').default('false'),
  satusehatResourceId: text('satusehat_resource_id'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 4. Appointments
export const appointments = pgTable('appointments', {
  id: serial('id').primaryKey(),
  appointmentId: text('appointment_id').notNull().unique(),
  userId: integer('user_id').references(() => users.id),
  userUid: text('user_uid').notNull(),
  patientName: text('patient_name').notNull(),
  doctorName: text('doctor_name').notNull(),
  clinicName: text('clinic_name').notNull(),
  date: text('date').notNull(),
  time: text('time').notNull(),
  status: text('status').default('scheduled'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 5. IoT Telemetries
export const iotTelemetries = pgTable('iot_telemetries', {
  id: serial('id').primaryKey(),
  deviceMac: text('device_mac').notNull(),
  deviceName: text('device_name').notNull(),
  deviceType: text('device_type').notNull(),
  telemetryData: text('telemetry_data').notNull(), // JSON string
  recordedByUid: text('recorded_by_uid'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Relationships
export const usersRelations = relations(users, ({ many }) => ({
  activityLogs: many(activityLogs),
  medicalRecords: many(medicalRecords),
  appointments: many(appointments),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
}));

export const medicalRecordsRelations = relations(medicalRecords, ({ one }) => ({
  user: one(users, {
    fields: [medicalRecords.userId],
    references: [users.id],
  }),
}));

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  user: one(users, {
    fields: [appointments.userId],
    references: [users.id],
  }),
}));
