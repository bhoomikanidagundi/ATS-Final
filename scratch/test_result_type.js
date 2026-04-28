import { PDFParse } from 'pdf-parse';

async function test() {
    const result = new PDFParse(Buffer.from([]));
    console.log("Result type:", typeof result);
    console.log("Is Promise?", result instanceof Promise);
    console.log("Keys:", Object.keys(result));
}
test();
