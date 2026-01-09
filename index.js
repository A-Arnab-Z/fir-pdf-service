import express from "express";
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer-core";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "20mb" }));

const PORT = process.env.PORT || 8080;
const CHROME_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium";

/* =========================
   HEALTH CHECK
========================= */
app.get("/", (_, res) => {
  res.send("FIR PDF Service OK");
});

/* =========================
   PDF GENERATION
========================= */
app.post("/generate-fir-pdf", async (req, res) => {
  let browser;

  try {
    const data = req.body;

    const templatePath = path.join(__dirname, "templates", "fir-template.html");
    const cssPath = path.join(__dirname, "styles", "fir.css");

    if (!fs.existsSync(templatePath)) {
      throw new Error("HTML template missing");
    }

    let html = fs.readFileSync(templatePath, "utf-8");
    const css = fs.readFileSync(cssPath, "utf-8");

    /* ---------- DATA BINDING ---------- */
    html = html
      .replace("{{CSS}}", `<style>${css}</style>`)
      .replace("{{CLIENT_NAME}}", data.clientName || "")
      .replace("{{VENDOR_NAME}}", data.vendorName || "")
      .replace("{{SUB_VENDOR}}", data.subVendor || "")
      .replace("{{FIR_NO}}", data.firNumber || "")
      .replace("{{PO_NO}}", data.poNumber || "")
      .replace("{{ITP_NO}}", data.itpNumber || "")
      .replace("{{JOB_NO}}", data.jobNumber || "")
      .replace("{{PROJECT}}", data.projectName || "")
      .replace("{{DATE_OF_INSPECTION}}", data.dateOfInspection || "")
      .replace("{{FINAL_RESULT}}", data.finalResult || "ACCEPTED")
      .replace("{{INSPECTOR_NAME}}", data.inspectorName || "");

    /* ---------- ITEMS TABLE ---------- */
    const itemsHtml = (data.items || []).map((item, i) => `
      <tr>
        <td>${String(i + 1).padStart(2, "0")}</td>
        <td>${item.description}</td>
        <td>${item.qtyOffered}</td>
        <td>${item.qtyAccepted}</td>
        <td>${item.qtyRejected || "Nil"}</td>
        <td>${data.tests.map(t => t.test).join("<br>")}</td>
        <td>${data.tests.map(t => t.observation).join("<br>")}</td>
      </tr>
    `).join("");

    html = html.replace("{{ITEM_ROWS}}", itemsHtml);

    /* ---------- PUPPETEER ---------- */
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdf = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" }
    });

    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.send(pdf);

  } catch (err) {
    console.error(err);
    if (browser) await browser.close();
    res.status(500).json({ message: err.message });
  }
});

/* ========================= */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`FIR PDF service running on port ${PORT}`);
});
