import { createRequire } from "module";
import fs from "fs";
const require = createRequire(import.meta.url);
const pdfModule = require("pdf-parse");
const PDFParse = pdfModule.PDFParse;

async function test() {
    try {
        const files = fs.readdirSync("uploads").filter(f => f.endsWith(".pdf"));
        if (files.length === 0) {
            console.log("No PDF files found in uploads/");
            return;
        }
        const filePath = "uploads/" + files[0];
        console.log("Testing with file:", filePath);
        const buffer = fs.readFileSync(filePath);
        
        const parser = new PDFParse({ data: buffer });
        const result = await parser.getText();
        console.log("SUCCESS: Extracted text length:", result.text.length);
        console.log("Preview:", result.text.substring(0, 100));
    } catch (e) {
        console.error("FAILURE:", e.message);
    }
}

test();
