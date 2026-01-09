import express from "express";
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";

const app = express();
app.use(express.json({ limit: "20mb" }));

const PORT = process.env.PORT || 8080;
const __dirname = new URL(".", import.meta.url).pathname;

app.get("/", (_, res) => {
  res.send("FIR PDF Service OK");
});

app.post("/generate-fir-pdf", async (req, res) => {
  try {
    const data = req.body;

    const htmlPath = path.join(__dirname, "templates", "fir-template.html");
    const cssPath = path.join(__dirname, "styles", "fir.css");

    if (!fs.existsSync(htmlPath)) {
      throw new Error("HTML template missing");
    }

    let html = fs.readFileSync(htmlPath, "utf8");
    const css = fs.readFileSync(cssPath, "utf8");

    // HEADER DATA
    const map = {
      "{{CLIENT}}": data.clientName || "",
      "{{VENDOR}}": data.vendorName || "",
      "{{SUB_VENDOR}}": data.subVendor || "",
      "{{FIR_NO}}": data.firNumber || "",
      "{{PO_NO}}": data.poNumber || "",
      "{{ITP_NO}}": data.itpNumber || "",
      "{{PROJECT}}": data.projectName || "",
      "{{DATE_INSPECTION}}": data.dateOfInspection || "",
      "{{INSPECTOR}}": data.inspectorName || "",
      "{{REMARKS}}": data.finalRemarks || "ACCEPTED"
    };

    for (const key in map) {
      html = html.replaceAll(key, map[key]);
    }

    // ITEMS TABLE (NO REPEAT)
    const rows = data.items.map((item, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${item.description}</td>
        <td>${item.qtyOffered}</td>
        <td>${item.qtyAccepted}</td>
        <td>${item.qtyRejected || "Nil"}</td>
        <td>${data.tests.map(t => t.name).join("<br>")}</td>
        <td>${data.tests.map(t => t.observation).join("<br>")}</td>
      </tr>
    `).join("");

    html = html.replace("{{ITEM_ROWS}}", rows);
    html = html.replace("{{INLINE_CSS}}", `<style>${css}</style>`);

    const browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdf = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true
    });

    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.send(pdf);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`FIR PDF service running on port ${PORT}`);
});
