import fs from 'fs';
import path from 'path';
import express from 'express';
import puppeteer from 'puppeteer-core';

const app = express();
app.use(express.json({ limit: '20mb' }));

const PORT = process.env.PORT || 8080;

app.get('/', (_, res) => res.send('FIR PDF Service OK'));

app.post('/generate-fir-pdf', async (req, res) => {
  let browser;

  try {
    const data = req.body;
    const template = fs.readFileSync(
      path.join(process.cwd(), 'fir-template.html'),
      'utf8'
    );

    const inspectionTests = data.tests
      .map(t => `<p>${t.test}</p>`)
      .join('');

    const observations = data.tests
      .map(t => `<p>${t.observation}</p>`)
      .join('');

    const itemRows = data.items.map((item, i) => `
      <tr>
        <td class="center">${i + 1}</td>
        <td>${item.description}</td>
        <td class="center">${item.qtyOffered}</td>
        <td class="center">${item.qtyAccepted}</td>
        <td class="center">${item.qtyRejected || 'Nil'}</td>
        <td>${inspectionTests}</td>
        <td class="observations">${observations}</td>
      </tr>
    `).join('');

    const html = template
      .replace('{{LOGO_URL}}', data.logoUrl)
      .replace('{{clientName}}', data.clientName)
      .replace('{{vendorName}}', data.vendorName)
      .replace('{{subVendor}}', data.subVendor || '')
      .replace('{{projectName}}', data.projectName)
      .replace('{{firNumber}}', data.firNumber)
      .replace('{{poNumber}}', data.poNumber)
      .replace('{{itpNumber}}', data.itpNumber)
      .replace('{{inspectionDate}}', data.inspectionDate)
      .replace('{{approvedDrawings}}', data.approvedDrawings || '')
      .replace('{{finalResult}}', data.finalResult)
      .replace('{{inspectorName}}', data.inspectorName)
      .replace('{{inspectorStamp}}', data.inspectorStamp || '')
      .replace('{{ITEM_ROWS}}', itemRows);

    browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      headless: true,
      args: ['--no-sandbox']
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
    res.status(500).json({ message: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () =>
  console.log(`FIR PDF service running on ${PORT}`)
);
