import express from "express";
import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const app = express();
app.use(express.json({ limit: "20mb" }));

const PORT = process.env.PORT || 8080;

/* Health check */
app.get("/", (_, res) => {
  res.send("FIR PDF Service OK");
});

app.post("/generate-fir-pdf", async (req, res) => {
  let browser;
  try {
    const fir = req.body;

    // Load HTML template
    const templatePath = path.join(process.cwd(), "templates", "fir.html");
    let html = fs.readFileSync(templatePath, "utf8");

    // Replace placeholders
    html = html
      .replace(/{{CLIENT_NAME}}/g, fir.clientName || "")
      .replace(/{{PROJECT_NAME}}/g, fir.projectName || "")
      .replace(/{{VENDOR_NAME}}/g, fir.vendorName || "")
      .replace(/{{FIR_NO}}/g, fir.firNumber || "")
      .replace(/{{DATE_OF_INSPECTION}}/g, fir.dateOfInspection || "")
      .replace(/{{PO_NO}}/g, fir.poNumber || "")
      .replace(/{{ITP_NO}}/g, fir.itpNumber || "")
      .replace(/{{FINAL_RESULT}}/g, fir.finalResult || "")
      .replace(/{{INSPECTOR_NAME}}/g, fir.inspectorName || "")
      .replace(/{{DRAWING_REFS}}/g, fir.approvedDrawings || "");

    // Items rows
    const itemsHtml = (fir.items || [])
      .map((item, i) => `
<tr>
  <td class="center">${String(i + 1).padStart(2, "0")}</td>
  <td>${item.description}</td>
  <td class="center">${item.qtyOffered}</td>
  <td class="center">${item.qtyAccepted}</td>
  <td class="center">${item.qtyRejected || "Nil"}</td>
  <td class="center">1–9</td>
  <td>
    ${(fir.tests || [])
      .map((t, idx) => `<div>${idx + 1}. ${t.observation}</div>`)
      .join("")}
  </td>
</tr>
`)
      .join("");

    html = html.replace("{{ITEM_ROWS}}", itemsHtml);

    browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdf = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
    });

    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.send(pdf);
  } catch (err) {
    if (browser) await browser.close();
    res.status(500).json({ message: "PDF generation failed", error: err.message });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`FIR PDF service running on port ${PORT}`);
});
