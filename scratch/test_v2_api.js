import { PDFParse } from 'pdf-parse';

async function test() {
    try {
        console.log("Testing new PDFParse({ data: buffer }).getText()...");
        const parser = new PDFParse({ data: Buffer.from([]) });
        try {
            const result = await parser.getText();
            console.log("Result text:", result.text);
        } catch (e) {
            console.log("getText() failed as expected for empty buffer:", e.message);
        }
        await parser.destroy();
        console.log("SUCCESS");
    } catch (e) {
        console.error("FAILURE", e);
    }
}
test();
