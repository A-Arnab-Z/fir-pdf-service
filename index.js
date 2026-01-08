import express from 'express';
import puppeteer from 'puppeteer-core';

const app = express();
app.use(express.json({ limit: '20mb' }));

const PORT = process.env.PORT || 8080;

/* Health check */
app.get('/', (_, res) => {
  res.send('FIR PDF Service OK');
});

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

    await page.setContent(`
      <html>
        <body>
          <h1>FINAL INSPECTION REPORT</h1>
          <p>Client: ${fir.clientName || ''}</p>
        </body>
      </html>
    `);

    const pdf = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true
    });

    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.send(pdf);

  } catch (err) {
    console.error('PDF ERROR:', err);
    if (browser) await browser.close();
    res.status(500).json({ message: 'PDF generation failed' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`FIR PDF service running on port ${PORT}`);
});
