import { PDFParse } from 'pdf-parse';
import fs from 'fs';
import path from 'path';

async function test() {
    try {
        console.log("PDFParse is a:", typeof PDFParse);
        // We don't even need a real buffer to test if it's a function
        console.log("SUCCESS");
    } catch (e) {
        console.error("FAILURE", e);
    }
}
test();
