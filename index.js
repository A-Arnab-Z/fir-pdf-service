import express from 'express';
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(express.json({ limit: '20mb' }));

const PORT = process.env.PORT || 8080;

/* ===============================
   HEALTH CHECK
   =============================== */
app.get('/', (_, res) => {
  res.send('FIR PDF Service OK');
});

/* ===============================
   PDF GENERATION
   =============================== */
app.post('/generate-fir-pdf', async (req, res) => {
  let browser;

  try {
    const fir = req.body;
    if (!fir) {
      return res.status(400).json({ message: 'No FIR data received' });
    }

    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();

    /* ===============================
       HTML TEMPLATE (STANDARD FIR)
       =============================== */
    const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<title>FINAL INSPECTION REPORT</title>

<style>
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11px;
    margin: 0;
  }

  .page {
    padding: 10mm;
  }

  table {
    border-collapse: collapse;
    width: 100%;
  }

  td, th {
    border: 1px solid #000;
    padding: 4px;
    vertical-align: top;
  }

  .header {
    border: 2px solid #000;
    margin-bottom: 4px;
  }

  .logo {
    width: 80px;
    text-align: center;
  }

  .logo img {
    max-width: 70px;
  }

  .company {
    text-align: center;
  }

  .company-name {
    color: #003399;
    font-size: 14px;
    font-weight: bold;
  }

  .report-title {
    color: #003399;
    font-weight: bold;
    text-align: center;
    width: 200px;
  }

  .meta, .footer {
    border: 2px solid #000;
    margin-bottom: 4px;
  }

  .main td {
    vertical-align: top;
  }

  .items th, .tests th {
    background: #f2f2f2;
  }

  .signature {
    text-align: center;
    vertical-align: bottom;
    height: 60px;
  }
</style>
</head>

<body>
<div class="page">

<!-- HEADER -->
<table class="header">
<tr>
  <td class="logo">
    <img src="https://ik.imagekit.io/v5ur9vgig/SKSL%20New%20Logo_BG%20RM.png?updatedAt=1766121272133" />
  </td>
  <td class="company">
    <div class="company-name">S. K. SAMANTA & CO. (P) LTD.</div>
    Suite 4A, 2/5, Sarat Bose Road, 4th Floor, Kolkata - 700020
  </td>
  <td class="report-title">FINAL INSPECTION REPORT</td>
</tr>
</table>

<!-- META -->
<table class="meta">
<tr><td><b>Client</b></td><td>${fir.clientName || ''}</td><td><b>FIR No</b></td><td>${fir.firNumber || ''}</td></tr>
<tr><td><b>Vendor</b></td><td>${fir.vendorName || ''}</td><td><b>PO No</b></td><td>${fir.poNumber || ''}</td></tr>
<tr><td><b>Sub Vendor</b></td><td>${fir.subVendor || ''}</td><td><b>ITP No</b></td><td>${fir.itpNumber || ''}</td></tr>
<tr><td><b>Date of Inspection</b></td><td>${fir.dateOfInspection || ''}</td><td><b>Job No</b></td><td>${fir.jobNumber || ''}</td></tr>
</table>

<!-- MAIN -->
<table class="main">
<tr>
<td width="65%">
<table class="items">
<tr><th>Sl</th><th>Item Description<br/><small>Drg No / Spec</small></th><th>Offered</th><th>Accepted</th><th>Rejected</th></tr>
${(fir.items || []).map((i, idx) => `
<tr>
<td>${idx + 1}</td>
<td>${i.description || ''}</td>
<td>${i.qtyOffered || ''}</td>
<td>${i.qtyAccepted || ''}</td>
<td>${i.qtyRejected || ''}</td>
</tr>`).join('')}
</table>
</td>

<td width="35%">
<table class="tests">
<tr><th>Inspection / Tests Conducted</th><th>Observations</th></tr>
${(fir.tests || []).map(t => `
<tr>
<td>${t.test}</td>
<td>${t.observation}</td>
</tr>`).join('')}
</table>
</td>
</tr>
</table>

<!-- FOOTER -->
<table class="footer">
<tr>
<td width="40%"><b>References:</b><br/>${fir.references || ''}</td>
<td width="30%"><b>Final Result:</b><br/>${fir.finalResult || ''}</td>
<td width="30%" class="signature">
${fir.inspectorName || ''}<br/>
<small>${fir.inspectorDesignation || ''}</small>
</td>
</tr>
</table>

</div>
</body>
</html>
`;

    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true
    });

    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="FIR.pdf"');
    res.send(pdf);

  } catch (err) {
    console.error(err);
    if (browser) await browser.close();
    res.status(500).json({ message: 'PDF generation failed', details: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`FIR PDF service running on port ${PORT}`);
});
