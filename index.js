import express from "express";
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import handlebars from "handlebars";

const app = express();
app.use(express.json({ limit: "20mb" }));

// Health check
app.get("/health", (_, res) => {
  res.json({ ok: true });
});

// FIR PDF generation
app.post("/generate-fir-pdf", async (req, res) => {
  try {
    const data = req.body;

    const templateHtml = fs.readFileSync(
      path.join(process.cwd(), "fir-template.html"),
      "utf8"
    );

    const css = fs.readFileSync(
      path.join(process.cwd(), "fir-style.css"),
      "utf8"
    );

    const template = handlebars.compile(templateHtml);
    const html = template({ data, css });

    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdf = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      margin: {
        top: "8mm",
        bottom: "8mm",
        left: "8mm",
        right: "8mm"
      }
    });

    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=FIR.pdf");
    res.send(pdf);

  } catch (err) {
    console.error("FIR PDF ERROR:", err);
    res.status(500).json({
      message: "Failed to generate FIR PDF",
      error: err.message
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`FIR PDF service running on port ${PORT}`);
});
