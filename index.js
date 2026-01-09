import express from 'express';
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(express.json({ limit: '50mb' }));

const PORT = process.env.PORT || 8080;

/* HEALTH CHECK */
app.get('/', (_, res) => {
  res.send('FIR PDF Service OK');
});

app.post('/generate-fir-pdf', async (req, res) => {
  let browser;
  try {
    const data = req.body;

    const templatePath = path.join(process.cwd(), 'templates', 'fir-template.html');
    const cssPath = path.join(process.cwd(), 'styles', 'fir.css');

    let html = fs.readFileSync(templatePath, 'utf8');
    const css = fs.readFileSync(cssPath, 'utf8');

    /* ---------------- ITEMS ---------------- */
    const itemRows = data.items.map((item, i) => `
      <tr>
        <td class="sl">${String(i + 1).padStart(2, '0')}</td>
        <td class="desc">${item.description || ''}</td>
        <td class="qty">${item.qtyOffered || ''}</td>
        <td class="qty">${item.qtyAccepted || ''}</td>
        <td class="qty">${item.qtyRejected || 'Nil'}</td>
      </tr>
    `).join('');

    /* ---------------- TESTS ---------------- */
    const testsHtml = data.tests.map(t => `<div>${t.test}</div>`).join('');

    /* ---------------- OBSERVATIONS ---------------- */
    const obsHtml = data.tests.map(t => `<div>${t.observation}</div>`).join('');

    /* ---------------- REPLACE ---------------- */
    html = html
      .replace('{{CSS}}', `<style>${css}</style>`)
      .replace('{{CLIENT}}', data.clientName || '')
      .replace('{{VENDOR}}', data.vendorName || '')
      .replace('{{SUB_VENDOR}}', data.subVendor || '')
      .replace('{{FIR_NO}}', data.firNumber || '')
      .replace('{{PO_NO}}', data.poNumber || '')
      .replace('{{ITP_NO}}', data.itpNumber || '')
      .replace('{{DATE}}', data.dateOfInspection || '')
      .replace('{{PROJECT}}', data.projectName || '')
      .replace('{{ITEM_ROWS}}', itemRows)
      .replace('{{INSPECTION_TESTS}}', testsHtml)
      .replace('{{OBSERVATIONS}}', obsHtml)
      .replace('{{FINAL_RESULT}}', data.finalResult || '')
      .replace('{{INSPECTOR}}', data.inspectorName || '');

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
      printBackground: true
    });

    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.send(pdf);

  } catch (err) {
    if (browser) await browser.close();
    console.error(err);
    res.status(500).json({ message: 'PDF generation failed', error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`FIR PDF service running on port ${PORT}`);
});
