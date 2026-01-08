import express from 'express';
import puppeteer from 'puppeteer';

const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 8080;

app.get('/health', (req, res) => {
  res.send('OK');
});

app.post('/generate-fir-pdf', async (req, res) => {
  try {
    const firData = req.body;

    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    // TEMP placeholder HTML (replace with your real template)
    await page.setContent(`
      <html>
        <body>
          <h1>FIR PDF Test</h1>
          <pre>${JSON.stringify(firData, null, 2)}</pre>
        </body>
      </html>
    `, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
    });

    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="FIR.pdf"');
    res.send(pdf);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'PDF generation failed' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`FIR PDF service running on port ${PORT}`);
});
