import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfModule = require("pdf-parse");
const PDFParseClass = pdfModule.PDFParse;
console.log("Type of PDFParseClass:", typeof PDFParseClass);
if (typeof PDFParseClass === 'function') {
    console.log("SUCCESS: PDFParseClass is a function/constructor");
    try {
        const parser = new PDFParseClass({ data: Buffer.from("test") });
        console.log("SUCCESS: Can instantiate PDFParseClass");
    } catch (e) {
        console.log("FAILURE: Cannot instantiate PDFParseClass", e.message);
    }
} else {
    console.log("FAILURE: PDFParseClass is not a function", PDFParseClass);
}
