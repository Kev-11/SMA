Run OCR proxy server (optional, recommended for scanned PDFs):

```bash
npm run start-server
```
The server listens on port `3001` by default. The frontend will POST files to `/api/ocr` on the same origin; if you run the frontend and server separately, proxy or adjust the endpoint accordingly.

Using OCR.space
- The server forwards uploads to OCR.space. By default it uses the demo key `helloworld` which is rate-limited. To use your own key, set the environment variable `OCR_SPACE_API_KEY` before starting the server:

# Social Media Content Analyzer (MVP)

This is a minimal MVP to extract text from PDFs and images and provide basic engagement suggestions.

Features
- Drag-and-drop or file picker for PDFs and images
- PDF parsing using `pdfjs-dist`
- Image OCR using `tesseract.js` (runs in-browser) or serverless OCR via OCR.space
- Loading states and basic error handling

Quick start (local development)
1. Install dependencies:

```bash
npm install
```

2. Run dev server (frontend):

```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

Serverless OCR (Vercel)

This project includes a serverless function at `api/ocr.js` that forwards uploads to OCR.space. Deploying to Vercel lets you run OCR in a serverless environment without a separate server.

1. Commit and push this repository to GitHub.
2. Go to https://vercel.com and import the repository.
3. In your Vercel project settings add an environment variable `OCR_SPACE_API_KEY` with your OCR.space API key. If you don't provide one, the demo key `helloworld` will be used but it is rate-limited.
4. Vercel will build the frontend (Vite) and deploy the `api/` serverless functions automatically.

Direct local serverless testing
- You can use `vercel dev` (Vercel CLI) to run serverless functions locally if you prefer not to use the remote API during development.

How to push to GitHub and deploy
1. Initialize git and make the initial commit (if you haven't already):

```cmd
git init
git add .
git commit -m "Initial commit - Social Media Content Analyzer"
```

2. Create a new repository on GitHub (via the website) and follow the instructions to add a remote, e.g.: 

```cmd
git remote add origin https://github.com/<your-username>/<repo-name>.git
git branch -M main
git push -u origin main
```

3. In Vercel: import the repository, set `OCR_SPACE_API_KEY` in Environment Variables, and deploy.

Notes and recommendations
- The serverless function calls OCR.space and therefore uploads files to that third-party service. If you need fully local OCR, consider deploying a dedicated server with Tesseract installed and update the frontend to POST to that server.
- If OCR.space responses are slow or exceed serverless time limits, consider batching or using a different OCR provider.

200-word approach (short):
This MVP provides an in-browser pipeline to let users upload PDFs or image scans and quickly get extracted text plus simple engagement suggestions. The app uses `pdfjs-dist` to parse PDF pages and assemble readable text; for scanned pages it can perform OCR in-browser with `tesseract.js` or forward files to a serverless OCR proxy (OCR.space). Dynamic imports keep the initial bundle small and only load heavy libraries when needed. After extraction, a lightweight suggestions module checks word count, CTA presence, and hashtag/mention usage to produce quick actionable tips. Error handling and loading states improve UX; the extracted text is editable so users can refine before copying. For production, a server-side OCR with native Tesseract is recommended to handle very large files and to avoid client memory/time limits.
