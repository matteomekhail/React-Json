# React Image to Documents Generator

A simple React app that downloads an image from the internet and automatically generates a PDF and Excel file with the embedded image.

## Features

- 🖼️ Download random images from the internet
- 📄 Generate PDF with embedded image
- 📊 Generate Excel with embedded image
- 💾 Direct download of generated files
- 🎨 Modern and intuitive interface

## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm run install-all
```

## Usage

1. Start the application:
```bash
npm start
```

2. Open your browser at `http://localhost:3000`

3. Click "Generate Documents" to:
   - Download a random image
   - Generate a PDF with the image
   - Generate an Excel with the image
   - Download all generated files

## Technologies Used

### Frontend
- React 18
- Axios for HTTP requests
- Modern CSS with gradients

### Backend
- Node.js with Express
- Sharp for image manipulation
- jsPDF for PDF generation
- ExcelJS for Excel generation
- Axios for image downloading

## Project Structure

```
├── client/                 # React Frontend
│   ├── public/
│   ├── src/
│   │   ├── App.js
│   │   ├── App.css
│   │   ├── index.js
│   │   └── index.css
│   └── package.json
├── server/                 # Node.js Backend
│   ├── index.js
│   └── downloads/          # Generated files
├── package.json
└── README.md
```

## API Endpoints

- `POST /api/generate-documents` - Generate PDF and Excel with image
- `GET /api/download/:filename` - Download generated files
- `GET /downloads/:filename` - Static access to files

## Notes

- The app uses random images from Picsum (https://picsum.photos/)
- Files are saved in the `server/downloads/` folder
- Generated documents include the embedded image, not just the link 