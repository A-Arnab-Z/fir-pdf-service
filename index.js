import express from "express";
import puppeteer from "puppeteer-core";

const app = express();
app.use(express.json({ limit: "25mb" }));

const PORT = process.env.PORT || 8080;

/* ===============================
   HEALTH CHECK (REQUIRED)
================================ */
app.get("/", (_, res) => {
  res.status(200).send("FIR PDF Service OK");
});

/* ===============================
   PDF GENERATION
================================ */
app.post("/generate-fir-pdf", async (req, res) => {
  let browser;

  try {
    const fir = req.body;
    if (!fir) return res.status(400).json({ message: "No FIR data received" });

    browser = await puppeteer.launch({
      headless: "new",
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu"
      ],
    });

    const page = await browser.newPage();

    /* ===============================
       FIR STANDARD HTML TEMPLATE
    ================================ */
    const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11px;
    margin: 20px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  td, th {
    border: 1px solid #000;
    padding: 4px;
    vertical-align: top;
  }

  .no-border {
    border: none !important;
  }

  .center { text-align: center; }
  .right { text-align: right; }
  .bold { font-weight: bold; }

  .title {
    font-size: 14px;
    font-weight: bold;
    color: #003399;
  }

  .subtitle {
    font-size: 10px;
  }

  .section-title {
    font-weight: bold;
    background: #f0f0f0;
  }

  img.logo {
    width: 70px;
  }
</style>
</head>

<body>

<!-- ================= HEADER ================= -->
<table>
  <tr>
    <td class="center no-border" style="width:15%">
      <img class="logo" src="https://ik.imagekit.io/v5ur9vgig/SKSL%20New%20Logo_BG%20RM.png" />
    </td>
    <td class="center no-border" style="width:55%">
      <div class="title">S. K. SAMANTA & CO. (P) LTD.</div>
      <div class="subtitle">
        Suite 4A, 2/5, Sarat Bose Road, 4th Floor, Kolkata - 700020
      </div>
    </td>
    <td class="center no-border title" style="width:30%">
      FINAL INSPECTION REPORT
    </td>
  </tr>
</table>

<!-- ================= META ================= -->
<table>
<tr>
  <td class="bold">Client</td><td>${fir.clientName || ""}</td>
  <td class="bold">FIR No</td><td>${fir.firNumber || ""}</td>
</tr>
<tr>
  <td class="bold">Vendor</td><td>${fir.vendorName || ""}</td>
  <td class="bold">PO No</td><td>${fir.poNumber || ""}</td>
</tr>
<tr>
  <td class="bold">Sub Vendor</td><td>${fir.subVendor || ""}</td>
  <td class="bold">ITP No</td><td>${fir.itpNumber || ""}</td>
</tr>
<tr>
  <td class="bold">Date of Inspection</td><td>${fir.dateOfInspection || ""}</td>
  <td class="bold">Job No</td><td>${fir.jobNumber || ""}</td>
</tr>
</table>

<!-- ================= MAIN ITEMS ================= -->
<table>
<tr class="section-title center">
  <td>Sl No</td>
  <td>Item Description<br/>Drg No / Spec</td>
  <td>Offered</td>
  <td>Accepted</td>
  <td>Rejected</td>
</tr>

${(fir.items || []).map((item, i) => `
<tr>
  <td class="center">${i + 1}</td>
  <td>${item.description || ""}</td>
  <td class="center">${item.qtyOffered ?? ""}</td>
  <td class="center">${item.qtyAccepted ?? ""}</td>
  <td class="center">${item.qtyRejected ?? ""}</td>
</tr>
`).join("")}

</table>

<!-- ================= INSPECTION / OBS ================= -->
<table>
<tr class="section-title center">
  <td style="width:35%">Inspection / Tests Conducted</td>
  <td>Observations</td>
</tr>

${(fir.tests || []).map(t => `
<tr>
  <td>${t.test}</td>
  <td>${t.observation}</td>
</tr>
`).join("")}

</table>

<!-- ================= FOOTER ================= -->
<table>
<tr>
  <td style="width:40%">
    <span class="bold">References:</span><br/>
    ${fir.references || ""}
  </td>
  <td class="center bold" style="width:30%">
    Final Result:<br/>
    ${fir.finalResult || ""}
  </td>
  <td class="center" style="width:30%">
    ${fir.inspectorName || ""}<br/>
    ${fir.inspectorDesignation || ""}
  </td>
</tr>
</table>

</body>
</html>
`;

    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdf = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" }
    });

    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=FIR.pdf");
    res.send(pdf);

  } catch (err) {
    console.error("PDF ERROR:", err);
    if (browser) await browser.close();
    res.status(500).json({ message: "PDF generation failed", details: err.message });
  }
});

/* ===============================
   START SERVER
================================ */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`FIR PDF service running on port ${PORT}`);
});
