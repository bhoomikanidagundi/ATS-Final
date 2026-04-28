import dotenv from "dotenv";
dotenv.config();

import express from "express";
// Vite is only imported dynamically in development mode to avoid production dependency issues
import path from "path";
import multer from "multer";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cors from "cors";
import mysql, { Pool } from "mysql2/promise";
import fs from "fs/promises";
import { existsSync, mkdirSync } from "fs";
import { authMiddleware, allowRoles } from "./middleware/auth.ts";

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-for-dev";

const MYSQL_URL = process.env.MYSQL_URL || process.env.DATABASE_URL || process.env.MYSQLURL || "";

if (!MYSQL_URL) {
  console.warn("CRITICAL WARNING: No Database URL found in environment variables!");
}

let pool: Pool;
try {
  if (!MYSQL_URL) {
    throw new Error("MYSQL_URL is empty or undefined");
  }
  pool = mysql.createPool({
    uri: MYSQL_URL,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 10000 // 10s timeout
  });
  console.log("Database pool created. URL structure:", MYSQL_URL.split('@')[1] || "Local/Masked");
} catch (dbErr: any) {
  console.error("CRITICAL: FAILED to create DB pool:", dbErr.message);
}

app.use(cors());
app.use(express.json());

// Health check endpoint for deployment platforms
app.get("/health", (req, res) => res.status(200).send("OK - Version 2.0 (With Key Check)"));

// Set up Multer for memory storage (used for analyze)
const upload = multer({ storage: multer.memoryStorage() });

// Set up Multer for disk storage (used for permanent uploads)
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  }
});
const diskUpload = multer({ storage: diskStorage });

// Ensure uploads directory exists
if (!existsSync("uploads")) {
  mkdirSync("uploads");
}

// Helper to extract text from PDF buffer
async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const data = await pdf(buffer);
    return data.text || "";
  } catch (err) {
    console.error("PDF Extraction Error:", err);
    return "";
  }
}

// --- Initialize Database ---
const initializeDB = async () => {
  try {
    // 1. Core Tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'candidate'
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS resumes (
        id VARCHAR(255) PRIMARY KEY,
        userId VARCHAR(255) NOT NULL,
        filename VARCHAR(255) NOT NULL,
        file_path VARCHAR(255),
        uploadedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        parsed_skills JSON,
        parsed_education JSON,
        parsed_experience JSON,
        current_location VARCHAR(255),
        notice_period VARCHAR(255),
        total_experience VARCHAR(255),
        current_salary VARCHAR(255),
        FOREIGN KEY (userId) REFERENCES users(id)
      )
    `);

    // 2. Add missing columns to resumes if they don't exist
    const resumeColumns = [
      ["file_path", "VARCHAR(255)"],
      ["parsed_skills", "JSON"],
      ["parsed_education", "JSON"],
      ["parsed_experience", "JSON"],
      ["current_location", "VARCHAR(255)"],
      ["notice_period", "VARCHAR(255)"],
      ["total_experience", "VARCHAR(255)"],
      ["current_salary", "VARCHAR(255)"]
    ];

    for (const [colName, colType] of resumeColumns) {
      try {
        await pool.query(`ALTER TABLE resumes ADD COLUMN ${colName} ${colType}`);
      } catch (e: any) {
        if (e.code !== 'ER_DUP_FIELDNAME') console.log(`Note: resumes.${colName} column check:`, e.message);
      }
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS analyses (
        id VARCHAR(255) PRIMARY KEY,
        resumeId VARCHAR(255) NOT NULL,
        userId VARCHAR(255) NOT NULL,
        result JSON NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id),
        FOREIGN KEY (resumeId) REFERENCES resumes(id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS generated_resumes (
        id VARCHAR(255) PRIMARY KEY,
        userId VARCHAR(255) NOT NULL,
        content JSON NOT NULL,
        jobDescription TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS jobs (
        id VARCHAR(255) PRIMARY KEY,
        recruiter_id VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        required_skills JSON,
        experience_required VARCHAR(255),
        location VARCHAR(100) DEFAULT 'Remote',
        salary VARCHAR(100),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (recruiter_id) REFERENCES users(id)
      )
    `);

    // Add missing job columns
    try { await pool.query("ALTER TABLE jobs ADD COLUMN location VARCHAR(100) DEFAULT 'Remote'"); } catch {}
    try { await pool.query("ALTER TABLE jobs ADD COLUMN salary VARCHAR(100)"); } catch {}

    await pool.query(`
      CREATE TABLE IF NOT EXISTS applications (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        job_id VARCHAR(255) NOT NULL,
        resume_id VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'applied',
        match_score INT DEFAULT 0,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (job_id) REFERENCES jobs(id),
        FOREIGN KEY (resume_id) REFERENCES resumes(id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS interviews (
        id VARCHAR(255) PRIMARY KEY,
        application_id VARCHAR(255) NOT NULL,
        date DATETIME NOT NULL,
        status VARCHAR(50) DEFAULT 'scheduled',
        FOREIGN KEY (application_id) REFERENCES applications(id)
      )
    `);

    console.log("MySQL database initialized successfully.");
  } catch (err: any) {
    console.error("Database initialization failed but server will continue to start:", err.message);
    // Don't exit immediately, let the server start so we can see logs/health
  }
};
initializeDB();

// --- Auth Routes ---
app.post("/api/auth/register", async (req, res) => {
  const { email, password, name, role = "candidate" } = req.body;
  if (!email || !password || !name) return res.status(400).json({ error: "Missing fields" });

  try {
    const [existing] = await pool.query<any[]>("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length > 0) return res.status(400).json({ error: "Email already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = Date.now().toString();

    await pool.query(
      "INSERT INTO users (id, email, password, name, role) VALUES (?, ?, ?, ?, ?)",
      [userId, email, hashedPassword, name, role]
    );

    const token = jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: "1d" });
    res.json({ token, user: { id: userId, email, name, role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password, role = "candidate" } = req.body;
  try {
    const [users] = await pool.query<any[]>("SELECT * FROM users WHERE email = ? AND role = ?", [email, role]);
    const user = users[0];

    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "1d" });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// authMiddleware and allowRoles are imported from ./middleware/auth

app.get("/api/auth/me", authMiddleware, async (req: any, res) => {
  try {
    const [users] = await pool.query<any[]>("SELECT id, email, name, role FROM users WHERE id = ?", [req.userId]);
    const user = users[0];
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// --- Google OAuth ---
app.get("/api/auth/google/url", (req, res) => {
  const incomingRedirectUri = req.query.redirectUri as string || (process.env.APP_URL + "/api/auth/google/callback");
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: incomingRedirectUri,
    response_type: "code",
    scope: "email profile",
    prompt: "select_account",
    state: incomingRedirectUri // pass redirectUri in state so callback can use it
  });

  res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
});

app.get("/api/auth/google/callback", async (req, res) => {
  const { code, state } = req.query;
  try {
    const redirectUri = state as string || (process.env.APP_URL + "/api/auth/google/callback");

    // Exchange token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        code: code as string,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      })
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
      throw new Error("Token exchange failed: " + JSON.stringify(tokenData));
    }

    // Fetch profile
    const userResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const userData = await userResponse.json();
    if (!userResponse.ok) {
      throw new Error("Userinfo fetch failed");
    }

    const { email, name, id: googleId } = userData;

    // Check if user exists in DB
    const [existing] = await pool.query<any[]>("SELECT id FROM users WHERE email = ?", [email]);
    let userId;
    if (existing.length === 0) {
      userId = Date.now().toString();
      const hashedPassword = await bcrypt.hash(Math.random().toString(36), 10);
      await pool.query(
        "INSERT INTO users (id, email, password, name) VALUES (?, ?, ?, ?)",
        [userId, email, hashedPassword, name || "User"]
      );
    } else {
      userId = existing[0].id;
    }

    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: "1d" });

    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', token: '${token}', user: { id: '${userId}', email: '${email}', name: '${(name || "User").replace(/'/g, "\\'")}' } }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. This window should close automatically.</p>
        </body>
      </html>
    `);
  } catch (err) {
    console.error("Google Auth Error", err);
    res.send(`
      <html>
        <body>
          <p>Error logging in with Google. Check server logs.</p>
          <script>setTimeout(() => window.close(), 3000);</script>
        </body>
      </html>
    `);
  }
});

// --- ATS Engine Details ---
const apiKey = process.env.GEMINI_API_KEY?.trim();
if (!apiKey) {
  console.error("WARNING: GEMINI_API_KEY is missing. AI features will fail.");
} else {
  console.log("GEMINI_API_KEY detected (Length:", apiKey.length, ")");
}
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Helper to get a working model (tries multiple versions)
async function getWorkingModel(prompt: string) {
  if (!genAI) throw new Error("Gemini AI is not configured.");
  
  const modelsToTry = [
    "gemini-2.0-flash",
    "gemini-2.5-flash",
    "gemini-2.0-flash-lite"
  ];
  const versionsToTry = ["v1beta"];
  let lastError: any = null;

  for (const ver of versionsToTry) {
    for (const modelName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel(
          { model: modelName },
          { apiVersion: ver as any }
        );
        const result = await model.generateContent(prompt);
        const response = await result.response;
        if (response) return response;
      } catch (e: any) {
        lastError = e;
        console.warn(`Model ${modelName} (${ver}) failed:`, e.message);
      }
    }
  }
  throw new Error(`All Gemini models failed. Last error: ${lastError?.message}`);
}

app.post("/api/analyze", authMiddleware, allowRoles("candidate"), diskUpload.single("resume"), async (req: any, res) => {
  try {
    const userId = req.userId;
    const file = req.file;
    const jobDescription = req.body.jobDescription || "";

    if (!file) return res.status(400).json({ error: "No resume file provided" });

    // Parse PDF
    let resumeText = "";
    try {
      const buffer = await fs.readFile(file.path);
      if (file.mimetype === "application/pdf") {
        resumeText = await extractTextFromPDF(buffer);
      } else {
        resumeText = buffer.toString("utf-8");
      }
    } catch (err) {
      console.error("File Read Error:", err);
      return res.status(500).json({ error: "Failed to read uploaded file" });
    }

    if (!resumeText || resumeText.trim() === "") {
      return res.status(400).json({ error: "Could not extract text from file" });
    }

    const prompt = `
    You are an expert ATS (Applicant Tracking System) and Senior Recruiter.
    Analyze the following resume text. If a job description is provided, score the resume against it.
    Also, extract structured professional details for the candidate profile.
    Provide the output in valid JSON format ONLY, without markdown wrapping.

    Schema:
    {
      "analysis": {
        "score": <number 0-100>,
        "keywordMatch": <number 0-100>,
        "formattingIssues": ["<issue 1>", "<issue 2>"],
        "sectionCompleteness": ["<missing section>", ...],
        "skillRelevance": <number 0-100>,
        "missingKeywords": ["<keyword 1>", "<keyword 2>"],
        "skillSuggestions": ["<suggestion 1>", "<suggestion 2>", ...],
        "suggestions": [
          { "section": "<section>", "tip": "<tip>", "example": "<example>" }
        ],
        "bulletRewrites": [
          { "original": "<original>", "rewritten": "<better>" }
        ],
        "summary": "<Short executive summary>"
      },
      "structuredData": {
        "skills": ["<skill 1>", "<skill 2>"],
        "education": [{"degree": "<degree>", "institution": "<institution>", "year": "<year>"}],
        "experience": [{"title": "<title>", "company": "<company>", "duration": "<duration>"}],
        "current_location": "<city, state>",
        "notice_period": "<notice period>",
        "total_experience": "<total exp>",
        "current_salary": "<salary>"
      }
    }

    Job Description (if empty, assume general best practices):
    ${jobDescription}

    Resume Text:
    ${resumeText.substring(0, 8000)}
    `;

    if (!genAI) {
      return res.status(500).json({ error: "Gemini AI is not configured. Please check GEMINI_API_KEY." });
    }

    if (!genAI) {
      return res.status(500).json({ error: "Gemini AI is not configured. Please check GEMINI_API_KEY." });
    }

    let response;
    try {
      response = await getWorkingModel(prompt);
    } catch (e: any) {
      const keySnippet = apiKey ? `${apiKey.substring(0, 6)}...${apiKey.substring(apiKey.length - 4)}` : "MISSING";
      throw new Error(`${e.message}. Key: ${keySnippet}`);
    }

    let resultText = response.text() || "";
    resultText = resultText.replace(/```json\n/g, "").replace(/```\n?/g, "").trim();

    if (resultText.startsWith("```json")) {
      resultText = resultText.substring(7);
      if (resultText.endsWith("```")) resultText = resultText.substring(0, resultText.length - 3);
    }

    // Attempt parse
    let fullResult;
    try {
      fullResult = JSON.parse(resultText);
    } catch (parseError) {
      console.error("Failed to parse Gemini response as JSON", parseError, resultText);
      return res.status(500).json({ error: "Invalid analysis response format. Please try again." });
    }

    const analysisData = fullResult.analysis || fullResult; // Fallback if AI skips wrapping
    const structuredData = fullResult.structuredData || {};

    // Save to DB
    const resumeId = Date.now().toString();
    const uploadedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
    
    await pool.query(
      "INSERT INTO resumes (id, userId, filename, file_path, uploadedAt, parsed_skills, parsed_education, parsed_experience, current_location, notice_period, total_experience, current_salary) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        resumeId, 
        userId, 
        file.originalname, 
        file.path, 
        uploadedAt,
        JSON.stringify(structuredData.skills || []),
        JSON.stringify(structuredData.education || []),
        JSON.stringify(structuredData.experience || []),
        structuredData.current_location || "",
        structuredData.notice_period || "",
        structuredData.total_experience || "",
        structuredData.current_salary || ""
      ]
    );

    const analysisId = (Date.now() + 1).toString();
    const createdAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await pool.query(
      "INSERT INTO analyses (id, resumeId, userId, result, createdAt) VALUES (?, ?, ?, ?, ?)",
      [analysisId, resumeId, userId, JSON.stringify(analysisData), createdAt]
    );

    const newAnalysisDate = new Date();
    res.json({
      id: analysisId,
      resumeId: resumeId,
      userId,
      result: analysisData,
      createdAt: newAnalysisDate.toISOString()
    });
  } catch (error: any) {
    console.error("Analysis Error:", error);
    res.status(500).json({ error: "Failed to analyze resume", details: error.message });
  }
});

// Analyze a resume and return structured JSON (Skills, Education, Experience)
app.post("/api/analyze-resume", authMiddleware, upload.single("resume"), async (req: any, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No resume file provided" });
    const resumeText = await extractTextFromPDF(req.file.buffer);

    const prompt = `
    Extract professional details from the following resume text.
    Return ONLY valid JSON with the following structure:
    {
      "skills": ["<skill 1>", "<skill 2>"],
      "education": [{"degree": "<degree>", "institution": "<institution>", "year": "<year>"}],
      "experience": [{"title": "<title>", "company": "<company>", "duration": "<duration>"}]
    }
    
    Resume Text: ${resumeText.substring(0, 8000)}
    `;

    if (!genAI) {
      return res.status(500).json({ error: "Gemini AI is not configured. Please check GEMINI_API_KEY." });
    }
    const response = await getWorkingModel(prompt);
    const resultText = response.text().replace(/```json\n/g, "").replace(/```\n?/g, "").trim();
    res.json(JSON.parse(resultText));
  } catch (error: any) {
    console.error("Analysis Error:", error);
    res.status(500).json({ error: "Failed to analyze resume", details: error.message });
  }
});

// --- Resume Builder ---
app.post("/api/resume/build", authMiddleware, allowRoles("candidate"), async (req: any, res) => {
  try {
    const userId = req.userId;
    const { personalData, experienceData, educationData, projectsData, skillsData, jobDescription } = req.body;

    const prompt = `
    You are an expert Resume Writer and ATS Optimization Specialist.
    Rewrite the user's data to be highly professional and ATS-friendly.
    Output valid JSON only matching the schema below.
    
    Target Job Description: ${jobDescription || 'N/A'}
    Personal: ${JSON.stringify(personalData)}
    Experience: ${JSON.stringify(experienceData)}
    Education: ${JSON.stringify(educationData)}
    Projects: ${JSON.stringify(projectsData)}
    Skills: ${JSON.stringify(skillsData)}
    
    JSON Schema:
    {
      "personal": { "name": "string", "email": "string", "phone": "string", "location": "string", "linkedin": "string", "github": "string", "summary": "string" },
      "experience": [ { "company": "string", "title": "string", "date": "string", "location": "string", "bullets": ["string"] } ],
      "education": [ { "school": "string", "degree": "string", "date": "string", "location": "string", "details": "string" } ],
      "projects": [ { "name": "string", "technologies": "string", "date": "string", "bullets": ["string"] } ],
      "skills": { "languages": ["string"], "frameworks": ["string"], "tools": ["string"] }
    }
    `;

    if (!genAI) {
      return res.status(500).json({ error: "Gemini AI is not configured. Please check GEMINI_API_KEY." });
    }
    const response = await getWorkingModel(prompt);
    const resultText = response.text().replace(/```json\n/g, "").replace(/```\n?/g, "").trim();
    const resumeData = JSON.parse(resultText);

    const resumeId = Date.now().toString();
    const createdAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await pool.query(
      "INSERT INTO generated_resumes (id, userId, content, jobDescription, createdAt) VALUES (?, ?, ?, ?, ?)",
      [resumeId, userId, JSON.stringify(resumeData), jobDescription || "", createdAt]
    );

    res.json({ id: resumeId, content: resumeData });
  } catch (error: any) {
    console.error("Resume Build Error:", error);
    res.status(500).json({ error: "Failed to build resume", details: error.message });
  }
});

app.get("/api/resume/generated/:id", authMiddleware, async (req: any, res) => {
  try {
    const [resumes] = await pool.query<any[]>(
      "SELECT * FROM generated_resumes WHERE id = ? AND userId = ?",
      [req.params.id, req.userId]
    );

    if (resumes.length === 0) {
      return res.status(404).json({ error: "Resume not found" });
    }

    const r = resumes[0];
    const resumeData = {
      ...r,
      content: typeof r.content === 'string' ? JSON.parse(r.content) : r.content,
    };

    res.json(resumeData);
  } catch (error) {
    console.error("Error fetching generated resume:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get specific analysis by ID
app.get("/api/analysis/:id", authMiddleware, async (req: any, res) => {
  try {
    const [analyses] = await pool.query<any[]>(
      `SELECT a.*, r.filename 
       FROM analyses a 
       JOIN resumes r ON a.resumeId = r.id 
       WHERE a.id = ? AND a.userId = ?`,
      [req.params.id, req.userId]
    );

    if (analyses.length === 0) {
      return res.status(404).json({ error: "Analysis not found" });
    }

    const a = analyses[0];
    const analysis = {
      ...a,
      result: typeof a.result === 'string' ? JSON.parse(a.result) : a.result,
      resume: {
        id: a.resumeId,
        filename: a.filename
      }
    };

    res.json(analysis);
  } catch (error) {
    console.error("Error fetching analysis:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// --- History Route ---
app.get("/api/history", authMiddleware, async (req: any, res) => {
  try {
    const [analyses] = await pool.query<any[]>(
      `SELECT a.*, r.filename 
       FROM analyses a 
       JOIN resumes r ON a.resumeId = r.id 
       WHERE a.userId = ? 
       ORDER BY a.createdAt DESC`,
      [req.userId]
    );

    // Format for frontend
    const history = analyses.map(a => ({
      ...a,
      result: typeof a.result === 'string' ? JSON.parse(a.result) : a.result,
      resume: {
        id: a.resumeId,
        filename: a.filename
      }
    }));

    res.json({ history });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ==========================================
// --- JOBS APIs (Recruiter Only) ---
// ==========================================
app.post("/api/jobs", authMiddleware, allowRoles("recruiter"), async (req: any, res) => {
  try {
    const { title, description, required_skills, experience_required, location = "Remote", salary } = req.body;
    const jobId = Date.now().toString();
    await pool.query(
      "INSERT INTO jobs (id, recruiter_id, title, description, required_skills, experience_required, location, salary) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [jobId, req.userId, title, description, JSON.stringify(required_skills || []), experience_required, location, salary]
    );
    res.json({ id: jobId, message: "Job created successfully" });
  } catch (error) {
    console.error("Error creating job:", error);
    res.status(500).json({ error: "Failed to create job" });
  }
});

app.get("/api/jobs", authMiddleware, async (req: any, res) => {
  try {
    // Both recruiters and candidates can see jobs
    // Candidates see all jobs, Recruiters see their own jobs
    let query = "SELECT * FROM jobs ORDER BY created_at DESC";
    let params: any[] = [];
    if (req.role === 'recruiter') {
      query = "SELECT * FROM jobs WHERE recruiter_id = ? ORDER BY created_at DESC";
      params = [req.userId];
    }
    const [jobs] = await pool.query<any[]>(query, params);
    res.json(jobs.map(j => ({ ...j, required_skills: typeof j.required_skills === 'string' ? JSON.parse(j.required_skills) : j.required_skills })));
  } catch (error) {
    console.error("Error fetching jobs:", error);
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

app.get("/api/jobs/:id", authMiddleware, async (req: any, res) => {
  try {
    const [jobs] = await pool.query<any[]>("SELECT * FROM jobs WHERE id = ?", [req.params.id]);
    if (jobs.length === 0) return res.status(404).json({ error: "Job not found" });
    const job = jobs[0];
    res.json({ ...job, required_skills: typeof job.required_skills === 'string' ? JSON.parse(job.required_skills) : job.required_skills });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch job details" });
  }
});

app.put("/api/jobs/:id", authMiddleware, allowRoles("recruiter"), async (req: any, res) => {
  try {
    const { title, description, required_skills, experience_required, location, salary } = req.body;
    await pool.query(
      "UPDATE jobs SET title = ?, description = ?, required_skills = ?, experience_required = ?, location = ?, salary = ? WHERE id = ? AND recruiter_id = ?",
      [title, description, JSON.stringify(required_skills || []), experience_required, location, salary, req.params.id, req.userId]
    );
    res.json({ message: "Job updated successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to update job" });
  }
});

app.delete("/api/jobs/:id", authMiddleware, allowRoles("recruiter"), async (req: any, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const jobId = req.params.id;
    const recruiterId = req.userId;

    // Check if job exists and belongs to recruiter
    const [jobs] = await connection.query<any[]>("SELECT id FROM jobs WHERE id = ? AND recruiter_id = ?", [jobId, recruiterId]);
    if (jobs.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Job not found or unauthorized" });
    }

    // 1. Get applications for this job
    const [apps] = await connection.query<any[]>("SELECT id FROM applications WHERE job_id = ?", [jobId]);
    const appIds = apps.map(a => a.id);

    if (appIds.length > 0) {
      // 2. Delete interviews for these applications
      await connection.query("DELETE FROM interviews WHERE application_id IN (?)", [appIds]);
      // 3. Delete applications
      await connection.query("DELETE FROM applications WHERE job_id = ?", [jobId]);
    }

    // 4. Delete job
    await connection.query("DELETE FROM jobs WHERE id = ? AND recruiter_id = ?", [jobId, recruiterId]);

    await connection.commit();
    res.json({ message: "Job deleted successfully" });
  } catch (error: any) {
    await connection.rollback();
    console.error("Delete job error:", error);
    res.status(500).json({ error: "Failed to delete job: " + error.message });
  } finally {
    connection.release();
  }
});

app.get("/api/candidatesByJob", authMiddleware, allowRoles("recruiter"), async (req: any, res) => {
  try {
    const jobId = req.query.job_id as string;
    if (!jobId) return res.status(400).json({ error: "Missing job_id" });

    const [candidates] = await pool.query<any[]>(
      `SELECT a.id as application_id, a.status, a.match_score, a.applied_at, 
              u.id as user_id, u.name, u.email, 
              r.filename as resume_filename, r.parsed_skills, r.parsed_education, r.parsed_experience,
              r.current_location, r.notice_period, r.total_experience, r.current_salary
       FROM applications a 
       JOIN users u ON a.user_id = u.id 
       JOIN resumes r ON a.resume_id = r.id
       JOIN jobs j ON a.job_id = j.id
       WHERE a.job_id = ? AND j.recruiter_id = ? 
       ORDER BY a.match_score DESC`,
      [jobId, req.userId]
    );
    res.json(candidates);
  } catch (error) {
    console.error("Error fetching ranked candidates:", error);
    res.status(500).json({ error: "Failed to fetch ranked candidates" });
  }
});

// Get all resumes for the current user
app.get("/api/resumes", authMiddleware, allowRoles("candidate"), async (req: any, res) => {
  try {
    const [resumes] = await pool.query<any[]>(
      "SELECT * FROM resumes WHERE userId = ? ORDER BY uploadedAt DESC",
      [req.userId]
    );
    res.json({ resumes });
  } catch (error) {
    console.error("Error fetching resumes:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Upload a resume and store it persistently
app.post("/api/upload-resume", authMiddleware, allowRoles("candidate"), diskUpload.single("resume"), async (req: any, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No resume file provided" });

    // 1. Extract Text for AI Parsing
    const buffer = await fs.readFile(file.path);
    const resumeText = await extractTextFromPDF(buffer);

    // 2. AI Parsing for Structured Data
    const prompt = `
    Extract professional details from the following resume text.
    Return ONLY valid JSON with the following structure:
    {
      "skills": ["<skill 1>", "<skill 2>"],
      "education": [{"degree": "<degree>", "institution": "<institution>", "year": "<year>"}],
      "experience": [{"title": "<title>", "company": "<company>", "duration": "<duration>"}],
      "current_location": "<city, state>",
      "notice_period": "<e.g. 30 days, Immediate>",
      "total_experience": "<e.g. 5 years>",
      "current_salary": "<e.g. 12 LPA, 80k/month>"
    }
    
    Resume Text: ${resumeText.substring(0, 8000)}
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }, { apiVersion: "v1" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let resultText = response.text() || "";
    resultText = resultText.replace(/```json\n/g, "").replace(/```\n?/g, "").trim();
    const parsedData = JSON.parse(resultText);

    // 3. Save to Database
    const resumeId = Date.now().toString();
    const uploadedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');

    await pool.query(
      "INSERT INTO resumes (id, userId, filename, file_path, uploadedAt, parsed_skills, parsed_education, parsed_experience, current_location, notice_period, total_experience, current_salary) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        resumeId, 
        req.userId, 
        file.originalname, 
        file.path, 
        uploadedAt, 
        JSON.stringify(parsedData.skills || []), 
        JSON.stringify(parsedData.education || []), 
        JSON.stringify(parsedData.experience || []),
        parsedData.current_location || "",
        parsedData.notice_period || "",
        parsedData.total_experience || "",
        parsedData.current_salary || ""
      ]
    );

    res.json({ resumeId, message: "Resume uploaded and parsed successfully", parsedData });
  } catch (error) {
    console.error("Upload & Parse Error:", error);
    res.status(500).json({ error: "Failed to upload and parse resume" });
  }
});

// ==========================================
// --- APPLICATIONS APIs ---
// ==========================================
app.post("/api/applications", authMiddleware, allowRoles("candidate"), async (req: any, res) => {
  try {
    const { job_id, resume_id } = req.body;
    
    // 1. Get Resume and Job details
    const [[resume]] = await pool.query<any[]>("SELECT * FROM resumes WHERE id = ? AND userId = ?", [resume_id, req.userId]);
    const [[job]] = await pool.query<any[]>("SELECT * FROM jobs WHERE id = ?", [job_id]);

    if (!resume) return res.status(404).json({ error: "Resume not found" });
    if (!job) return res.status(404).json({ error: "Job not found" });

    // 2. Parse Resume
    let resumeText = "";
    if (resume.file_path) {
      try {
        console.log(`[Apply] Reading resume file: ${resume.file_path}`);
        const buffer = await fs.readFile(resume.file_path);
        resumeText = await extractTextFromPDF(buffer);
        console.log(`[Apply] Successfully extracted ${resumeText.length} characters`);
      } catch (err: any) {
        console.error(`[Apply] PDF Parse Error for ${resume.file_path}:`, err);
      }
    }

    if (!resumeText || resumeText.trim().length === 0) {
      console.error(`[Apply] Text extraction failed for ${resume.file_path}. Path exists: ${!!resume.file_path}`);
      return res.status(400).json({ 
        error: "Could not extract text from stored resume",
        details: resume.file_path 
          ? "The system was unable to read the content of your saved PDF. This can happen if the file was deleted or is corrupted. Please try re-uploading your resume."
          : "This resume was uploaded without a physical file record. Please upload your resume again using the 'Upload Resume' page."
      });
    }

    // 2.5 Mandatory Keyword Check
    const requiredSkills = typeof job.required_skills === 'string' ? JSON.parse(job.required_skills) : job.required_skills;
    if (requiredSkills && requiredSkills.length > 0) {
      const resumeTextLower = resumeText.toLowerCase();
      const missingSkills = requiredSkills.filter((skill: string) => !resumeTextLower.includes(skill.toLowerCase()));
      
      if (missingSkills.length > 0) {
        return res.status(400).json({ 
          error: "Mandatory Keywords Missing", 
          details: `Your resume does not contain the required skills for this role: ${missingSkills.join(', ')}` 
        });
      }
    }

    // 3 & 4. AI Match Score Calculation
    const prompt = `
    Analyze the following resume against the job description and provide a match score.
    Provide the output in valid JSON format ONLY.
    
    Schema:
    {
      "score": <number between 0 and 100>,
      "reasoning": "<short explanation of the score>"
    }

    Job Title: ${job.title}
    Job Description: ${job.description}

    Resume Text: ${resumeText.substring(0, 8000)}
    `;

    if (!genAI) {
      return res.status(500).json({ error: "Gemini AI is not configured. Please check GEMINI_API_KEY." });
    }
    const response = await getWorkingModel(prompt);
    let resultText = response.text() || "";
    resultText = resultText.replace(/```json\n/g, "").replace(/```\n?/g, "").trim();
    const parsedResult = JSON.parse(resultText);
    const matchScore = parsedResult.score || 0;

    // 5 & 6. Save application
    const applicationId = Date.now().toString();
    await pool.query(
      "INSERT INTO applications (id, user_id, job_id, resume_id, match_score, status) VALUES (?, ?, ?, ?, ?, ?)",
      [applicationId, req.userId, job_id, resume_id, matchScore, "applied"]
    );

    res.json({ 
      id: applicationId, 
      message: "Applied successfully", 
      match_score: matchScore,
      reasoning: parsedResult.reasoning
    });
  } catch (error) {
    console.error("Error applying to job:", error);
    res.status(500).json({ error: "Failed to apply" });
  }
});

app.get("/api/applications", authMiddleware, async (req: any, res) => {
  try {
    if (req.role === 'recruiter') {
      const [applications] = await pool.query<any[]>(
        `SELECT a.*, j.title as job_title, u.name as candidate_name, u.email as candidate_email 
         FROM applications a 
         JOIN jobs j ON a.job_id = j.id 
         JOIN users u ON a.user_id = u.id 
         WHERE j.recruiter_id = ? ORDER BY a.applied_at DESC`,
        [req.userId]
      );
      return res.json(applications);
    } else {
      const [applications] = await pool.query<any[]>(
        `SELECT a.*, j.title as job_title, j.description as job_description 
         FROM applications a 
         JOIN jobs j ON a.job_id = j.id 
         WHERE a.user_id = ? ORDER BY a.applied_at DESC`,
        [req.userId]
      );
      return res.json(applications);
    }
  } catch (error) {
    console.error("Error fetching applications:", error);
    res.status(500).json({ error: "Failed to fetch applications" });
  }
});

app.put("/api/applications/:id/status", authMiddleware, allowRoles("recruiter"), async (req: any, res) => {
  try {
    const { status } = req.body; // 'shortlisted', 'interview', 'rejected'
    await pool.query("UPDATE applications SET status = ? WHERE id = ?", [status, req.params.id]);
    res.json({ message: "Status updated" });
  } catch (error) {
    res.status(500).json({ error: "Failed to update status" });
  }
});

// --- Recruiter Actions ---
app.post("/api/recruiter/shortlist", authMiddleware, allowRoles("recruiter"), async (req: any, res) => {
  try {
    const { application_id } = req.body;
    await pool.query("UPDATE applications SET status = 'shortlisted' WHERE id = ?", [application_id]);
    res.json({ message: "Application shortlisted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to shortlist application" });
  }
});

app.post("/api/recruiter/reject", authMiddleware, allowRoles("recruiter"), async (req: any, res) => {
  try {
    const { application_id } = req.body;
    await pool.query("UPDATE applications SET status = 'rejected' WHERE id = ?", [application_id]);
    res.json({ message: "Application rejected" });
  } catch (error) {
    res.status(500).json({ error: "Failed to reject application" });
  }
});

app.post("/api/recruiter/schedule-interview", authMiddleware, allowRoles("recruiter"), async (req: any, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { application_id, date } = req.body;
    const interviewId = Date.now().toString();

    // 1. Create interview record
    await connection.query(
      "INSERT INTO interviews (id, application_id, date) VALUES (?, ?, ?)",
      [interviewId, application_id, new Date(date)]
    );

    // 2. Update application status
    await connection.query(
      "UPDATE applications SET status = 'interview' WHERE id = ?",
      [application_id]
    );

    await connection.commit();
    res.json({ id: interviewId, message: "Interview scheduled and status updated" });
  } catch (error) {
    await connection.rollback();
    console.error("Error scheduling interview:", error);
    res.status(500).json({ error: "Failed to schedule interview" });
  } finally {
    connection.release();
  }
});

// GET interviews for the recruiter
app.get("/api/interviews", authMiddleware, allowRoles("recruiter"), async (req: any, res) => {
  try {
    const [interviews] = await pool.query<any[]>(
      `SELECT i.*, a.job_id, a.user_id, u.name as candidate_name 
       FROM interviews i 
       JOIN applications a ON i.application_id = a.id
       JOIN users u ON a.user_id = u.id
       JOIN jobs j ON a.job_id = j.id
       WHERE j.recruiter_id = ? ORDER BY i.date ASC`,
      [req.userId]
    );
    res.json(interviews);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch interviews" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV === "development") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Global error handler to ensure JSON responses
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Global Error:", err);
    res.status(err.status || 500).json({ 
      error: "Internal Server Error", 
      message: err.message || "An unexpected error occurred" 
    });
  });
}

startServer();
