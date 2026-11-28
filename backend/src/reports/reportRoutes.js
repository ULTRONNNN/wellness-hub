import { processImage } from '../security/imageOCR.js';
import multer from 'multer';
import { processReport } from '../security/sandbox.js';
import express from 'express';
import rateLimit from 'express-rate-limit';

import { Doctor } from '../models.js';
import { MedicalReport } from './reportModels.js';
import { analyzeReport } from './reportAnalyzer.js';

import {
  encryptData,
  decryptData
} from '../security/encryption.js';

// ==========================================
// PDF AND IMAGE UPLOAD CONFIGURATION
// ==========================================

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
    fields: 3,
    parts: 4
  },

  fileFilter: (req, file, cb) => {

    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png'
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return cb(
        new Error('Only PDF, JPG, JPEG and PNG files are allowed')
      );
    }

    cb(null, true);
  }
});

// ==========================================
// FICTIONAL DEMONSTRATION REPORTS
// ==========================================

const demoReports = [
  {
    date: '2026-09-15',
    hemoglobin: '10.2 g/dL',
    glucose: '92 mg/dL',
    reference: {
      hemoglobin: '12-16 g/dL',
      glucose: '70-99 mg/dL (fasting)'
    }
  },
  {
    date: '2026-11-24',
    hemoglobin: '11.8 g/dL',
    glucose: '95 mg/dL',
    reference: {
      hemoglobin: '12-16 g/dL',
      glucose: '70-99 mg/dL (fasting)'
    }
  }
];

// ==========================================
// REPORT DATE PARSER
// ==========================================

function parseDate(value) {

  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  let raw = value.trim();

  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(raw)) {

    const [d, m, y] = raw.split(/[-/]/);

    raw = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const parsed = new Date(raw);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  if (
    /^\d{4}-\d{2}-\d{2}$/.test(raw) &&
    parsed.toISOString().slice(0, 10) !== raw
  ) {
    return null;
  }

  return parsed;
}

// ==========================================
// AUTOMATIC REPORT DATE EXTRACTION
// ==========================================

function extractReportDate(text) {

  const matches = [...text.matchAll(
    /(?:report date|date of report|reporting date|test date|reported on|report generated on)\s*:?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[-/]\d{1,2}[-/]\d{4}|\d{1,2}\s+[A-Za-z]+\s+\d{4})/gi
  )];

  const dates = [...new Set(
    matches
      .map(match => parseDate(match[1]))
      .filter(Boolean)
      .map(date => date.toISOString().slice(0, 10))
  )];

  if (dates.length === 1) {
    return parseDate(dates[0]);
  }

  return null;
}

// ==========================================
// REPORT ROUTER
// ==========================================

async function doctorSuggestions(answer) {
  const specialties = ['General Medicine','Dermatology','Cardiology','Neurology','Gastroenterology','Pulmonology','Psychiatry'];
  const matched = specialties.filter(s => String(answer).toLowerCase().includes(s.toLowerCase()));
  const doctors = await Doctor.find({isActive: {$ne:false}, specialty: {$in: matched.length ? matched : ['General Medicine']}}).select('name specialty hospital').limit(5).lean();
  return doctors.length ? '\n\nWellness Hub demo doctor options (not verified availability):\n' + doctors.map(d=>`${d.name} — ${d.specialty} — ${d.hospital || 'Hospital not specified'}`).join('\n') : '';
}

export function createReportRouter(auth, allow) {

  const router = express.Router();

  // Only authenticated patients
  router.use(auth, allow('patient'));

  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  const safe = fn => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

  // AI analysis rate limit
  const analysisLimit = rateLimit({
    windowMs: 60 * 1000,
    limit: 8,
    message: {
      error: 'Please wait before requesting another analysis.'
    }
  });

  // Upload rate limit
  const uploadLimit = rateLimit({
    windowMs: 60 * 1000,
    limit: 3,
    message: {
      error: 'Too many uploads. Please wait.'
    }
  });

  // ==========================================
  // LOAD DEMONSTRATION REPORTS
  // ==========================================

  router.post('/demo', safe(async (req, res) => {

    for (const report of demoReports) {

      await MedicalReport.updateOne(
        {
          patientId: req.identity.id,
          reportDate: new Date(report.date),
          reportType: 'Demo Blood Test',
          demoOnly: true
        },
        {
          $setOnInsert: {
            encryptedReport: encryptData(report),
            status: 'stored',
            consentForAI: false
          }
        },
        {
          upsert: true
        }
      );
    }

    res.json({
      message: 'Fictional medical reports added'
    });
  }));

  // ==========================================
  // GET PATIENT REPORT HISTORY
  // ==========================================

  router.get('/', safe(async (req, res) => {

    const reports = await MedicalReport.find({
      patientId: req.identity.id,
      demoOnly: true
    })
      .sort({ reportDate: -1 })
      .limit(20);

    res.json(
      reports.map(report => ({
        _id: report.id,
        reportType: report.reportType,
        reportDate: report.reportDate,
        status: report.status,

        report: decryptData(
          report.encryptedReport
        ),

        analysis: report.encryptedAnalysis?.encryptedData
          ? decryptData(report.encryptedAnalysis)
          : null
      }))
    );
  }));

  // ==========================================
  // DYNAMIC PDF AND IMAGE UPLOAD
  // ==========================================

  router.post(
    '/upload',

    uploadLimit,

    (req, res, next) => {

      upload.single('report')(req, res, error => {

        if (error) {
          return res.status(400).json({
            error: 'Invalid file or upload exceeds 5 MB. Supported formats: PDF, JPG, JPEG and PNG.'
          });
        }

        next();
      });
    },

    safe(async (req, res) => {

      if (!req.file || !req.file.buffer) {
        return res.status(400).json({
          error: 'Please select a medical report'
        });
      }

      const buffer = req.file.buffer;

      // Validate PDF signature
      const isPDF =
        buffer.length >= 5 &&
        buffer.subarray(0, 5).toString() === '%PDF-';

      // Validate JPEG signature
      const isJPEG =
        buffer.length >= 3 &&
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff;

      // Validate PNG signature
      const isPNG =
        buffer.length >= 8 &&
        buffer.subarray(0, 8).equals(
          Buffer.from([
            137, 80, 78, 71,
            13, 10, 26, 10
          ])
        );

      // Ensure file signature matches MIME type
      if (
        !(isPDF && req.file.mimetype === 'application/pdf') &&
        !(isJPEG && req.file.mimetype === 'image/jpeg') &&
        !(isPNG && req.file.mimetype === 'image/png')
      ) {
        return res.status(400).json({
          error: 'Invalid PDF or image file'
        });
      }

      // Extract text using PDF parser or OCR
      let extracted;

      try {

        if (isPDF) {

          extracted = await processReport(buffer);

        } else {

          extracted = await processImage(buffer);

        }

      } catch {

        return res.status(422).json({
          error: 'Unable to read report. Please upload a clear image or readable PDF.'
        });
      }

      // Validate extracted content
      if (
        !extracted ||
        typeof extracted.text !== 'string' ||
        !extracted.text.trim()
      ) {
        return res.status(422).json({
          error: 'No readable text found in the report'
        });
      }

      if (extracted.text.length > 30000) {
        return res.status(422).json({
          error: 'Report text exceeds the supported limit'
        });
      }

      // Automatically detect report date
      const date = req.body.reportDate
        ? parseDate(req.body.reportDate)
        : extractReportDate(extracted.text);

      // Manual date fallback
      if (!date) {
        return res.status(422).json({
          code: 'DATE_REQUIRED',
          error: 'Report date could not be determined. Please enter it manually.'
        });
      }

      // Prepare report data
      const reportData = {

        date: date.toISOString(),

        filename: req.file.originalname,

        pages: extracted.pages || 1,

        text: extracted.text,

        source: isPDF
          ? 'uploaded-pdf'
          : 'uploaded-image',

        extractionMethod: isPDF
          ? 'Poppler pdftotext'
          : 'Tesseract OCR',

        ocrConfidence:
          !isPDF && Number.isFinite(extracted.confidence)
            ? extracted.confidence
            : null,

        verificationRequired: true,

        demoOnly: true
      };

      // Encrypt before saving to MongoDB
      const report = await MedicalReport.create({

        patientId: req.identity.id,

        reportType: isPDF
          ? 'Uploaded Test PDF'
          : 'Uploaded Image Report',

        reportDate: date,

        encryptedReport: encryptData(
          reportData
        ),

        consentForAI: false,

        demoOnly: true,

        status: 'stored'
      });

      res.status(201).json({

        message: isPDF
          ? 'PDF uploaded and stored successfully'
          : 'Image processed using OCR and stored successfully',

        reportId: report.id,

        pages: extracted.pages || 1,

        reportDate: date.toISOString(),

        extractionMethod: reportData.extractionMethod,

        ocrConfidence: reportData.ocrConfidence,

        verificationRequired: true,

        status: report.status
      });
    })
  );

  // ==========================================
  // AI REPORT ANALYSIS AND COMPARISON
  // ==========================================

  router.post(
    '/:id/analyze',

    analysisLimit,

    safe(async (req, res) => {

      if (req.body?.consent !== true) {
        return res.status(400).json({
          error: 'AI processing consent is required'
        });
      }

      if (!/^[a-f0-9]{24}$/i.test(req.params.id)) {
        return res.status(400).json({
          error: 'Invalid report ID'
        });
      }

      // Retrieve patient's own report
      const current = await MedicalReport.findOne({
        _id: req.params.id,
        patientId: req.identity.id,
        demoOnly: true
      });

      if (!current) {
        return res.status(404).json({
          error: 'Report not found'
        });
      }


      let analysis;

      try {

        const currentData = decryptData(
          current.encryptedReport
        );

        analysis = await analyzeReport(

          currentData,

          []

        );

        analysis += await doctorSuggestions(analysis);

        // Add OCR verification warning
        if (currentData.source === 'uploaded-image') {

          analysis =
            'OCR NOTICE: This report was extracted from an image. Verify all numbers, units and reference ranges against the original image.\n\n' +
            analysis;
        }

      } catch {

        return res.status(502).json({
          error: 'AI analysis temporarily unavailable. Please ensure Ollama is running.'
        });
      }

      // Encrypt AI-generated analysis
      current.encryptedAnalysis = encryptData(
        analysis
      );

      current.consentForAI = true;

      current.status = 'analyzed';

      await current.save();

      res.json({
        analysis
      });
    })
  );

  // ==========================================
  // CAREBOT FOLLOW-UP QUESTIONS
  // ==========================================

  router.post(
    '/:id/ask',

    analysisLimit,

    safe(async (req, res) => {

      const question = String(
        req.body?.question || ''
      ).trim();

      if (
        !question ||
        question.length > 1000 ||
        req.body?.consent !== true
      ) {
        return res.status(400).json({
          error: 'Valid question and consent required'
        });
      }

      if (!/^[a-f0-9]{24}$/i.test(req.params.id)) {
        return res.status(400).json({
          error: 'Invalid report ID'
        });
      }

      // Retrieve patient's own report
      const current = await MedicalReport.findOne({
        _id: req.params.id,
        patientId: req.identity.id,
        demoOnly: true
      });

      if (!current) {
        return res.status(404).json({
          error: 'Report not found'
        });
      }


      try {

        const currentData = decryptData(
          current.encryptedReport
        );

        let answer = await analyzeReport(

          currentData,

          [],

          question,
          Array.isArray(currentData.chatHistory) ? currentData.chatHistory : []

        );

        if (currentData.source === 'uploaded-image') {

          answer +=
            '\n\nPlease verify OCR-extracted medical values against the original report.';
        }

        if (/\b(doctor|specialist|consult|physician)\b/i.test(question)) answer += await doctorSuggestions(answer);
        const history = Array.isArray(currentData.chatHistory) ? currentData.chatHistory : [];
        currentData.chatHistory = [...history, {role:'user',content:question}, {role:'assistant',content:answer}].slice(-6);
        current.encryptedReport = encryptData(currentData);
        current.consentForAI = true;
        await current.save();
        res.json({ answer });

      } catch {

        res.status(502).json({
          error: 'Local AI is temporarily unavailable'
        });
      }
    })
  );

  // ==========================================
  // DELETE MEDICAL REPORT
  // ==========================================

  router.delete('/:id', safe(async (req, res) => {

    if (!/^[a-f0-9]{24}$/i.test(req.params.id)) {
      return res.status(400).json({
        error: 'Invalid report ID'
      });
    }

    const deleted = await MedicalReport.findOneAndDelete({
      _id: req.params.id,
      patientId: req.identity.id,
      demoOnly: true
    });

    if (!deleted) {
      return res.status(404).json({
        error: 'Report not found'
      });
    }

    res.json({
      message: 'Report deleted'
    });
  }));

  return router;
}
