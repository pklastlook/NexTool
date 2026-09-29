/**
 * Document generators — real PDF/DOCX output using pdfkit + docx.
 */
import PDFDocument from "pdfkit";
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType } from "docx";

export interface InvoiceData {
  type: "invoice" | "quotation" | "receipt";
  number: string;
  date: string;
  dueDate?: string;
  from: { name: string; address: string; email?: string; phone?: string };
  to: { name: string; address: string; email?: string };
  items: { description: string; quantity: number; price: number }[];
  currency: string;
  taxRate: number;
  discount: number;
  notes?: string;
}

function computeTotals(data: InvoiceData) {
  const subtotal = data.items.reduce((s, i) => s + i.quantity * i.price, 0);
  const discountAmount = (subtotal * data.discount) / 100;
  const afterDiscount = subtotal - discountAmount;
  const taxAmount = (afterDiscount * data.taxRate) / 100;
  const total = afterDiscount + taxAmount;
  return { subtotal, discountAmount, afterDiscount, taxAmount, total };
}

function fmt(n: number, currency: string) {
  return `${currency}${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Generate a real PDF invoice/quotation/receipt with pdfkit. */
export async function generatePdfDocument(data: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const totals = computeTotals(data);
    const title = data.type === "invoice" ? "INVOICE" : data.type === "quotation" ? "QUOTATION" : "RECEIPT";

    // Header
    doc.fontSize(24).font("Helvetica-Bold").text(title, { align: "left" });
    doc.fontSize(10).font("Helvetica").text(`#${data.number}`, { align: "right" });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Date: ${data.date}`, { align: "right" });
    if (data.dueDate) doc.text(`Due: ${data.dueDate}`, { align: "right" });
    doc.moveDown(1);

    // From / To
    doc.font("Helvetica-Bold").fontSize(10).text("FROM:", 50, doc.y);
    doc.font("Helvetica").text(data.from.name, 50, doc.y + 14);
    doc.text(data.from.address, 50);
    if (data.from.email) doc.text(data.from.email);
    if (data.from.phone) doc.text(data.from.phone);

    doc.font("Helvetica-Bold").text("BILL TO:", 320, doc.y - 60);
    doc.font("Helvetica").text(data.to.name, 320);
    doc.text(data.to.address, 320);
    if (data.to.email) doc.text(data.to.email);
    doc.moveDown(1);

    // Items table
    const tableTop = doc.y + 10;
    doc.font("Helvetica-Bold").fontSize(10);
    doc.text("Description", 50, tableTop);
    doc.text("Qty", 320, tableTop);
    doc.text("Price", 380, tableTop);
    doc.text("Amount", 460, tableTop);
    doc.moveTo(50, tableTop + 14).lineTo(545, tableTop + 14).stroke();
    doc.font("Helvetica").fontSize(10);

    let y = tableTop + 22;
    for (const item of data.items) {
      const amount = item.quantity * item.price;
      doc.text(item.description, 50, y, { width: 260 });
      doc.text(String(item.quantity), 320, y);
      doc.text(fmt(item.price, data.currency), 380, y);
      doc.text(fmt(amount, data.currency), 460, y);
      y += 20;
    }
    doc.moveTo(50, y).lineTo(545, y).stroke();
    y += 15;

    // Totals
    doc.text("Subtotal:", 380, y);
    doc.text(fmt(totals.subtotal, data.currency), 460, y);
    y += 18;
    if (data.discount > 0) {
      doc.text(`Discount (${data.discount}%):`, 380, y);
      doc.text(`-${fmt(totals.discountAmount, data.currency)}`, 460, y);
      y += 18;
    }
    doc.text(`Tax (${data.taxRate}%):`, 380, y);
    doc.text(fmt(totals.taxAmount, data.currency), 460, y);
    y += 22;
    doc.font("Helvetica-Bold").fontSize(12);
    doc.text("TOTAL:", 380, y);
    doc.text(fmt(totals.total, data.currency), 460, y);
    doc.font("Helvetica").fontSize(10);
    y += 30;

    if (data.notes) {
      doc.moveDown(1);
      doc.font("Helvetica-Bold").text("Notes:");
      doc.font("Helvetica").text(data.notes);
    }

    doc.end();
  });
}

/** Generate a real DOCX invoice. */
export async function generateDocxDocument(data: InvoiceData): Promise<Buffer> {
  const totals = computeTotals(data);
  const title = data.type === "invoice" ? "INVOICE" : data.type === "quotation" ? "QUOTATION" : "RECEIPT";

  const itemRows = data.items.map((item) =>
    new TableRow({
      children: [
        new TableCell({ children: [new Paragraph(item.description)], width: { size: 60, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph(String(item.quantity))] }),
        new TableCell({ children: [new Paragraph(fmt(item.price, data.currency))] }),
        new TableCell({ children: [new Paragraph(fmt(item.quantity * item.price, data.currency))] }),
      ],
    })
  );

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 48 })] }),
        new Paragraph({ children: [new TextRun(`#${data.number}  ·  Date: ${data.date}${data.dueDate ? `  ·  Due: ${data.dueDate}` : ""}`)] }),
        new Paragraph({ text: "" }),
        new Paragraph({ children: [new TextRun({ text: "From:", bold: true }), new TextRun(` ${data.from.name}, ${data.from.address}`)] }),
        new Paragraph({ children: [new TextRun({ text: "Bill To:", bold: true }), new TextRun(` ${data.to.name}, ${data.to.address}`)] }),
        new Paragraph({ text: "" }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Description", bold: true })]})] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Qty", bold: true })]})] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Price", bold: true })]})] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Amount", bold: true })]})] }),
              ],
            }),
            ...itemRows,
          ],
        }),
        new Paragraph({ text: "" }),
        new Paragraph({ children: [new TextRun(`Subtotal: ${fmt(totals.subtotal, data.currency)}`)] }),
        ...(data.discount > 0 ? [new Paragraph({ children: [new TextRun(`Discount (${data.discount}%): -${fmt(totals.discountAmount, data.currency)}`)] })] : []),
        new Paragraph({ children: [new TextRun(`Tax (${data.taxRate}%): ${fmt(totals.taxAmount, data.currency)}`)] }),
        new Paragraph({ children: [new TextRun({ text: `TOTAL: ${fmt(totals.total, data.currency)}`, bold: true, size: 28 })] }),
        ...(data.notes ? [new Paragraph({ text: "" }), new Paragraph({ children: [new TextRun({ text: "Notes:", bold: true })] }), new Paragraph(data.notes)] : []),
      ],
    }],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
