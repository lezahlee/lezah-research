const PDFDocument = require("pdfkit");

// Brand colors as RGB
const NAVY   = [13, 27, 42];
const TEAL   = [78, 168, 180];
const GOLD   = [196, 156, 82];
const WHITE  = [255, 255, 255];
const BODY   = [28, 43, 58];
const MUTED  = [138, 155, 170];
const BORDER = [221, 227, 232];
const RISK_BG= [244, 246, 248];

exports.handler = async function(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const { company, sector, date, results, sources } = JSON.parse(event.body);

    const SECTION_LABELS = {
      snapshot:    "Company Snapshot",
      market:      "Market Sizing",
      competitive: "Competitive Landscape",
      channel:     "Channel & Distribution",
      consumer:    "Consumer Trends",
      supplychain: "Supply Chain & Raw Material Inputs",
      founder:     "Founder Diligence",
      management:  "Management Team Overview",
      lezahfit:    "Fit with Lezah Capital",
    };

    const ORDER = ["snapshot","market","competitive","channel","consumer","supplychain","founder","management","lezahfit"];

    // Build PDF in memory
    const doc = new PDFDocument({
      margin: 50,
      size: "letter",
      info: { Title: `${company} -- Lezah Capital Research Report`, Author: "Lezah Capital" }
    });

    const chunks = [];
    doc.on("data", chunk => chunks.push(chunk));

    // ── Header ────────────────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 80).fill(NAVY);

    // Logo mark (simplified L shape)
    doc.save();
    doc.fill(TEAL);
    doc.polygon([20,70],[29,46],[38,70],[33,70],[29,58],[25,70]).fill();
    doc.rect(20, 65, 14, 5).fill();
    doc.restore();

    // Wordmark
    doc.fill(TEAL).font("Helvetica-Bold").fontSize(14)
       .text("LEZAH CAPITAL", 48, 28, { lineBreak: false });
    doc.fill(MUTED).font("Helvetica").fontSize(7)
       .text("A BUILDERS' FAMILY OFFICE", 48, 46, { lineBreak: false });

    // Company name right-aligned
    doc.fill(WHITE).font("Helvetica-Bold").fontSize(20)
       .text(company.toUpperCase(), 50, 22, { align: "right", lineBreak: false });

    // Sector badge
    if (sector) {
      const badgeText = sector.toUpperCase();
      const bw = doc.widthOfString(badgeText, { fontSize: 7 }) + 14;
      const bx = doc.page.width - 50 - bw;
      doc.roundedRect(bx, 48, bw, 14, 3).fill([26, 48, 64]);
      doc.fill(TEAL).font("Helvetica-Bold").fontSize(7)
         .text(badgeText, bx + 7, 52, { lineBreak: false });
    }

    // ── Tagline ───────────────────────────────────────────────────────────────
    doc.moveDown(0.5);
    doc.y = 92;
    doc.fill(GOLD).font("Helvetica").fontSize(7.5)
       .text(`INVESTMENT RESEARCH REPORT  ·  CONSUMER / CPG  ·  ${date}`, 50, 92, { letterSpacing: 1 });

    doc.y = 108;

    // ── Sections ──────────────────────────────────────────────────────────────
    const pageW = doc.page.width - 100; // usable width

    for (const id of ORDER) {
      if (!results[id]) continue;
      const label = SECTION_LABELS[id] || id;
      const text  = results[id];

      // Check if we need a new page (leave 120pt buffer)
      if (doc.y > doc.page.height - 150) doc.addPage();

      const startY = doc.y;

      // Section header bar
      doc.rect(50, startY, pageW, 22).fill([250, 251, 252]);
      doc.rect(50, startY, pageW, 22).stroke(BORDER);
      // Teal left accent
      doc.rect(50, startY, 3, 22).fill(TEAL);

      doc.fill(TEAL).font("Helvetica-Bold").fontSize(7.5)
         .text(label.toUpperCase(), 62, startY + 7, { lineBreak: false, letterSpacing: 0.8 });

      doc.y = startY + 22;

      // Section body
      const bodyStartY = doc.y;
      doc.fill(BODY).font("Helvetica").fontSize(8.5).lineGap(2)
         .text(text, 62, bodyStartY, { width: pageW - 24, lineBreak: true });

      const bodyEndY = doc.y + 10;

      // Draw card border around whole section
      doc.rect(50, startY, pageW, bodyEndY - startY)
         .stroke(BORDER);

      doc.y = bodyEndY + 10;
    }

    // ── Sources ───────────────────────────────────────────────────────────────
    if (sources && sources.length) {
      if (doc.y > doc.page.height - 120) doc.addPage();
      doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke(BORDER);
      doc.y += 10;
      doc.fill(MUTED).font("Helvetica-Bold").fontSize(7.5).text("SOURCES", 50, doc.y, { letterSpacing: 0.8 });
      doc.y += 8;
      sources.forEach((s, i) => {
        if (doc.y > doc.page.height - 60) doc.addPage();
        doc.fill(MUTED).font("Helvetica").fontSize(8)
           .text(`[${i+1}] ${s.title} — ${s.url}`, 50, doc.y, { width: pageW, lineBreak: true });
        doc.y += 2;
      });
    }

    // ── Footer on every page ──────────────────────────────────────────────────
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      const footerY = doc.page.height - 35;
      doc.moveTo(50, footerY).lineTo(doc.page.width-50, footerY).stroke(BORDER);
      doc.fill(MUTED).font("Helvetica").fontSize(7)
         .text("LEZAH CAPITAL  ·  CONFIDENTIAL  ·  FOR INTERNAL USE ONLY", 50, footerY + 6, { align: "left", lineBreak: false });
      doc.fill(MUTED).font("Helvetica").fontSize(7)
         .text(date, 50, footerY + 6, { align: "right", lineBreak: false });
      doc.fill(MUTED).font("Helvetica").fontSize(7)
         .text(`${i+1} / ${range.count}`, 50, footerY + 15, { align: "center", lineBreak: false });
    }

    doc.end();

    await new Promise(resolve => doc.on("end", resolve));

    const pdfBuffer = Buffer.concat(chunks);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${company.replace(/[^a-zA-Z0-9]/g,"_")}_Lezah_Research.pdf"`,
      },
      body: pdfBuffer.toString("base64"),
      isBase64Encoded: true,
    };

  } catch(e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
