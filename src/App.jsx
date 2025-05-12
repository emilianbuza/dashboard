// 🚀 Finalversion deiner Express Backend API (Render-kompatibel)
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');

const app = express();
app.enable('trust proxy');

// === Konfiguration ===
const API_KEY = process.env.API_KEY;
const DB_URI = process.env.MONGO_URI || "mongodb://localhost:27017/conversions";
const PORT = process.env.PORT || 3000;

// === CORS-Konfiguration (erweitert) ===
const allowedOrigins = [
  "https://ecomshakers.com",
  "https://dashboard-uq2r.onrender.com"
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn("[CORS BLOCKED]", origin);
      callback(new Error("CORS not allowed"), false);
    }
  },
  credentials: true
};

// === Middleware ===
app.use(helmet());
app.use(express.json());
app.use(morgan("dev"));
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.url}`);
  next();
});

app.use('/upload', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Rate limit exceeded' }
}));

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  next(err);
});

// === Datenbank-Verbindung ===
mongoose.connect(DB_URI)
  .then(() => console.log("[DB] Verbunden mit MongoDB"))
  .catch(err => {
    console.error("[DB] Verbindungsfehler", err);
    process.exit(1);
  });

// === Datenmodell ===
const ConversionSchema = new mongoose.Schema({
  timestamp: Date,
  pageUrl: String,
  referrer: String,
  userAgent: String,
  consent: Boolean,
  clickId: String,
  clickIdParamName: String,
  eventType: { type: String, enum: ['initial', 'conversion'], default: 'conversion' },
  conversion_action: String,
  conversion_id: String,
  formName: String,
  campaign: String,
  adgroup: String,
  keyword: String,
  matchtype: String,
  device: String,
  sourceIp: String
}, { timestamps: true });

const Conversion = mongoose.model("Conversion", ConversionSchema);

// === Auth Middleware ===
const authenticate = (req, res, next) => {
  const key = req.header('x-api-key');
  if (!API_KEY || key !== API_KEY) {
    console.warn(`[AUTH FAIL] IP: ${req.ip}`);
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// === Upload-Route ===
app.post('/upload', authenticate, [
  body('timestamp').exists().isISO8601(),
  body('pageUrl').exists().isURL(),
  body('referrer').optional().isString().isLength({ max: 2048 }),
  body('userAgent').optional().isString().isLength({ max: 512 }),
  body('consent').exists().isBoolean(),
  body('clickId').optional().isString().isLength({ min: 10, max: 64 }),
  body('clickIdParamName').optional().isString().isLength({ max: 32 }),
  body('conversion_action').optional().isString().isLength({ max: 128 }),
  body('conversion_id').optional().isString().isLength({ max: 64 }),
  body('formName').optional().isAlphanumeric().isLength({ max: 64 }),
  body('campaign').optional().isString(),
  body('adgroup').optional().isString(),
  body('keyword').optional().isString(),
  body('matchtype').optional().isString(),
  body('device').optional().isString(),
  body('eventType').optional().isIn(['initial', 'conversion'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }

  const payload = {
    ...req.body,
    sourceIp: anonymizeIp(req.ip),
    eventType: req.body.eventType || 'conversion',
    clickIdParamName: req.body.clickIdParamName || null
  };

  try {
    await Conversion.create(payload);
    res.json({ status: "success" });
  } catch (err) {
    console.error("[DB ERROR]", err);
    res.status(500).json({ error: "Failed to store data" });
  }
});

// === GCLID Logging ===
app.post('/gclid-log', cors(corsOptions), [
  body('timestamp').exists().isISO8601(),
  body('pageUrl').exists().isURL(),
  body('referrer').optional().isString(),
  body('userAgent').optional().isString(),
  body('consent').exists().isBoolean(),
  body('clickId').optional().isString().isLength({ min: 10, max: 64 })
], async (req, res) => {
  console.log("[GCLID-LOG] Payload:", req.body);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }

  const payload = {
    timestamp: req.body.timestamp,
    pageUrl: req.body.pageUrl,
    referrer: req.body.referrer,
    userAgent: req.body.userAgent,
    consent: req.body.consent,
    clickId: req.body.clickId,
    sourceIp: anonymizeIp(req.ip)
  };

  try {
    const result = await mongoose.connection.collection("gclid_logs").insertOne(payload);
    console.log("[GCLID-LOG] Gespeichert ID:", result.insertedId);
    res.json({ status: "gclid logged" });
  } catch (err) {
    console.error("[GCLID LOG ERROR]", err);
    res.status(500).json({ error: "Logging failed" });
  }
});

// === Statistik API ===
app.get('/api/gclid-stats', authenticate, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalToday = await mongoose.connection.collection("gclid_logs").countDocuments({ timestamp: { $gte: today } });
    const consentYes = await mongoose.connection.collection("gclid_logs").countDocuments({ timestamp: { $gte: today }, consent: true });
    const consentNo = await mongoose.connection.collection("gclid_logs").countDocuments({ timestamp: { $gte: today }, consent: false });

    const stats = [
      {
        label: "Heute",
        total: totalToday,
        consentYes: consentYes,
        consentNo: consentNo
      },
      {
        label: "Gestern",
        total: await countByDateRange(today, -1),
        consentYes: await countByDateRange(today, -1, true),
        consentNo: await countByDateRange(today, -1, false)
      }
    ];

    res.json(stats);
  } catch (err) {
    console.error("[GCLID-Stats ERROR]", err);
    res.status(500).json({ error: "Fehler beim Abrufen der Statistik" });
  }
});

function anonymizeIp(ip) {
  if (!ip) return "unknown";
  return ip.includes(":") ? ip.replace(/:.+$/, ":****") : ip.replace(/\.\d+$/, ".0");
}

async function countByDateRange(date, offset = 0, consent = null) {
  const start = new Date(date);
  start.setDate(start.getDate() + offset);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  const query = { timestamp: { $gte: start, $lte: end } };
  if (consent !== null) query.consent = consent;
  return await mongoose.connection.collection("gclid_logs").countDocuments(query);
}

// === Serverstart ===
app.listen(PORT, () => {
  console.log(`🚀 Conversion API läuft auf Port ${PORT}`);
});
