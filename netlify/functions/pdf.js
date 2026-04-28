/**
 * Lezah Capital -- PDF generator Netlify function
 * Uses no external dependencies -- generates a clean text-based PDF
 * using raw PDF syntax so pdfkit is not required.
 */

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

    // Build PDF using raw PDF syntax (no external deps needed)
    const W = 612, H = 792;
    const MARGIN = 50;
    const USABLE_W = W - MARGIN * 2;

    // Colors
    const NAVY_RGB  = "0.051 0.106 0.165";
    const TEAL_RGB  = "0.306 0.659 0.706";
    const GOLD_RGB  = "0.769 0.612 0.322";
    const WHITE_RGB = "1 1 1";
    const BODY_RGB  = "0.110 0.169 0.227";
    const MUTED_RGB = "0.541 0.608 0.667";
    const BORDER_RGB= "0.867 0.890 0.910";
    const BG_RGB    = "0.973 0.976 0.973";

    const pages = [];
    let currentPage = [];
    let y = H - MARGIN; // PDF coordinates go bottom-up

    function newPage() {
      if (currentPage.length) pages.push(currentPage);
      currentPage = [];
      y = H - MARGIN;
    }

    function addRaw(...lines) {
      currentPage.push(...lines);
    }

    function setColor(rgb, stroke = false) {
      addRaw(stroke ? `${rgb} RG` : `${rgb} rg`);
    }

    function rect(x, ry, w, h, fill = true, stroke = false) {
      const pdfY = ry - h;
      addRaw(`${x} ${pdfY} ${w} ${h} re`);
      if (fill && stroke) addRaw("B");
      else if (fill) addRaw("f");
      else if (stroke) addRaw("S");
    }

    function line(x1, y1, x2, y2) {
      addRaw(`${x1} ${y1} m ${x2} ${y2} l S`);
    }

    function text(str, x, ty, size, bold = false) {
      const safe = (str || "").replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)");
      const font = bold ? "/F2" : "/F1";
      addRaw(`BT ${font} ${size} Tf ${x} ${ty} Td (${safe}) Tj ET`);
    }

    // Word-wrap helper
    function wrapText(str, maxChars) {
      const words = (str || "").split(" ");
      const lines = [];
      let cur = "";
      for (const w of words) {
        if ((cur + " " + w).trim().length <= maxChars) {
          cur = (cur + " " + w).trim();
        } else {
          if (cur) lines.push(cur);
          cur = w;
        }
      }
      if (cur) lines.push(cur);
      return lines;
    }

    const CHARS_PER_LINE = 95;
    const LINE_H = 13;
    const SECTION_HEADER_H = 22;
    const SECTION_PAD = 10;

    // ── Page 1: Header ────────────────────────────────────────────────────────
    newPage();

    // Navy header bar
    setColor(NAVY_RGB);
    rect(0, H, W, 75);

    // Teal accent line under header
    setColor(TEAL_RGB);
    rect(0, H - 75, W, 2);

    // Company name
    setColor(WHITE_RGB);
    text(company.toUpperCase(), MARGIN, H - 25, 20, true);

    // Lezah Capital wordmark
    setColor(TEAL_RGB);
    text("LEZAH CAPITAL", MARGIN, H - 52, 13, true);

    // Sector badge area
    if (sector) {
      setColor(TEAL_RGB);
      text(sector.toUpperCase(), MARGIN, H - 65, 8);
    }

    // Tagline
    setColor(GOLD_RGB);
    text(`INVESTMENT RESEARCH REPORT  .  CONSUMER / CPG  .  ${date}`, MARGIN, H - 90, 8);

    // Teal rule under tagline
    setColor(TEAL_RGB);
    line(MARGIN, H - 95, W - MARGIN, H - 95);

    y = H - 112;

    // ── Sections ──────────────────────────────────────────────────────────────
    for (const id of ORDER) {
      if (!results[id]) continue;
      const label = SECTION_LABELS[id] || id;
      const bodyLines = wrapText(results[id], CHARS_PER_LINE);
      const sectionH = SECTION_HEADER_H + bodyLines.length * LINE_H + SECTION_PAD * 2;

      // New page if not enough space (leave 80pt buffer for footer)
      if (y - sectionH < 60) {
        newPage();
        y = H - MARGIN;
      }

      const sectionTop = y;
      const sectionBot = y - sectionH;

      // Section background
      setColor(BG_RGB);
      rect(MARGIN, sectionTop, USABLE_W, sectionH);

      // Border
      setColor(BORDER_RGB, true);
      setColor(BG_RGB);
      addRaw(`0.5 w`);
      rect(MARGIN, sectionTop, USABLE_W, sectionH, false, true);

      // Teal left accent bar
      setColor(TEAL_RGB);
      rect(MARGIN, sectionTop, 3, sectionH);

      // Section label
      setColor(TEAL_RGB);
      text(label.toUpperCase(), MARGIN + 12, sectionTop - 15, 8, true);

      // Divider under label
      setColor(BORDER_RGB, true);
      addRaw("0.5 w");
      line(MARGIN + 12, sectionTop - SECTION_HEADER_H, W - MARGIN, sectionTop - SECTION_HEADER_H);

      // Body text
      setColor(BODY_RGB);
      let ty = sectionTop - SECTION_HEADER_H - LINE_H;
      for (const ln of bodyLines) {
        text(ln, MARGIN + 12, ty, 8.5);
        ty -= LINE_H;
      }

      y = sectionBot - 10;
    }

    // ── Sources ───────────────────────────────────────────────────────────────
    if (sources && sources.length) {
      if (y < 120) newPage();

      setColor(BORDER_RGB, true);
      line(MARGIN, y, W - MARGIN, y);
      y -= 15;

      setColor(MUTED_RGB);
      text("SOURCES", MARGIN, y, 8, true);
      y -= 14;

      for (let i = 0; i < sources.length; i++) {
        if (y < 60) newPage();
        const src = `[${i+1}] ${sources[i].title} — ${sources[i].url}`;
        const srcLines = wrapText(src, CHARS_PER_LINE);
        for (const ln of srcLines) {
          setColor(MUTED_RGB);
          text(ln, MARGIN, y, 7.5);
          y -= 11;
        }
        y -= 2;
      }
    }

    // Push last page
    if (currentPage.length) pages.push(currentPage);

    // ── Assemble PDF ──────────────────────────────────────────────────────────
    const objects = [];
    let objNum = 1;

    function addObj(content) {
      objects.push({ num: objNum++, content });
      return objNum - 1;
    }

    // Font objects
    const f1Num = addObj(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`);
    const f2Num = addObj(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`);

    // Page content streams + page objects
    const pageObjNums = [];
    for (const pageContent of pages) {
      const stream = pageContent.join("\n");
      const streamNum = addObj(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
      const resDict = `<< /Font << /F1 ${f1Num} 0 R /F2 ${f2Num} 0 R >> >>`;

      // Footer in each page stream (added directly)
      const footerY = 30;
      const footerContent = [
        `${MUTED_RGB} rg`,
        `/F1 7 Tf`,
        `BT /F1 7 Tf ${MARGIN} ${footerY} Td (LEZAH CAPITAL  .  CONFIDENTIAL  .  FOR INTERNAL USE ONLY) Tj ET`,
        `BT /F1 7 Tf ${W - MARGIN - 60} ${footerY} Td (${date}) Tj ET`,
      ].join("\n");
      const footerStreamNum = addObj(`<< /Length ${Buffer.byteLength(footerContent)} >>\nstream\n${footerContent}\nendstream`);

      const pageNum = addObj(`<< /Type /Page /MediaBox [0 0 ${W} ${H}] /Contents [${streamNum} 0 R ${footerStreamNum} 0 R] /Resources ${resDict} /Parent 999 0 R >>`);
      pageObjNums.push(pageNum);
    }

    // Pages dict (num 999 is a placeholder -- we'll fix the reference)
    const pagesNum = addObj(`<< /Type /Pages /Kids [${pageObjNums.map(n=>`${n} 0 R`).join(" ")}] /Count ${pages.length} >>`);

    // Fix parent references in page objects
    for (const n of pageObjNums) {
      objects[n-1].content = objects[n-1].content.replace("/Parent 999 0 R", `/Parent ${pagesNum} 0 R`);
    }

    // Catalog
    const catalogNum = addObj(`<< /Type /Catalog /Pages ${pagesNum} 0 R >>`);

    // Build PDF bytes
    let pdf = "%PDF-1.4\n";
    const offsets = [];
    for (const obj of objects) {
      offsets.push(Buffer.byteLength(pdf));
      pdf += `${obj.num} 0 obj\n${obj.content}\nendobj\n`;
    }

    const xrefOffset = Buffer.byteLength(pdf);
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const off of offsets) {
      pdf += `${String(off).padStart(10,"0")} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogNum} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    const pdfBuffer = Buffer.from(pdf, "latin1");
    const safeName = (company || "Report").replace(/[^a-zA-Z0-9]/g, "_");

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}_Lezah_Research.pdf"`,
      },
      body: pdfBuffer.toString("base64"),
      isBase64Encoded: true,
    };

  } catch(e) {
    console.error(e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
