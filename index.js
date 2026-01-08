import express from "express";
import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json({ limit: "10mb" }));

app.post("/generate-fir-pdf", async (req, res) => {
  try {
    const data = req.body;

    const htmlTemplate = fs.readFileSync("./templates/fir.html", "utf8");
    const css = fs.readFileSync("./styles/fir.css", "utf8");

    const finalHtml = htmlTemplate
      .replace("{{CSS}}", `<style>${css}</style>`)
      .replace("{{DATA}}", JSON.stringify(data));

    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();
    await page.setContent(finalHtml, { waitUntil: "networkidle0" });

    const pdf = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      margin: {
        top: "10mm",
        bottom: "10mm",
        left: "10mm",
        right: "10mm"
      }
    });

    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=FIR.pdf");
    res.send(pdf);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "PDF generation failed", error: err.message });
  }
});

app.get("/", (_, res) => {
  res.send("FIR PDF Service is running");
});

app.listen(PORT, () => {
  console.log(`FIR PDF service running on port ${PORT}`);
});
