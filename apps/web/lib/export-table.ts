import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";

export type ExportColumn = {
  key: string;
  label: string;
  format?: "money" | "date" | "number" | "text";
};

function cellText(value: unknown, format?: ExportColumn["format"]) {
  if (value == null || value === "") return "";
  if (format === "money") {
    const n = Number(value);
    return Number.isFinite(n) ? n.toFixed(2) : String(value);
  }
  if (format === "date") {
    const d = new Date(String(value));
    return Number.isNaN(d.getTime()) ? String(value) : d.toISOString().slice(0, 10);
  }
  return String(value);
}

export function rowsToCsv(columns: ExportColumn[], rows: Array<Record<string, unknown>>) {
  const escape = (v: string) => {
    if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
  };
  const header = columns.map((c) => escape(c.label)).join(",");
  const body = rows
    .map((row) => columns.map((c) => escape(cellText(row[c.key], c.format))).join(","))
    .join("\n");
  return `${header}\n${body}`;
}

export async function rowsToXlsxBuffer(
  columns: ExportColumn[],
  rows: Array<Record<string, unknown>>,
  options?: { sheetName?: string; title?: string }
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Vasritha";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(options?.sheetName || "Report", {
    views: [{ state: "frozen", ySplit: 1 }]
  });

  sheet.columns = columns.map((col) => ({
    header: col.label,
    key: col.key,
    width: Math.min(36, Math.max(12, col.label.length + 4))
  }));

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF5EDE4" }
  };

  for (const row of rows) {
    const values: Record<string, string | number> = {};
    for (const col of columns) {
      const raw = row[col.key];
      if (col.format === "money" || col.format === "number") {
        const n = Number(raw);
        values[col.key] = Number.isFinite(n) ? n : cellText(raw, col.format);
      } else {
        values[col.key] = cellText(raw, col.format);
      }
    }
    sheet.addRow(values);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function rowsToPdfBuffer(
  columns: ExportColumn[],
  rows: Array<Record<string, unknown>>,
  options?: { title?: string; subtitle?: string }
) {
  const doc = new jsPDF({ orientation: columns.length > 6 ? "landscape" : "portrait", unit: "mm" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(options?.title || "Report", margin, y);
  y += 6;

  if (options?.subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.text(options.subtitle, margin, y);
    doc.setTextColor(0);
    y += 6;
  }

  const usable = pageW - margin * 2;
  const colW = usable / Math.max(columns.length, 1);
  const rowH = 6;
  const fontSize = columns.length > 8 ? 7 : 8;

  const drawHeader = () => {
    doc.setFillColor(245, 237, 228);
    doc.rect(margin, y, usable, rowH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fontSize);
    columns.forEach((col, i) => {
      const x = margin + i * colW + 1;
      doc.text(String(col.label).slice(0, 28), x, y + 4, {
        maxWidth: colW - 2
      });
    });
    y += rowH;
  };

  drawHeader();

  doc.setFont("helvetica", "normal");
  doc.setFontSize(fontSize);

  for (const row of rows) {
    if (y + rowH > pageH - margin) {
      doc.addPage();
      y = margin;
      drawHeader();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(fontSize);
    }
    columns.forEach((col, i) => {
      const x = margin + i * colW + 1;
      const text = cellText(row[col.key], col.format).slice(0, 40);
      doc.text(text, x, y + 4, { maxWidth: colW - 2 });
    });
    y += rowH;
  }

  return Buffer.from(doc.output("arraybuffer"));
}

export function attachmentHeaders(filename: string, contentType: string) {
  return {
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${filename}"`
  };
}
