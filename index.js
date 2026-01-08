import express from 'express';
import puppeteer from 'puppeteer-core';



const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 8080;

/* Health check (VERY IMPORTANT for Railway) */
app.get('/', (req, res) => {
  res.status(200).send('FIR PDF Service OK');
});

app.post('/generate-fir-pdf', async (req, res) => {
  try {
    const browser = await puppeteer.launch({
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu'
  ],
});


    const page = await browser.newPage();

    await page.setContent(`
      <html>
        <body>
          <h1>FIR PDF TEST</h1>
        </body>
      </html>
    `);

    const pdf = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
    });

    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.send(pdf);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'PDF generation failed' });
  }
});

/* THIS LINE IS WHAT KEEPS NODE ALIVE */
app.listen(PORT, '0.0.0.0', () => {
  console.log(`FIR PDF service running on port ${PORT}`);
});
