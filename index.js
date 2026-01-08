import express from "express";
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer-core";

const app = express();
app.use(express.json({ limit: "25mb" }));

const PORT = process.env.PORT || 8080;

/* ===============================
   HEALTH CHECK (Railway needs this)
================================ */
app.get("/", (_req, res) => {
  res.status(200).send("FIR PDF Service OK");
});

/* ===============================
   PDF GENERATION
================================ */
app.post("/generate-fir-pdf", async (req, res) => {
  let browser;

  try {
    const fir = req.body;
    if (!fir) {
      return res.status(400).json({ message: "No FIR data received" });
    }

    /* ---------- Load HTML & CSS ---------- */
    const templatePath = path.join(process.cwd(), "templates", "fir.html");
    const cssPath = path.join(process.cwd(), "styles", "fir.css");

    let html = fs.readFileSync(templatePath, "utf8");
    const css = fs.readFileSync(cssPath, "utf8");

    /* ---------- Inject CSS ---------- */
    html = html.replace("</head>", `<style>${css}</style></head>`);

    /* ---------- Replace Header Fields ---------- */
    html = html
      .replace("{{clientName}}", fir.clientName || "")
      .replace("{{projectName}}", fir.projectName || "")
      .replace("{{vendorName}}", fir.vendorName || "")
      .replace("{{subVendor}}", fir.subVendor || "")
      .replace("{{firNumber}}", fir.firNumber || "")
      .replace("{{poNumber}}", fir.poNumber || "")
      .replace("{{itpNumber}}", fir.itpNumber || "")
      .replace("{{jobNumber}}", fir.jobNumber || "")
      .replace("{{inspectionDate}}", fir.dateOfInspection || "")
      .replace("{{finalResult}}", fir.finalResult || "")
      .replace("{{inspectorName}}", fir.inspectorName || "")
      .replace("{{inspectorDesignation}}", fir.inspectorDesignation || "")
      .replace("{{references}}", fir.references || "");

    /* ---------- Items Table ---------- */
    const itemsHtml = (fir.items || [])
      .map(
        (item, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${item.description || ""}</td>
          <td>${item.qtyOffered || ""}</td>
          <td>${item.qtyAccepted || ""}</td>
          <td>${item.qtyRejected || ""}</td>
        </tr>
      `
      )
      .join("");

    html = html.replace(/{{#items}}[\s\S]*?{{\/items}}/, itemsHtml);

    /* ---------- Tests Table ---------- */
    const testsHtml = (fir.tests || [])
      .map(
        (t) => `
        <tr>
          <td>${t.test || ""}</td>
          <td>${t.observation || ""}</td>
        </tr>
      `
      )
      .join("");

    html = html.replace(/{{#tests}}[\s\S]*?{{\/tests}}/, testsHtml);

    /* ---------- Launch Puppeteer ---------- */
    browser = await puppeteer.launch({
      headless: "new",
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdf = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      margin: {
        top: "10mm",
        bottom: "10mm",
        left: "8mm",
        right: "8mm",
      },
    });

    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'inline; filename="FIR.pdf"');
    res.send(pdf);
  } catch (err) {
    console.error("PDF ERROR:", err);

    if (browser) {
      try {
        await browser.close();
      } catch (_) {}
    }

    res.status(500).json({
      message: "PDF generation failed",
      details: err.message,
    });
  }
});

/* ===============================
   KEEP NODE ALIVE
================================ */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`FIR PDF service running on port ${PORT}`);
});
