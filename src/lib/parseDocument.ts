// Parse PDF / DOCX / TXT files into plain text in the browser.
import mammoth from "mammoth";

export async function parseFileToText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".txt") || file.type === "text/plain") {
    return await file.text();
  }
  if (name.endsWith(".docx")) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value.trim();
  }
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    const pdfjs = await import("pdfjs-dist");
    const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url" as string)).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    const buffer = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: buffer }).promise;
    let text = "";
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((it: any) => it.str).join(" ") + "\n";
    }
    return text.trim();
  }
  throw new Error("Unsupported file type. Please upload PDF, DOCX or TXT.");
}