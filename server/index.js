const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');
const { jsPDF } = require('jspdf');
const ExcelJS = require('exceljs');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/downloads', express.static(path.join(__dirname, 'downloads')));

// Ensure downloads directory exists
const downloadsDir = path.join(__dirname, 'downloads');
fs.ensureDirSync(downloadsDir);

// Helper function to download and process image
async function downloadAndProcessImage(randomSeed = null) {
  const seed = randomSeed || Math.random();
  const imageUrl = `https://picsum.photos/200/150?random=${seed}`;
  
  const response = await axios({
    method: 'GET',
    url: imageUrl,
    responseType: 'arraybuffer'
  });
  
  const imageBuffer = Buffer.from(response.data);
  const processedImage = await sharp(imageBuffer)
    .jpeg({ quality: 80 })
    .toBuffer();
    
  return processedImage;
}

// Endpoint to generate PDF from JSON with random images for steps
app.post('/api/generate-pdf-from-json', async (req, res) => {
  try {
    console.log('Starting PDF generation from JSON...');
    
    // Read the JSON file
    const jsonPath = path.join(__dirname, '..', 'Convert Excel to JSON Apr 7 2025.json');
    const jsonData = await fs.readJSON(jsonPath);
    
    console.log(`Found ${jsonData.length} records in JSON`);
    
    // Download and prepare a single image to reuse
    let reusableImageData = null;
    try {
      console.log('Downloading single image for PDF reuse...');
      const imageBuffer = await downloadAndProcessImage();
      const base64Image = imageBuffer.toString('base64');
      reusableImageData = `data:image/jpeg;base64,${base64Image}`;
      console.log('Single image prepared for PDF reuse');
    } catch (imageError) {
      console.error('Error preparing reusable image for PDF:', imageError);
    }
    
    // Create PDF
    const pdf = new jsPDF();
    let yPosition = 20;
    let pageNumber = 1;
    
    // Group records by CASE KEY to organize test cases
    const groupedData = {};
    jsonData.forEach(record => {
      if (record['CASE KEY'] && record['CASE KEY'].trim() !== '') {
        if (!groupedData[record['CASE KEY']]) {
          groupedData[record['CASE KEY']] = [];
        }
        groupedData[record['CASE KEY']].push(record);
      }
    });
    
    // Process each test case
    for (const [caseKey, records] of Object.entries(groupedData)) {
      // Check if we need a new page
      if (yPosition > 250) {
        pdf.addPage();
        pageNumber++;
        yPosition = 20;
      }
      
      // Add test case header
      pdf.setFontSize(16);
      pdf.setFont(undefined, 'bold');
      pdf.text(`Test Case: ${caseKey}`, 20, yPosition);
      yPosition += 10;
      
      // Add test case details
      const mainRecord = records.find(r => r.HEADLINE) || records[0];
      if (mainRecord) {
        pdf.setFontSize(12);
        pdf.setFont(undefined, 'normal');
        
        if (mainRecord.HEADLINE) {
          pdf.text(`Headline: ${mainRecord.HEADLINE}`, 20, yPosition);
          yPosition += 8;
        }
        
        if (mainRecord.DESCRIPTION) {
          const description = mainRecord.DESCRIPTION.length > 80 ? 
            mainRecord.DESCRIPTION.substring(0, 80) + '...' : mainRecord.DESCRIPTION;
          pdf.text(`Description: ${description}`, 20, yPosition);
          yPosition += 8;
        }
        
        if (mainRecord.PRIORITY) {
          pdf.text(`Priority: ${mainRecord.PRIORITY}`, 20, yPosition);
          yPosition += 8;
        }
      }
      
      yPosition += 5;
      
      // Process steps
      const steps = records.filter(r => r['STEP ID'] && r['STEP ID'] !== '');
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        
        // Check if we need a new page
        if (yPosition > 200) {
          pdf.addPage();
          pageNumber++;
          yPosition = 20;
        }
        
        // Add step header
        pdf.setFontSize(11);
        pdf.setFont(undefined, 'bold');
        pdf.text(`Step ${step['STEP ID']}:`, 20, yPosition);
        yPosition += 6;
        
        // Add step content
        pdf.setFontSize(10);
        pdf.setFont(undefined, 'normal');
        
        if (step.STEP) {
          const stepText = step.STEP.length > 100 ? 
            step.STEP.substring(0, 100) + '...' : step.STEP;
          pdf.text(`Action: ${stepText}`, 25, yPosition);
          yPosition += 6;
        }
        
        if (step['TEST DATA']) {
          pdf.text(`Test Data: ${step['TEST DATA']}`, 25, yPosition);
          yPosition += 6;
        }
        
        if (step['EXPECTED RESULT']) {
          pdf.text(`Expected Result: ${step['EXPECTED RESULT']}`, 25, yPosition);
          yPosition += 6;
        }
        
        // Add reusable image for step
        if (reusableImageData) {
          try {
            // Add image to the right side of the page
            const imageWidth = 60;
            const imageHeight = 45;
            pdf.addImage(reusableImageData, 'JPEG', 130, yPosition - 15, imageWidth, imageHeight);
            
            yPosition += 50; // Space for image
          } catch (imageError) {
            console.error('Error adding reusable image for step:', imageError);
            yPosition += 10;
          }
        } else {
          yPosition += 10;
        }
        
        yPosition += 5; // Space between steps
      }
      
      yPosition += 10; // Space between test cases
    }
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `test-cases-with-images-${timestamp}.pdf`;
    const filePath = path.join(downloadsDir, filename);
    
    // Save the PDF
    pdf.save(filePath);
    
    console.log(`PDF file generated: ${filename}`);
    
    // Send the file for download
    res.download(filePath, filename, (err) => {
      if (err) {
        console.error('Error downloading file:', err);
        res.status(500).json({ error: 'Error downloading file' });
      } else {
        // Clean up the file after download
        setTimeout(() => {
          fs.remove(filePath).catch(console.error);
        }, 5000);
      }
    });
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ error: 'Error generating PDF file' });
  }
});

// Endpoint to generate Excel from JSON with random images
app.post('/api/generate-excel-from-json', async (req, res) => {
  try {
    console.log('Starting Excel generation from JSON...');
    
    // Read the JSON file
    const jsonPath = path.join(__dirname, '..', 'Convert Excel to JSON Apr 7 2025.json');
    const jsonData = await fs.readJSON(jsonPath);
    
    console.log(`Found ${jsonData.length} records in JSON`);
    
    // Create a new workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Test Cases');
    
    // Define headers
    const headers = Object.keys(jsonData[0]);
    worksheet.addRow(headers);
    
    // Style the header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    
    // Set column widths
    headers.forEach((header, index) => {
      worksheet.getColumn(index + 1).width = 25;
    });
    
    // Download and prepare a single image to reuse
    let imageId = null;
    
    try {
      console.log('Downloading single image to reuse...');
      
      // Download one image
      const imageUrl = `https://picsum.photos/100/80?random=${Math.random()}`;
      const imageResponse = await axios({
        method: 'GET',
        url: imageUrl,
        responseType: 'arraybuffer'
      });
      
      const imageBuffer = Buffer.from(imageResponse.data);
      const tempImagePath = path.join(downloadsDir, 'temp-reusable-image.jpg');
      await fs.writeFile(tempImagePath, imageBuffer);
      
      // Resize image to be smaller
      const resizedImageBuffer = await sharp(tempImagePath)
        .resize(70, 50)
        .jpeg({ quality: 80 })
        .toBuffer();
      
      // Add the image once to workbook
      imageId = workbook.addImage({
        buffer: resizedImageBuffer,
        extension: 'jpeg',
      });
      
      // Clean up temp file
      await fs.remove(tempImagePath);
      
      console.log('Single image prepared for reuse');
      
    } catch (imageError) {
      console.error('Error preparing reusable image:', imageError);
    }
    
    // Add data rows with images for steps
    let currentRow = 2;
    for (const record of jsonData) {
      const row = worksheet.addRow(Object.values(record));
      
      // Check if this row has a STEP field with content and we have images
      const stepColumnIndex = headers.indexOf('STEP') + 1;
      if (record.STEP && record.STEP.trim() !== '' && imageId) {
        try {
          console.log(`Adding images for step: ${record.STEP}`);
          
          // Set larger row height to accommodate both text and two images
          row.height = 220;
          
          // Modify the text to add line breaks for space for two images
          const stepCell = worksheet.getCell(currentRow, stepColumnIndex);
          const originalText = record.STEP;
          // Add more line breaks to create space for two images
          const textWithSpace = originalText + '\n\n\n\n\n\n\n\n\n\n\n';
          stepCell.value = textWithSpace;
          stepCell.alignment = { 
            vertical: 'top', 
            horizontal: 'left', 
            wrapText: true 
          };
          
          // Position first image in the middle of the cell
          worksheet.addImage(imageId, {
            tl: { 
              col: stepColumnIndex - 1, 
              row: currentRow - 1,
              colOff: 10,
              rowOff: 90  // Position first image
            },
            ext: { width: 70, height: 50 }
          });
          
          // Position second image well below the first one (same image ID)
          worksheet.addImage(imageId, {
            tl: { 
              col: stepColumnIndex - 1, 
              row: currentRow - 1,
              colOff: 10,
              rowOff: 160  // Position second image with more space
            },
            ext: { width: 70, height: 50 }
          });
          
        } catch (imageError) {
          console.error('Error adding images:', imageError);
          // Continue without images if there's an error
        }
      }
      
      currentRow++;
    }
    
    // Apply borders to all cells
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `test-cases-with-images-${timestamp}.xlsx`;
    const filePath = path.join(downloadsDir, filename);
    
    // Save the workbook
    await workbook.xlsx.writeFile(filePath);
    
    console.log(`Excel file generated: ${filename}`);
    
    // Send the file for download
    res.download(filePath, filename, (err) => {
      if (err) {
        console.error('Error downloading file:', err);
        res.status(500).json({ error: 'Error downloading file' });
      } else {
        // Clean up the file after download
        setTimeout(() => {
          fs.remove(filePath).catch(console.error);
        }, 5000);
      }
    });
    
  } catch (error) {
    console.error('Error generating Excel:', error);
    res.status(500).json({ error: 'Error generating Excel file' });
  }
});

// Endpoint to generate PDF from JSON via HTML (with CSS styling)
app.post('/api/generate-pdf-from-json-html', async (req, res) => {
  try {
    console.log('Starting PDF generation from JSON via HTML...');
    
    // Read the JSON file
    const jsonPath = path.join(__dirname, '..', 'Convert Excel to JSON Apr 7 2025.json');
    const jsonData = await fs.readJSON(jsonPath);
    
    console.log(`Found ${jsonData.length} records in JSON`);
    
    // Download and prepare a single image to reuse
    let reusableImageBase64 = null;
    try {
      console.log('Downloading single image for HTML reuse...');
      const imageBuffer = await downloadAndProcessImage();
      reusableImageBase64 = imageBuffer.toString('base64');
      console.log('Single image prepared for HTML reuse');
    } catch (imageError) {
      console.error('Error preparing reusable image for HTML:', imageError);
    }
    
    // Group records by CASE KEY to organize test cases
    const groupedData = {};
    jsonData.forEach(record => {
      if (record['CASE KEY'] && record['CASE KEY'].trim() !== '') {
        if (!groupedData[record['CASE KEY']]) {
          groupedData[record['CASE KEY']] = [];
        }
        groupedData[record['CASE KEY']].push(record);
      }
    });
    
    // Generate HTML content with CSS styling
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Cases Report</title>
    <style>
        body {
            font-family: 'Times New Roman', serif;
            margin: 0;
            padding: 30px;
            background-color: white;
            color: #000;
            line-height: 1.4;
            font-size: 12px;
        }
        
        .container {
            max-width: 210mm;
            margin: 0 auto;
            background-color: white;
        }
        
        .header {
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 2px solid #000;
        }
        
        .header h1 {
            color: #000;
            margin: 0;
            font-size: 24px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 2px;
        }
        
        .header p {
            color: #333;
            margin: 15px 0 0 0;
            font-size: 14px;
            font-style: italic;
        }
        
        .test-case {
            margin-bottom: 40px;
            page-break-inside: avoid;
        }
        
        .test-case-header {
            background-color: #f5f5f5;
            border: 2px solid #000;
            padding: 15px;
            font-size: 16px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 0;
        }
        
        .test-case-details {
            border: 1px solid #000;
            border-top: none;
            margin-bottom: 20px;
        }
        
        .details-table {
            width: 100%;
            border-collapse: collapse;
            margin: 0;
        }
        
        .details-table td {
            padding: 12px;
            border: 1px solid #000;
            vertical-align: top;
        }
        
        .details-table .label {
            font-weight: bold;
            background-color: #f0f0f0;
            width: 150px;
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 0.5px;
        }
        
        .details-table .value {
            background-color: white;
        }
        
        .priority {
            font-weight: bold;
            padding: 4px 8px;
            border: 1px solid #000;
            background-color: #f0f0f0;
            text-transform: uppercase;
            font-size: 10px;
            letter-spacing: 0.5px;
        }
        
        .steps-title {
            font-size: 14px;
            font-weight: bold;
            margin: 20px 0 10px 0;
            text-transform: uppercase;
            letter-spacing: 1px;
            border-bottom: 1px solid #000;
            padding-bottom: 5px;
        }
        
        .steps-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        
        .steps-table th {
            background-color: #000;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 0.5px;
            border: 1px solid #000;
        }
        
        .steps-table td {
            padding: 15px;
            border: 1px solid #000;
            vertical-align: top;
            background-color: white;
        }
        
        .steps-table tr:nth-child(even) td {
            background-color: #f9f9f9;
        }
        
        .step-number {
            font-weight: bold;
            font-size: 14px;
            text-align: center;
            width: 50px;
            background-color: #e0e0e0;
        }
        
        .step-action {
            font-weight: bold;
            margin-bottom: 8px;
            font-size: 12px;
        }
        
        .step-data, .step-expected {
            margin-bottom: 8px;
            padding: 8px;
            border: 1px solid #ccc;
            font-size: 11px;
            background-color: #f9f9f9;
        }
        
        .step-data strong, .step-expected strong {
            text-transform: uppercase;
            font-size: 10px;
            letter-spacing: 0.5px;
        }
        
        .step-image {
            width: 100px;
            height: 75px;
            border: 2px solid #000;
            object-fit: cover;
            display: block;
            margin: 5px auto;
        }
        
        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #000;
            font-size: 11px;
            font-style: italic;
        }
        
        .summary-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }
        
        .summary-table td {
            padding: 8px;
            border: 1px solid #000;
            text-align: center;
            font-weight: bold;
            background-color: #f0f0f0;
        }
        
        @media print {
            body {
                padding: 20px;
            }
            
            .test-case {
                page-break-inside: avoid;
                margin-bottom: 30px;
            }
            
            .steps-table {
                page-break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Test Cases Report</h1>
            <p>Generated on ${new Date().toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</p>
        </div>
        
        ${Object.entries(groupedData).map(([caseKey, records]) => {
          const mainRecord = records.find(r => r.HEADLINE) || records[0];
          const steps = records.filter(r => r['STEP ID'] && r['STEP ID'] !== '');
          
          return `
            <div class="test-case">
                <div class="test-case-header">
                    Test Case: ${caseKey}
                </div>
                
                ${mainRecord ? `
                <div class="test-case-details">
                    <table class="details-table">
                        ${mainRecord.HEADLINE ? `
                        <tr>
                            <td class="label">Test Case Title</td>
                            <td class="value">${mainRecord.HEADLINE}</td>
                        </tr>
                        ` : ''}
                        
                        ${mainRecord.DESCRIPTION ? `
                        <tr>
                            <td class="label">Description</td>
                            <td class="value">${mainRecord.DESCRIPTION}</td>
                        </tr>
                        ` : ''}
                        
                        ${mainRecord.PRIORITY ? `
                        <tr>
                            <td class="label">Priority</td>
                            <td class="value">
                                <span class="priority">${mainRecord.PRIORITY}</span>
                            </td>
                        </tr>
                        ` : ''}
                    </table>
                </div>
                ` : ''}
                
                ${steps.length > 0 ? `
                <div class="steps-title">Test Steps</div>
                <table class="steps-table">
                    <thead>
                        <tr>
                            <th style="width: 50px;">Step</th>
                            <th style="width: 40%;">Action</th>
                            <th style="width: 25%;">Test Data</th>
                            <th style="width: 25%;">Expected Result</th>
                            <th style="width: 120px;">Screenshot</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${steps.map(step => `
                        <tr>
                            <td class="step-number">${step['STEP ID']}</td>
                            <td>
                                ${step.STEP ? `
                                <div class="step-action">${step.STEP}</div>
                                ` : ''}
                            </td>
                            <td>
                                ${step['TEST DATA'] ? `
                                <div class="step-data">
                                    <strong>Data:</strong><br>
                                    ${step['TEST DATA']}
                                </div>
                                ` : '-'}
                            </td>
                            <td>
                                ${step['EXPECTED RESULT'] ? `
                                <div class="step-expected">
                                    <strong>Expected:</strong><br>
                                    ${step['EXPECTED RESULT']}
                                </div>
                                ` : '-'}
                            </td>
                            <td style="text-align: center;">
                                ${reusableImageBase64 ? `
                                <img src="data:image/jpeg;base64,${reusableImageBase64}" 
                                     alt="Step ${step['STEP ID']}" 
                                     class="step-image">
                                ` : '-'}
                            </td>
                        </tr>
                        `).join('')}
                    </tbody>
                </table>
                ` : ''}
            </div>
          `;
        }).join('')}
        
        <div class="footer">
            <p><strong>Test Cases Summary</strong></p>
            <table class="summary-table">
                <tr>
                    <td>Total Test Cases</td>
                    <td>Total Steps</td>
                    <td>Generated Date</td>
                </tr>
                <tr>
                    <td>${Object.keys(groupedData).length}</td>
                    <td>${jsonData.filter(r => r['STEP ID'] && r['STEP ID'] !== '').length}</td>
                    <td>${new Date().toLocaleDateString('en-US')}</td>
                </tr>
            </table>
        </div>
    </div>
</body>
</html>
    `;
    
    // Launch Puppeteer and generate PDF
    console.log('Launching Puppeteer to generate PDF...');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `test-cases-styled-${timestamp}.pdf`;
    const filePath = path.join(downloadsDir, filename);
    
    // Generate PDF with custom options
    await page.pdf({
      path: filePath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      }
    });
    
    await browser.close();
    
    console.log(`Styled PDF file generated: ${filename}`);
    
    // Send the file for download
    res.download(filePath, filename, (err) => {
      if (err) {
        console.error('Error downloading file:', err);
        res.status(500).json({ error: 'Error downloading file' });
      } else {
        // Clean up the file after download
        setTimeout(() => {
          fs.remove(filePath).catch(console.error);
        }, 5000);
      }
    });
    
  } catch (error) {
    console.error('Error generating styled PDF:', error);
    res.status(500).json({ error: 'Error generating styled PDF file' });
  }
});

// Endpoint to generate PDF from JSON via HTML (with different images for each step)
app.post('/api/generate-pdf-from-json-html-unique', async (req, res) => {
  try {
    console.log('Starting PDF generation from JSON via HTML with unique images...');
    
    // Read the JSON file
    const jsonPath = path.join(__dirname, '..', 'Convert Excel to JSON Apr 7 2025.json');
    const jsonData = await fs.readJSON(jsonPath);
    
    console.log(`Found ${jsonData.length} records in JSON`);
    
    // Group records by CASE KEY to organize test cases
    const groupedData = {};
    jsonData.forEach(record => {
      if (record['CASE KEY'] && record['CASE KEY'].trim() !== '') {
        if (!groupedData[record['CASE KEY']]) {
          groupedData[record['CASE KEY']] = [];
        }
        groupedData[record['CASE KEY']].push(record);
      }
    });
    
    // Prepare unique images for each step
    const stepImages = {};
    let imageCounter = 0;
    
    for (const [caseKey, records] of Object.entries(groupedData)) {
      const steps = records.filter(r => r['STEP ID'] && r['STEP ID'] !== '');
      for (const step of steps) {
        try {
          console.log(`Downloading unique image for step ${step['STEP ID']}...`);
          const imageBuffer = await downloadAndProcessImage(Math.random() + imageCounter);
          stepImages[`${caseKey}-${step['STEP ID']}`] = imageBuffer.toString('base64');
          imageCounter++;
        } catch (imageError) {
          console.error(`Error preparing image for step ${step['STEP ID']}:`, imageError);
        }
      }
    }
    
    console.log(`Prepared ${Object.keys(stepImages).length} unique images`);
    
    // Generate HTML content with CSS styling (same as previous endpoint)
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Cases Report - Unique Images</title>
    <style>
        body {
            font-family: 'Times New Roman', serif;
            margin: 0;
            padding: 30px;
            background-color: white;
            color: #000;
            line-height: 1.4;
            font-size: 12px;
        }
        
        .container {
            max-width: 210mm;
            margin: 0 auto;
            background-color: white;
        }
        
        .header {
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 2px solid #000;
        }
        
        .header h1 {
            color: #000;
            margin: 0;
            font-size: 24px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 2px;
        }
        
        .header p {
            color: #333;
            margin: 15px 0 0 0;
            font-size: 14px;
            font-style: italic;
        }
        
        .test-case {
            margin-bottom: 40px;
            page-break-inside: avoid;
        }
        
        .test-case-header {
            background-color: #f5f5f5;
            border: 2px solid #000;
            padding: 15px;
            font-size: 16px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 0;
        }
        
        .test-case-details {
            border: 1px solid #000;
            border-top: none;
            margin-bottom: 20px;
        }
        
        .details-table {
            width: 100%;
            border-collapse: collapse;
            margin: 0;
        }
        
        .details-table td {
            padding: 12px;
            border: 1px solid #000;
            vertical-align: top;
        }
        
        .details-table .label {
            font-weight: bold;
            background-color: #f0f0f0;
            width: 150px;
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 0.5px;
        }
        
        .details-table .value {
            background-color: white;
        }
        
        .priority {
            font-weight: bold;
            padding: 4px 8px;
            border: 1px solid #000;
            background-color: #f0f0f0;
            text-transform: uppercase;
            font-size: 10px;
            letter-spacing: 0.5px;
        }
        
        .steps-title {
            font-size: 14px;
            font-weight: bold;
            margin: 20px 0 10px 0;
            text-transform: uppercase;
            letter-spacing: 1px;
            border-bottom: 1px solid #000;
            padding-bottom: 5px;
        }
        
        .steps-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        
        .steps-table th {
            background-color: #000;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 0.5px;
            border: 1px solid #000;
        }
        
        .steps-table td {
            padding: 15px;
            border: 1px solid #000;
            vertical-align: top;
            background-color: white;
        }
        
        .steps-table tr:nth-child(even) td {
            background-color: #f9f9f9;
        }
        
        .step-number {
            font-weight: bold;
            font-size: 14px;
            text-align: center;
            width: 50px;
            background-color: #e0e0e0;
        }
        
        .step-action {
            font-weight: bold;
            margin-bottom: 8px;
            font-size: 12px;
        }
        
        .step-data, .step-expected {
            margin-bottom: 8px;
            padding: 8px;
            border: 1px solid #ccc;
            font-size: 11px;
            background-color: #f9f9f9;
        }
        
        .step-data strong, .step-expected strong {
            text-transform: uppercase;
            font-size: 10px;
            letter-spacing: 0.5px;
        }
        
        .step-image {
            width: 100px;
            height: 75px;
            border: 2px solid #000;
            object-fit: cover;
            display: block;
            margin: 5px auto;
        }
        
        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #000;
            font-size: 11px;
            font-style: italic;
        }
        
        .summary-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }
        
        .summary-table td {
            padding: 8px;
            border: 1px solid #000;
            text-align: center;
            font-weight: bold;
            background-color: #f0f0f0;
        }
        
        @media print {
            body {
                padding: 20px;
            }
            
            .test-case {
                page-break-inside: avoid;
                margin-bottom: 30px;
            }
            
            .steps-table {
                page-break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Test Cases Report - Unique Images</h1>
            <p>Generated on ${new Date().toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</p>
        </div>
        
        ${Object.entries(groupedData).map(([caseKey, records]) => {
          const mainRecord = records.find(r => r.HEADLINE) || records[0];
          const steps = records.filter(r => r['STEP ID'] && r['STEP ID'] !== '');
          
          return `
            <div class="test-case">
                <div class="test-case-header">
                    Test Case: ${caseKey}
                </div>
                
                ${mainRecord ? `
                <div class="test-case-details">
                    <table class="details-table">
                        ${mainRecord.HEADLINE ? `
                        <tr>
                            <td class="label">Test Case Title</td>
                            <td class="value">${mainRecord.HEADLINE}</td>
                        </tr>
                        ` : ''}
                        
                        ${mainRecord.DESCRIPTION ? `
                        <tr>
                            <td class="label">Description</td>
                            <td class="value">${mainRecord.DESCRIPTION}</td>
                        </tr>
                        ` : ''}
                        
                        ${mainRecord.PRIORITY ? `
                        <tr>
                            <td class="label">Priority</td>
                            <td class="value">
                                <span class="priority">${mainRecord.PRIORITY}</span>
                            </td>
                        </tr>
                        ` : ''}
                    </table>
                </div>
                ` : ''}
                
                ${steps.length > 0 ? `
                <div class="steps-title">Test Steps</div>
                <table class="steps-table">
                    <thead>
                        <tr>
                            <th style="width: 50px;">Step</th>
                            <th style="width: 40%;">Action</th>
                            <th style="width: 25%;">Test Data</th>
                            <th style="width: 25%;">Expected Result</th>
                            <th style="width: 120px;">Screenshot</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${steps.map(step => {
                          const imageKey = `${caseKey}-${step['STEP ID']}`;
                          const uniqueImage = stepImages[imageKey];
                          
                          return `
                        <tr>
                            <td class="step-number">${step['STEP ID']}</td>
                            <td>
                                ${step.STEP ? `
                                <div class="step-action">${step.STEP}</div>
                                ` : ''}
                            </td>
                            <td>
                                ${step['TEST DATA'] ? `
                                <div class="step-data">
                                    <strong>Data:</strong><br>
                                    ${step['TEST DATA']}
                                </div>
                                ` : '-'}
                            </td>
                            <td>
                                ${step['EXPECTED RESULT'] ? `
                                <div class="step-expected">
                                    <strong>Expected:</strong><br>
                                    ${step['EXPECTED RESULT']}
                                </div>
                                ` : '-'}
                            </td>
                            <td style="text-align: center;">
                                ${uniqueImage ? `
                                <img src="data:image/jpeg;base64,${uniqueImage}" 
                                     alt="Step ${step['STEP ID']}" 
                                     class="step-image">
                                ` : '-'}
                            </td>
                        </tr>
                        `;
                        }).join('')}
                    </tbody>
                </table>
                ` : ''}
            </div>
          `;
        }).join('')}
        
        <div class="footer">
            <p><strong>Test Cases Summary</strong></p>
            <table class="summary-table">
                <tr>
                    <td>Total Test Cases</td>
                    <td>Total Steps</td>
                    <td>Generated Date</td>
                </tr>
                <tr>
                    <td>${Object.keys(groupedData).length}</td>
                    <td>${jsonData.filter(r => r['STEP ID'] && r['STEP ID'] !== '').length}</td>
                    <td>${new Date().toLocaleDateString('en-US')}</td>
                </tr>
            </table>
        </div>
    </div>
</body>
</html>
    `;
    
    // Launch Puppeteer and generate PDF
    console.log('Launching Puppeteer to generate PDF with unique images...');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `test-cases-unique-images-${timestamp}.pdf`;
    const filePath = path.join(downloadsDir, filename);
    
    // Generate PDF with custom options
    await page.pdf({
      path: filePath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      }
    });
    
    await browser.close();
    
    console.log(`Styled PDF with unique images generated: ${filename}`);
    
    // Send the file for download
    res.download(filePath, filename, (err) => {
      if (err) {
        console.error('Error downloading file:', err);
        res.status(500).json({ error: 'Error downloading file' });
      } else {
        // Clean up the file after download
        setTimeout(() => {
          fs.remove(filePath).catch(console.error);
        }, 5000);
      }
    });
    
  } catch (error) {
    console.error('Error generating styled PDF with unique images:', error);
    res.status(500).json({ error: 'Error generating styled PDF with unique images' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 