import express from 'express';
import puppeteer from 'puppeteer-core';

const app = express();

/* Allow large FIR payloads */
app.use(express.json({ limit: '25mb' }));

const PORT = process.env.PORT || 8080;
const CHROME_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium';

/* ===============================
   HEALTH CHECK (REQUIRED)
   =============================== */
app.get('/', (_, res) => {
  res.status(200).send('FIR PDF Service OK');
});

/* ===============================
   PDF GENERATION ENDPOINT
   =============================== */
app.post('/generate-fir-pdf', async (req, res) => {
  let browser;

  try {
    const fir = req.body;

    if (!fir || Object.keys(fir).length === 0) {
      return res.status(400).json({ message: 'Empty FIR payload received' });
    }

    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process'
      ]
    });

    const page = await browser.newPage();

    const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>FINAL INSPECTION REPORT</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; margin: 20px; }
  h1 { text-align: center; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { border: 1px solid #000; padding: 6px; vertical-align: top; }
  th { background: #f0f0f0; }
</style>
</head>
<body>

<h1>FINAL INSPECTION REPORT</h1>

<p><b>Client:</b> ${fir.clientName || ''}</p>
<p><b>Project:</b> ${fir.projectName || ''}</p>
<p><b>Vendor:</b> ${fir.vendorName || ''}</p>
<p><b>FIR No:</b> ${fir.firNumber || ''}</p>
<p><b>Date:</b> ${fir.firDate || ''}</p>

<h3>Main Inspection Items</h3>
<table>
<tr>
  <th>Sl</th>
  <th>Description</th>
  <th>Offered</th>
  <th>Accepted</th>
  <th>Rejected</th>
</tr>
${(fir.items || []).map((i, idx) => `
<tr>
  <td>${idx + 1}</td>
  <td>${i.description || ''}</td>
  <td>${i.qtyOffered || ''}</td>
  <td>${i.qtyAccepted || ''}</td>
  <td>${i.qtyRejected || ''}</td>
</tr>`).join('')}
</table>

<h3>Inspection / Tests & Observations</h3>
<table>
<tr><th>Test</th><th>Observation</th></tr>
${(fir.tests || []).map(t => `
<tr>
  <td>${t.test || ''}</td>
  <td>${t.observation || ''}</td>
</tr>`).join('')}
</table>

<h3>Final Result</h3>
<p>${fir.finalResult || ''}</p>
<p>${fir.finalRemarks || ''}</p>

<p><b>Inspector:</b> ${fir.inspectorName || ''}</p>

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
    console.error('PDF ERROR:', err);
    if (browser) await browser.close().catch(() => {});
    res.status(500).json({ message: 'PDF generation failed', details: err.message });
  }
});

/* ===============================
   KEEP CONTAINER ALIVE
   =============================== */
app.listen(PORT, '0.0.0.0', () => {
  console.log(`FIR PDF service running on port ${PORT}`);
});
