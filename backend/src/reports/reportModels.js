import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const medicalReportSchema = new Schema({
  patientId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  reportType: {
    type: String,
    required: true
  },

  reportDate: {
    type: Date,
    required: true
  },

  encryptedReport: {
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
    encryptedData: { type: String, required: true }
  },

  encryptedAnalysis: {
    iv: String,
    authTag: String,
    encryptedData: String
  },

  consentForAI: {
    type: Boolean,
    default: false
  },

  demoOnly: {
    type: Boolean,
    default: true,
    immutable: true
  },

  status: {
    type: String,
    enum: ['stored', 'analyzed'],
    default: 'stored'
  }

}, { timestamps: true });

medicalReportSchema.index({
  patientId: 1,
  reportDate: -1
});

export const MedicalReport = model(
  'MedicalReport',
  medicalReportSchema
);