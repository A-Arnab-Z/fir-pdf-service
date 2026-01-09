import express from 'express';
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(express.json({ limit: '20mb' }));

const PORT = process.env.PORT || 8080;

/* ===============================
   HEALTH CHECK
================================ */
app.get('/', (_, res) => {
  res.send('FIR PDF Service OK');
});

/* ===============================
   PDF GENERATION
================================ */
app.post('/generate-fir-pdf', async (req, res) => {
  let browser;

  try {
    const data = req.body;
    if (!data) {
      return res.status(400).json({ message: 'No FIR data received' });
    }

    /* ---- PATHS (MATCH YOUR REPO) ---- */
    const templatePath = path.join(process.cwd(), 'templates', 'fir.html');
    const cssPath = path.join(process.cwd(), 'styles', 'fir.css');

    if (!fs.existsSync(templatePath)) {
      throw new Error(`HTML template not found: ${templatePath}`);
    }
    if (!fs.existsSync(cssPath)) {
      throw new Error(`CSS file not found: ${cssPath}`);
    }

    let html = fs.readFileSync(templatePath, 'utf8');
    const css = fs.readFileSync(cssPath, 'utf8');

    /* ---- INLINE CSS (REQUIRED FOR PUPPETEER) ---- */
    html = html.replace('</head>', `<style>${css}</style></head>`);

    /* ---- DATA INJECTION ---- */
    html = html
      .replace('{{CLIENT_NAME}}', data.clientName || '')
      .replace('{{VENDOR_NAME}}', data.vendorName || '')
      .replace('{{SUB_VENDOR}}', data.subVendor || '')
      .replace('{{FIR_NO}}', data.firNumber || '')
      .replace('{{PO_NO}}', data.poNumber || '')
      .replace('{{ITP_NO}}', data.itpNumber || '')
      .replace('{{JOB_NO}}', data.jobNumber || '')
      .replace('{{PROJECT_NAME}}', data.projectName || '')
      .replace('{{INSPECTION_DATE}}', data.dateOfInspection || '')
      .replace('{{INSPECTOR_NAME}}', data.inspectorName || '');

    /* ---- ITEMS TABLE ---- */
    const itemRows = (data.items || []).map((item, i) => `
      <tr>
        <td>${String(i + 1).padStart(2, '0')}</td>
        <td>${item.description}</td>
        <td>${item.qtyOffered}</td>
        <td>${item.qtyAccepted}</td>
        <td>${item.qtyRejected || 'Nil'}</td>
        <td>${(data.tests || []).map(t => t.test).join('<br>')}</td>
        <td>${(data.tests || []).map(t => t.observation).join('<br>')}</td>
      </tr>
    `).join('');

    html = html.replace('{{ITEM_ROWS}}', itemRows);

    /* ---- PUPPETEER ---- */
    browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' }
    });

    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="FIR.pdf"');
    res.send(pdf);

  } catch (err) {
    if (browser) await browser.close();
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () =>
  console.log(`FIR PDF service running on port ${PORT}`)
);
