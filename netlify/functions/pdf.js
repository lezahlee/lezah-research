/**
 * Lezah Capital -- PDF generator Netlify function
 * No external dependencies -- pure Node.js raw PDF generation
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

    const W = 612, H = 792;
    const ML = 50, MR = 50;
    const USABLE_W = W - ML - MR;

    // Colors (r g b as PDF float strings)
    const C = {
      navy:   "0.051 0.106 0.165",
      teal:   "0.306 0.659 0.706",
      gold:   "0.769 0.612 0.322",
      white:  "1 1 1",
      body:   "0.110 0.169 0.227",
      muted:  "0.541 0.608 0.667",
      border: "0.867 0.890 0.910",
      bg:     "0.965 0.969 0.973",
      riskbg: "0.953 0.957 0.961",
    };

    // ── Markdown cleaner ───────────────────────────────────────────────────────
    function cleanMarkdown(text) {
      return (text || "")
        .replace(/#{1,6}\s+/g, "")          // remove ## headings
        .replace(/\*\*(.+?)\*\*/g, "$1")    // remove **bold**
        .replace(/\*(.+?)\*/g, "$1")        // remove *italic*
        .replace(/^[-•]\s+/gm, "  • ")      // normalize bullet points
        .replace(/^\d+\.\s+/gm, (m) => m)  // keep numbered lists as-is
        .replace(/\n{3,}/g, "\n\n")         // collapse triple newlines
        .trim();
    }

    // ── Text wrapper ──────────────────────────────────────────────────────────
    // Approximate chars per line at given font size across usable width minus padding
    function charsPerLine(fontSize, indent = 0) {
      const avgCharW = fontSize * 0.52;
      return Math.floor((USABLE_W - indent) / avgCharW);
    }

    function wrapLine(str, maxChars) {
      if (!str || !str.trim()) return [""];
      const words = str.split(" ");
      const lines = [];
      let cur = "";
      for (const w of words) {
        const test = cur ? cur + " " + w : w;
        if (test.length <= maxChars) {
          cur = test;
        } else {
          if (cur) lines.push(cur);
          cur = w;
        }
      }
      if (cur) lines.push(cur);
      return lines.length ? lines : [""];
    }

    function wrapParagraph(text, fontSize, indent = 0) {
      const maxChars = charsPerLine(fontSize, indent);
      const rawLines = text.split("\n");
      const result = [];
      for (const raw of rawLines) {
        const trimmed = raw.trimEnd();
        if (!trimmed) {
          result.push({ text: "", isBlank: true });
        } else {
          const isBullet = trimmed.startsWith("  • ");
          const bulletIndent = isBullet ? 12 : 0;
          const wrapped = wrapLine(trimmed, charsPerLine(fontSize, indent + bulletIndent));
          wrapped.forEach((ln, i) => {
            result.push({ text: ln, isBullet: isBullet && i === 0, bulletCont: isBullet && i > 0 });
          });
        }
      }
      return result;
    }

    // ── PDF builder ───────────────────────────────────────────────────────────
    const pages = [];
    let ops = [];   // current page ops
    let y = 0;      // current y from top (we'll convert to PDF coords at render)

    const HEADER_H   = 78;
    const FOOTER_H   = 30;
    const TOP_START  = HEADER_H + 20; // y from top where content starts on page 1
    const PAGE_START = 30;            // y from top on subsequent pages
    const BOTTOM_MAX = H - FOOTER_H - 20;

    function startPage() {
      if (ops.length) pages.push(ops);
      ops = [];
      y = (pages.length === 0) ? TOP_START : PAGE_START;
    }

    function py(topY) { return H - topY; } // convert top-down y to PDF bottom-up y

    function ensureSpace(needed) {
      if (y + needed > BOTTOM_MAX) startPage();
    }

    function op(...lines) { ops.push(...lines); }

    function setFill(c)   { op(`${c} rg`); }
    function setStroke(c) { op(`${c} RG`); }
    function setLW(w)     { op(`${w} w`); }

    function drawRect(x, topY, w, h, fill, stroke) {
      op(`${x} ${py(topY + h)} ${w} ${h} re`);
      if (fill && stroke) op("B");
      else if (fill)  op("f");
      else if (stroke) op("S");
    }

    function drawLine(x1, y1, x2, y2) {
      op(`${x1} ${py(y1)} m ${x2} ${py(y2)} l S`);
    }

    function pdfStr(s) {
      return (s || "").replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\xFF]/g, "");
    }

    function drawText(str, x, topY, size, bold = false) {
      const font = bold ? "/F2" : "/F1";
      op(`BT ${font} ${size} Tf ${x} ${py(topY)} Td (${pdfStr(str)}) Tj ET`);
    }

    // ── Page 1 header ─────────────────────────────────────────────────────────
    startPage();

    // Navy bg
    setFill(C.navy);
    drawRect(0, 0, W, HEADER_H, true, false);

    // Teal bottom border on header
    setFill(C.teal);
    drawRect(0, HEADER_H, W, 2, true, false);

    // Logo mark (simplified)
    setFill(C.teal);
    op(`BT /F2 13 Tf ${ML} ${py(16)} Td (LEZAH CAPITAL) Tj ET`);
    setFill(C.muted);
    op(`BT /F1 7 Tf ${ML} ${py(30)} Td (A BUILDERS' FAMILY OFFICE) Tj ET`);

    // Company name
    setFill(C.white);
    const coName = (company || "").toUpperCase();
    op(`BT /F2 18 Tf ${ML} ${py(52)} Td (${pdfStr(coName)}) Tj ET`);

    // Sector badge
    if (sector) {
      setFill(C.teal);
      op(`BT /F1 7.5 Tf ${ML} ${py(68)} Td (${pdfStr(sector.toUpperCase())}) Tj ET`);
    }

    // Tagline
    y = HEADER_H + 14;
    setFill(C.gold);
    drawText(`INVESTMENT RESEARCH REPORT  .  CONSUMER / CPG  .  ${date}`, ML, y, 7.5);
    y += 10;

    // Teal rule
    setFill(C.teal);
    setStroke(C.teal);
    setLW(1);
    drawLine(ML, y, W - MR, y);
    y += 12;

    // ── Sections ──────────────────────────────────────────────────────────────
    const BODY_SIZE   = 8.5;
    const BODY_LH     = 12;   // line height
    const BLANK_LH    = 6;    // blank line height
    const SEC_HEAD_H  = 24;
    const SEC_PAD_T   = 8;
    const SEC_PAD_B   = 10;
    const SEC_GAP     = 10;
    const SEC_X       = ML;
    const SEC_W       = USABLE_W;
    const TEXT_X      = ML + 14;
    const TEXT_W      = USABLE_W - 20;

    for (const id of ORDER) {
      if (!results[id]) continue;
      const label = SECTION_LABELS[id] || id;
      const cleaned = cleanMarkdown(results[id]);
      const lineItems = wrapParagraph(cleaned, BODY_SIZE);

      // Calculate total section height
      let bodyH = 0;
      for (const li of lineItems) {
        bodyH += li.isBlank ? BLANK_LH : BODY_LH;
      }
      const totalH = SEC_HEAD_H + SEC_PAD_T + bodyH + SEC_PAD_B;

      // If section won't fit, start new page
      if (y + totalH > BOTTOM_MAX) {
        startPage();
      }

      const secTop = y;
      const secH   = totalH;

      // Section background card
      setFill(C.bg);
      setStroke(C.border);
      setLW(0.5);
      drawRect(SEC_X, secTop, SEC_W, secH, true, true);

      // Teal left accent bar
      setFill(C.teal);
      drawRect(SEC_X, secTop, 3, secH, true, false);

      // Header background strip
      setFill("0.973 0.976 0.980");
      drawRect(SEC_X + 3, secTop, SEC_W - 3, SEC_HEAD_H, true, false);

      // Section label
      setFill(C.teal);
      drawText(label.toUpperCase(), TEXT_X, secTop + 15, 8, true);

      // Divider under header
      setStroke(C.border);
      setLW(0.5);
      drawLine(SEC_X + 3, secTop + SEC_HEAD_H, SEC_X + SEC_W, secTop + SEC_HEAD_H);

      // Body text
      let ty = secTop + SEC_HEAD_H + SEC_PAD_T + BODY_LH;
      for (const li of lineItems) {
        if (li.isBlank) {
          ty += BLANK_LH;
          continue;
        }
        const indent = (li.isBullet || li.bulletCont) ? 10 : 0;
        if (li.isBullet) {
          setFill(C.teal);
          drawText("•", TEXT_X + 2, ty, BODY_SIZE, true);
        }
        setFill(C.body);
        drawText(li.text.replace(/^\s*•\s*/, ""), TEXT_X + indent, ty, BODY_SIZE);
        ty += BODY_LH;
      }

      y = secTop + secH + SEC_GAP;
    }

    // ── Sources ───────────────────────────────────────────────────────────────
    if (sources && sources.length) {
      ensureSpace(40 + sources.length * 20);

      setStroke(C.border);
      setLW(0.5);
      drawLine(ML, y, W - MR, y);
      y += 14;

      setFill(C.muted);
      drawText("SOURCES", ML, y, 8, true);
      y += 14;

      for (let i = 0; i < sources.length; i++) {
        const srcLine = `[${i+1}] ${sources[i].title}`;
        const urlLine = `     ${sources[i].url}`;
        ensureSpace(26);
        setFill(C.muted);
        drawText(srcLine, ML, y, 7.5);
        y += 11;
        setFill(C.teal);
        drawText(urlLine, ML, y, 7);
        y += 13;
      }
    }

    // Push last page
    if (ops.length) pages.push(ops);

    // ── Assemble PDF ──────────────────────────────────────────────────────────
    const totalPages = pages.length;
    const objects = [];
    let objNum = 1;

    function addObj(content) {
      objects.push({ num: objNum, content });
      return objNum++;
    }

    const f1 = addObj(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`);
    const f2 = addObj(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`);
    const resDict = `<< /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >>`;

    const pageObjNums = [];

    for (let pi = 0; pi < pages.length; pi++) {
      // Footer content
      const footerOps = [
        `${C.border} RG 0.5 w`,
        `${ML} ${py(H - FOOTER_H + 8)} m ${W - MR} ${py(H - FOOTER_H + 8)} l S`,
        `${C.muted} rg`,
        `BT /F1 7 Tf ${ML} ${py(H - FOOTER_H + 16)} Td (LEZAH CAPITAL  .  CONFIDENTIAL  .  FOR INTERNAL USE ONLY) Tj ET`,
        `BT /F1 7 Tf ${W - MR - 60} ${py(H - FOOTER_H + 16)} Td (${pdfStr(date)}) Tj ET`,
        `BT /F1 7 Tf ${W/2 - 10} ${py(H - FOOTER_H + 22)} Td (${pi+1} / ${totalPages}) Tj ET`,
      ].join("\n");

      const pageStream = pages[pi].join("\n");
      const combined = pageStream + "\n" + footerOps;

      const streamNum = addObj(`<< /Length ${Buffer.byteLength(combined)} >>\nstream\n${combined}\nendstream`);
      const pageNum = addObj(`<< /Type /Page /MediaBox [0 0 ${W} ${H}] /Contents ${streamNum} 0 R /Resources ${resDict} /Parent 9999 0 R >>`);
      pageObjNums.push(pageNum);
    }

    const pagesNum = addObj(`<< /Type /Pages /Kids [${pageObjNums.map(n=>`${n} 0 R`).join(" ")}] /Count ${totalPages} >>`);

    // Fix parent refs
    for (const n of pageObjNums) {
      objects[n-1].content = objects[n-1].content.replace("9999 0 R", `${pagesNum} 0 R`);
    }

    const catalogNum = addObj(`<< /Type /Catalog /Pages ${pagesNum} 0 R >>`);

    // Build final PDF string
    let pdf = "%PDF-1.4\n%\xFF\xFF\xFF\xFF\n";
    const offsets = [];

    for (const obj of objects) {
      offsets.push(Buffer.byteLength(pdf, "latin1"));
      pdf += `${obj.num} 0 obj\n${obj.content}\nendobj\n`;
    }

    const xrefStart = Buffer.byteLength(pdf, "latin1");
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const off of offsets) {
      pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogNum} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

    const pdfBuf = Buffer.from(pdf, "latin1");
    const safeName = (company || "Report").replace(/[^a-zA-Z0-9]/g, "_");

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}_Lezah_Research.pdf"`,
      },
      body: pdfBuf.toString("base64"),
      isBase64Encoded: true,
    };

  } catch(e) {
    console.error(e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message, stack: e.stack }) };
  }
};
