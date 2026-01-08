import express from "express";
import puppeteer from "puppeteer-core";

const app = express();
app.use(express.json({ limit: "30mb" }));

const PORT = process.env.PORT || 8080;

/* ===============================
   HEALTH CHECK
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
    if (!fir) {
      return res.status(400).json({ message: "No FIR data received" });
    }

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

    /* ===============================
       STANDARD FIR HTML (EXCEL MATCH)
    ================================ */
    const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
@page {
  size: A4 landscape;
  margin: 12mm;
}

body {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 8.5pt;
  color: #000;
}

.outer {
  border: 2px solid #000;
  padding: 3px;
}

.inner {
  border: 1px solid #000;
  padding: 3px;
}

table {
  width: 100%;
  border-collapse: collapse;
}

td, th {
  border: 1px solid #000;
  padding: 3px 4px;
  vertical-align: top;
}

.no-border {
  border: none !important;
}

.center { text-align: center; }
.right { text-align: right; }
.bold { font-weight: bold; }

.header-title {
  font-size: 15pt;
  font-weight: bold;
}

.header-sub {
  font-size: 9pt;
}

.section-head {
  font-weight: bold;
  text-align: center;
}

.logo {
  width: 65px;
}

.small {
  font-size: 7.5pt;
}
</style>
</head>

<body>

<div class="outer">
<div class="inner">

<!-- ================= HEADER ================= -->
<table>
<tr>
  <td style="width:8%" class="center no-border">
    <img class="logo" src="https://ik.imagekit.io/v5ur9vgig/SKSL%20New%20Logo_BG%20RM.png">
  </td>
  <td style="width:72%" class="center no-border">
    <div class="header-title">S. K. SAMANTA & CO. (P) LTD.</div>
    <div class="header-sub">
      Suite 4A, 2/5, Sarat Bose Road, 4th Floor, Kolkata - 700020
    </div>
  </td>
  <td style="width:20%" class="center header-title no-border">
    FINAL INSPECTION REPORT
  </td>
</tr>
</table>

<!-- ================= INFO GRID ================= -->
<table>
<tr>
  <td class="bold">CLIENT</td>
  <td>${fir.clientName || ""}</td>
  <td class="bold">FIR No.</td>
  <td>${fir.firNumber || ""}</td>
</tr>
<tr>
  <td class="bold">VENDOR</td>
  <td>${fir.vendorName || ""}</td>
  <td class="bold">PO No.</td>
  <td>${fir.poNumber || ""}</td>
</tr>
<tr>
  <td class="bold">SUB-VENDOR</td>
  <td>${fir.subVendor || ""}</td>
  <td class="bold">ITP No.</td>
  <td>${fir.itpNumber || ""}</td>
</tr>
<tr>
  <td class="bold">DATE OF INSPECTION</td>
  <td>${fir.dateOfInspection || ""}</td>
  <td class="bold">JOB No.</td>
  <td>${fir.jobNumber || ""}</td>
</tr>
</table>

<!-- ================= MAIN TABLE ================= -->
<table>
<tr class="section-head">
  <td style="width:3%">Sl</td>
  <td style="width:28%">ITEM DESCRIPTION<br>Drg No./Spec</td>
  <td style="width:6%">Offered</td>
  <td style="width:6%">Accepted</td>
  <td style="width:6%">Rejected</td>
  <td style="width:8%">Inspection Tests Conducted</td>
  <td style="width:2%"></td>
  <td style="width:41%">OBSERVATIONS</td>
</tr>

${(fir.items || []).map((item, i) => `
<tr>
  <td class="center">${String(i + 1).padStart(2, "0")}</td>
  <td>${item.description || ""}</td>
  <td class="center">${item.qtyOffered || ""}</td>
  <td class="center">${item.qtyAccepted || ""}</td>
  <td class="center">${item.qtyRejected || "Nil"}</td>
  <td class="center">1–9</td>
  <td></td>
  <td>
    ${(fir.tests || []).map(
      (t, idx) => `${idx + 1}. ${t.observation}`
    ).join("<br>")}
  </td>
</tr>
`).join("")}
</table>

<!-- ================= FOOTER ================= -->
<table>
<tr>
  <td style="width:40%" class="small">
    <b>SKSL Approved Drg. No.:</b><br>
    ${fir.references || ""}
  </td>
  <td style="width:30%" class="center bold">
    Remarks: ${fir.finalResult || ""}
  </td>
  <td style="width:30%" class="center">
    <br><br>
    <b>${fir.inspectorName || ""}</b><br>
    ${fir.inspectorDesignation || "INSPECTOR & QA/QC"}
  </td>
</tr>
<tr>
  <td colspan="3" class="center small">VENDOR / SUB-VENDOR</td>
</tr>
</table>

</div>
</div>

</body>
</html>
`;

    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdf = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
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
