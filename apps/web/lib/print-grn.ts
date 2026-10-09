/** Client-safe GRN print helpers. Do not import server DB modules here. */

export type GrnPrintDetail = {
  id: string;
  grn_number: string;
  status: string;
  bill_no: string | null;
  invoice_amount: number;
  invoice_date: string | null;
  document_path: string | null;
  discount_amount?: number;
  tax_amount?: number;
  lines_total: number;
  note: string | null;
  created_at: string;
  approved_at: string | null;
  supplier: {
    id: string | null;
    code: string | null;
    name: string | null;
    trade_name: string | null;
    gstin: string | null;
    pan: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    state_code: string | null;
  };
  company: {
    name: string;
    address: string | null;
    gstin: string | null;
    phone: string | null;
  };
  lines: Array<{
    product_name: string;
    sku: string | null;
    variant_name: string | null;
    quantity: number;
    purchase_price: number;
    line_total: number;
    color_breakdown?: Array<{ color: string; quantity: number }> | null;
  }>;
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function money(value: number) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function printDocument(html: string) {
  const existing = document.getElementById("vasritha-grn-print-frame");
  existing?.remove();

  const frame = document.createElement("iframe");
  frame.id = "vasritha-grn-print-frame";
  frame.setAttribute("aria-hidden", "true");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  document.body.appendChild(frame);

  const doc = frame.contentDocument;
  if (!doc) {
    frame.remove();
    throw new Error("Could not open the print view");
  }

  doc.open();
  doc.write(html);
  doc.close();

  const runPrint = () => {
    const win = frame.contentWindow;
    if (!win) return;
    win.focus();
    win.print();
    window.setTimeout(() => frame.remove(), 1500);
  };

  if (frame.contentDocument?.readyState === "complete") {
    window.setTimeout(runPrint, 80);
  } else {
    frame.onload = () => window.setTimeout(runPrint, 80);
  }
}

export function printGrnDocument(detail: GrnPrintDetail) {
  const supplierBits = [
    detail.supplier.name,
    detail.supplier.code ? `Code ${detail.supplier.code}` : "",
    detail.supplier.gstin ? `GSTIN ${detail.supplier.gstin}` : "",
    detail.supplier.pan ? `PAN ${detail.supplier.pan}` : "",
    [detail.supplier.address, detail.supplier.city, detail.supplier.state]
      .filter(Boolean)
      .join(", "),
    detail.supplier.phone ? `Phone ${detail.supplier.phone}` : ""
  ].filter(Boolean);

  const discountAmount = Number(detail.discount_amount || 0);
  const taxAmount = Number(detail.tax_amount || 0);
  const grandTotal = Math.round((Number(detail.lines_total || 0) - discountAmount + taxAmount) * 100) / 100;

  const rows = detail.lines
    .map((line, i) => {
      const colours = (line.color_breakdown || [])
        .filter((s) => s.color && s.quantity > 0)
        .map((s) => `${escapeHtml(s.color)} × ${s.quantity}`)
        .join(", ");
      return `<tr>
        <td>${i + 1}</td>
        <td>
          <strong>${escapeHtml(line.product_name)}</strong>
          ${line.variant_name ? `<div class="muted">${escapeHtml(line.variant_name)}</div>` : ""}
          ${colours ? `<div class="muted">${colours}</div>` : ""}
        </td>
        <td>${escapeHtml(line.sku || "—")}</td>
        <td class="num">${line.quantity}</td>
        <td class="num">${escapeHtml(money(line.purchase_price))}</td>
        <td class="num">${escapeHtml(money(line.line_total))}</td>
      </tr>`;
    })
    .join("");

  const html = `<!doctype html><html><head><title>${escapeHtml(detail.grn_number)}</title>
  <style>
    @page { margin: 12mm; size: A4; }
    html, body { margin: 0; background: #fff; color: #1f1610; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; line-height: 1.4; padding: 8mm; }
    h1 { margin: 0; font-size: 20px; letter-spacing: 0.04em; text-transform: uppercase; }
    h2 { margin: 0 0 4px; font-size: 16px; }
    .muted { color: #6b5a4d; font-size: 11px; }
    .header { display: flex; justify-content: space-between; gap: 16px; border-bottom: 2px solid #422314; padding-bottom: 10px; margin-bottom: 14px; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
    .box { border: 1px solid #e4d4c4; border-radius: 6px; padding: 10px 12px; }
    .box h3 { margin: 0 0 6px; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: #7a5a45; }
    table { width: 100%; border-collapse: collapse; margin-top: 4px; }
    th, td { border: 1px solid #e4d4c4; padding: 7px 8px; vertical-align: top; }
    th { background: #f7f0e8; text-align: left; font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; }
    td.num, th.num { text-align: right; white-space: nowrap; }
    .totals { margin-top: 12px; display: flex; justify-content: flex-end; }
    .totals table { width: auto; min-width: 240px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; background: #eef8f0; color: #166534; font-weight: 700; text-transform: uppercase; font-size: 10px; }
    .badge.pending { background: #fff7ed; color: #9a3412; }
    .footer { margin-top: 28px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .sign { border-top: 1px solid #c9b4a0; padding-top: 6px; margin-top: 36px; color: #6b5a4d; }
    @media print { body { padding: 0; } }
  </style></head><body>
    <header class="header">
      <div>
        <h1>${escapeHtml(detail.company.name)}</h1>
        ${detail.company.address ? `<div class="muted">${escapeHtml(detail.company.address)}</div>` : ""}
        <div class="muted">
          ${detail.company.gstin ? `GSTIN ${escapeHtml(detail.company.gstin)}` : ""}
          ${detail.company.phone ? ` · ${escapeHtml(detail.company.phone)}` : ""}
        </div>
      </div>
      <div style="text-align:right">
        <h2>Goods Receipt Note</h2>
        <div><strong>${escapeHtml(detail.grn_number)}</strong></div>
        <div class="badge ${detail.status === "approved" ? "" : "pending"}">${escapeHtml(
          detail.status.replace(/_/g, " ")
        )}</div>
      </div>
    </header>

    <section class="meta">
      <div class="box">
        <h3>Supplier</h3>
        ${supplierBits.map((b) => `<div>${escapeHtml(b)}</div>`).join("") || "<div>—</div>"}
      </div>
      <div class="box">
        <h3>Document</h3>
        <div>Bill / invoice: <strong>${escapeHtml(detail.bill_no || "—")}</strong></div>
        <div>Invoice date: ${escapeHtml(fmtDate(detail.invoice_date))}</div>
        <div>Created: ${escapeHtml(fmtDate(detail.created_at))}</div>
        <div>Approved: ${escapeHtml(fmtDate(detail.approved_at))}</div>
      </div>
    </section>

    <table>
      <thead>
        <tr>
          <th style="width:36px">#</th>
          <th>Product</th>
          <th>SKU</th>
          <th class="num">Qty</th>
          <th class="num">Purchase ₹</th>
          <th class="num">Line total</th>
        </tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="6">No lines</td></tr>`}</tbody>
    </table>

    <div class="totals">
      <table>
        <tr><td>Lines total</td><td class="num">${escapeHtml(money(detail.lines_total))}</td></tr>
        <tr><td>Discount</td><td class="num">-${escapeHtml(money(discountAmount))}</td></tr>
        <tr><td>Tax</td><td class="num">${escapeHtml(money(taxAmount))}</td></tr>
        <tr><td>Grand total</td><td class="num"><strong>${escapeHtml(money(grandTotal))}</strong></td></tr>
        <tr><td>Invoice amount</td><td class="num"><strong>${escapeHtml(money(detail.invoice_amount))}</strong></td></tr>
      </table>
    </div>

    ${
      detail.note
        ? `<div class="box" style="margin-top:14px"><h3>Notes</h3><div>${escapeHtml(detail.note)}</div></div>`
        : ""
    }

    <footer class="footer">
      <div class="sign">Received by</div>
      <div class="sign">Approved by</div>
    </footer>
  </body></html>`;

  printDocument(html);
}
