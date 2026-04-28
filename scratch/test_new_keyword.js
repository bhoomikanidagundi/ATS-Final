import { PDFParse } from 'pdf-parse';

async function test() {
    try {
        console.log("Trying with 'new'...");
        try {
            const result = new PDFParse(Buffer.from([]));
            console.log("Success with 'new'");
        } catch (e) {
            console.log("Failed with 'new':", e.message);
        }

        console.log("Trying without 'new'...");
        try {
            const result = await PDFParse(Buffer.from([]));
            console.log("Success without 'new'");
        } catch (e) {
            console.log("Failed without 'new':", e.message);
        }
    } catch (e) {
        console.error("General error", e);
    }
}
test();
