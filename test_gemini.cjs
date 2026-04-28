const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("No API key found");
    return;
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  
  // There is no direct listModels in the SDK easily accessible like this in some versions,
  // but we can try a few.
  const models = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-pro"];
  const versions = ["v1", "v1beta"];
  for (const v of versions) {
    for (const m of models) {
      try {
        const model = genAI.getGenerativeModel({ model: m }, { apiVersion: v });
        const result = await model.generateContent("test");
        console.log(`SUCCESS: ${m} (${v})`);
      } catch (e) {
        console.log(`FAILED: ${m} (${v}) - ${e.message}`);
      }
    }
  }
}

listModels();
