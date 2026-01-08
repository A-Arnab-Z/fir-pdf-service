import express from 'express';
import puppeteer from 'puppeteer-core';

const app = express();

/* Allow large FIR payloads */
app.use(express.json({ limit: '20mb' }));

const PORT = process.env.PORT || 8080;

/* =====================================================
   HEALTH CHECK (REQUIRED FOR RAILWAY)
   ===================================================== */
app.get('/', (req, res) => {
  res.status(200).send('FIR PDF Service OK');
});

/* =====================================================
   PDF GENERATION ENDPOINT
   ===================================================== */
app.post('/generate-fir-pdf', async (req, res) => {
  let browser;

  try {
    const fir = req.body;

    /* Validate input */
    if (!fir || Object.keys(fir).length === 0) {
      return res.status(400).json({
        message: 'No FIR data received'
      });
    }

    /* Log once for debugging (safe) */
    console.log('FIR RECEIVED');

    /* Launch Chromium */
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

    /* Prevent timeout issues */
    await page.setDefaultNavigationTimeout(0);
    await page.setViewport({ width: 1280, height: 900 });

    /* =====================================================
       BASIC FIR HTML (SAFE PLACEHOLDER)
       Pixel-perfect layout will replace this later
       ===================================================== */
    const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>FINAL INSPECTION REPORT</title>
<style>
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12px;
    margin: 20px;
  }

  h1 {
    text-align: center;
    margin-bottom: 12px;
  }

  h3 {
    margin-top: 18px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 8px;
  }

  th, td {
    border: 1px solid #000;
    padding: 6px;
    vertical-align: top;
  }

  th {
    background: #f0f0f0;
    text-align: left;
  }
</style>
</head>
<body>

<h1>FINAL INSPECTION REPORT</h1>

<p><strong>Client Name:</strong> ${fir.clientName || ''}</p>
<p><strong>Project Name:</strong> ${fir.projectName || ''}</p>
<p><strong>Vendor Name:</strong> ${fir.vendorName || ''}</p>
<p><strong>FIR Number:</strong> ${fir.firNumber || ''}</p>
<p><strong>FIR Date:</strong> ${fir.firDate || ''}</p>
<p><strong>Date of Inspection:</strong> ${fir.dateOfInspection || ''}</p>

<h3>Main Inspection Items</h3>
<table>
<tr>
  <th>Sl No</th>
  <th>Item Description</th>
  <th>Qty Offered</th>
  <th>Qty Accepted</th>
  <th>Qty Rejected</th>
</tr>
${(fir.items || []).map((item, i) => `
<tr>
  <td>${i + 1}</td>
  <td>${item.description || ''}</td>
  <td>${item.qtyOffered || ''}</td>
  <td>${item.qtyAccepted || ''}</td>
  <td>${item.qtyRejected || ''}</td>
</tr>
`).join('')}
</table>

<h3>Inspection / Tests Conducted & Observations</h3>
<table>
<tr>
  <th>Inspection / Test Conducted</th>
  <th>Observation</th>
</tr>
${(fir.tests || []).map(t => `
<tr>
  <td>${t.test || ''}</td>
  <td>${t.observation || ''}</td>
</tr>
`).join('')}
</table>

<h3>Final Result</h3>
<p><strong>Overall Result:</strong> ${fir.finalResult || ''}</p>
<p><strong>Final Remarks:</strong> ${fir.finalRemarks || ''}</p>

<h3>Inspection Engineer</h3>
<p><strong>Name:</strong> ${fir.inspectorName || ''}</p>
<p><strong>Designation:</strong> ${fir.inspectorDesignation || ''}</p>

</body>
</html>
`;

    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true
    });

    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="FIR.pdf"');
    res.send(pdfBuffer);

  } catch (error) {
    console.error('PDF ERROR:', error);

    if (browser) {
      try { await browser.close(); } catch (_) {}
    }

    res.status(500).json({
      message: 'PDF generation failed',
      details: error.message
    });
  }
});

/* =====================================================
   KEEP SERVER ALIVE (CRITICAL)
   ===================================================== */
app.listen(PORT, '0.0.0.0', () => {
  console.log(`FIR PDF service running on port ${PORT}`);
});
