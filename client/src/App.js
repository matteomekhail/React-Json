import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [excelLoading, setExcelLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [styledPdfLoading, setStyledPdfLoading] = useState(false);
  const [uniquePdfLoading, setUniquePdfLoading] = useState(false);
  const [error, setError] = useState('');

  const generateExcelFromJson = async () => {
    setExcelLoading(true);
    setError('');

    try {
      const response = await axios.post('/api/generate-excel-from-json', {}, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `test-cases-with-images-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
    } catch (err) {
      setError(err.response?.data?.message || 'Error generating Excel file');
    } finally {
      setExcelLoading(false);
    }
  };

  const generatePdfFromJson = async () => {
    setPdfLoading(true);
    setError('');

    try {
      const response = await axios.post('/api/generate-pdf-from-json', {}, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { 
        type: 'application/pdf' 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `test-cases-with-images-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
    } catch (err) {
      setError(err.response?.data?.message || 'Error generating PDF file');
    } finally {
      setPdfLoading(false);
    }
  };

  const generateStyledPdfFromJson = async () => {
    setStyledPdfLoading(true);
    setError('');

    try {
      const response = await axios.post('/api/generate-pdf-from-json-html', {}, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { 
        type: 'application/pdf' 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `test-cases-styled-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
    } catch (err) {
      setError(err.response?.data?.message || 'Error generating styled PDF file');
    } finally {
      setStyledPdfLoading(false);
    }
  };

  const generateUniquePdfFromJson = async () => {
    setUniquePdfLoading(true);
    setError('');

    try {
      const response = await axios.post('/api/generate-pdf-from-json-html-unique', {}, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { 
        type: 'application/pdf' 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `test-cases-unique-images-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
    } catch (err) {
      setError(err.response?.data?.message || 'Error generating unique images PDF file');
    } finally {
      setUniquePdfLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>Test Case Generator</h1>
      
      <div className="buttons">
        <button 
          onClick={generateExcelFromJson}
          disabled={excelLoading || pdfLoading || styledPdfLoading || uniquePdfLoading}
        >
          {excelLoading ? 'Generating...' : 'Generate Excel'}
        </button>

        <button 
          onClick={generatePdfFromJson}
          disabled={excelLoading || pdfLoading || styledPdfLoading || uniquePdfLoading}
        >
          {pdfLoading ? 'Generating...' : 'Generate PDF'}
        </button>

        <button 
          onClick={generateStyledPdfFromJson}
          disabled={excelLoading || pdfLoading || styledPdfLoading || uniquePdfLoading}
          className="styled-button"
        >
          {styledPdfLoading ? 'Generating...' : 'Generate Styled PDF (Same Image)'}
        </button>

        <button 
          onClick={generateUniquePdfFromJson}
          disabled={excelLoading || pdfLoading || styledPdfLoading || uniquePdfLoading}
          className="unique-button"
        >
          {uniquePdfLoading ? 'Generating...' : 'Generate Styled PDF (Unique Images)'}
        </button>
      </div>

      {(excelLoading || pdfLoading || styledPdfLoading || uniquePdfLoading) && (
        <div className="loading">
          <p>Generating document...</p>
        </div>
      )}

      {error && (
        <div className="error">
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}

export default App; 