import express from "express";
import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

const app = express();
app.use(express.json({ limit: "20mb" }));

const PORT = process.env.PORT || 8080;

/* HEALTH CHECK */
app.get("/", (_, res) => {
  res.send("FIR PDF Service Running");
});

/* PDF GENERATION */
app.post("/generate-fir-pdf", async (req, res) => {
  try {
    const data = req.body;

    const templatePath = path.resolve(
      process.cwd(),
      "templates",
      "fir-template.html"
    );

    const cssPath = path.resolve(
      process.cwd(),
      "styles",
      "fir.css"
    );

    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template not found: ${templatePath}`);
    }

    let html = fs.readFileSync(templatePath, "utf8");
    const css = fs.readFileSync(cssPath, "utf8");

    /* Inject CSS */
    html = html.replace("{{STYLE}}", `<style>${css}</style>`);

    /* HEADER DATA */
    html = html
      .replace("{{CLIENT}}", data.clientName || "")
      .replace("{{VENDOR}}", data.vendorName || "")
      .replace("{{SUB_VENDOR}}", data.subVendor || "")
      .replace("{{FIR_NO}}", data.firNumber || "")
      .replace("{{PO_NO}}", data.poNumber || "")
      .replace("{{ITP_NO}}", data.itpNumber || "")
      .replace("{{PROJECT}}", data.projectName || "")
      .replace("{{DATE}}", data.dateOfInspection || "")
      .replace("{{INSPECTOR}}", data.inspectorName || "");

    /* ITEMS TABLE */
    const itemRows = data.items.map((item, i) => `
      <tr>
        <td>${String(i + 1).padStart(2, "0")}</td>
        <td>
          ${item.description}<br/>
          <small>${item.drgSpec || ""}</small>
        </td>
        <td>${item.qtyOffered}</td>
        <td>${item.qtyAccepted}</td>
        <td>${item.qtyRejected || "Nil"}</td>
        <td class="tests">
          Visual<br/>
          Fitment of Roller to Bracket<br/>
          Dimensional<br/>
          Friction Factor and TIR<br/>
          Water Ingression Test<br/>
          Dust Ingression Test<br/>
          Shore Hardness<br/>
          Review of Documents<br/>
          Painting
        </td>
        <td class="observations">
          ${data.tests.map((t, i) => `${i + 1}. ${t.observation}`).join("<br/>")}
        </td>
      </tr>
    `).join("");

    html = html.replace("{{ITEM_ROWS}}", itemRows);

    html = html.replace("{{REMARKS}}", data.finalRemarks || "ACCEPTED");

    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdf = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
    });

    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.send(pdf);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "PDF generation failed",
      error: err.message,
    });
  }
});

app.listen(PORT, "0.0.0.0", () =>
  console.log(`FIR PDF service running on port ${PORT}`)
);
