import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import '../styles/FileUpload.css';
import { API_URL } from '../config';

const REQUIRED_COLUMNS = ['producer', 'varietal', 'type', 'price'];

function FileUpload({ adminToken, onWinesParsed }) {
  const [uploadMethod, setUploadMethod] = useState('csv');
  const [file, setFile] = useState(null);
  const [csvData, setCsvData] = useState(null);
  const [csvColumns, setCsvColumns] = useState([]);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);

  const handleCSVSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setError('');
    setFile(selectedFile);

    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          setError(`CSV parsing errors: ${results.errors[0].message}`);
          return;
        }

        const columns = results.meta.fields || [];
        setCsvColumns(columns);

        // Check required columns
        const missing = REQUIRED_COLUMNS.filter(col => !columns.includes(col));
        if (missing.length > 0) {
          setError(`Missing required columns: ${missing.join(', ')}. Required: producer, varietal, type, price`);
        }

        setCsvData(results.data.filter(row =>
          row.producer || row.varietal || row.type
        ));
      }
    });
  };

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setError('');

    files.forEach(file => {
      if (file.size > 10 * 1024 * 1024) {
        setError(`File ${file.name} is too large (max 10MB)`);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        setImages(prev => [...prev, {
          name: file.name,
          dataUrl: reader.result,
          size: file.size
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handlePDFSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File is too large (max 10MB)');
      return;
    }

    setError('');
    setFile(selectedFile);

    const reader = new FileReader();
    reader.onload = () => {
      setImages([{
        name: selectedFile.name,
        dataUrl: reader.result,
        size: selectedFile.size
      }]);
    };
    reader.readAsDataURL(selectedFile);
  };

  const removeImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleProcess = async () => {
    setLoading(true);
    setError('');

    try {
      if (uploadMethod === 'csv') {
        await processCSV();
      } else {
        await processImages();
      }
    } catch (err) {
      setError(err.message || 'Processing failed');
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  const processCSV = async () => {
    if (!csvData || csvData.length === 0) {
      throw new Error('No wine data found in CSV');
    }

    setProgress(`Sending ${csvData.length} wines to AI for sensory estimation...`);

    // Prepare wines for AI - only send basic fields
    const wines = csvData.map(row => ({
      year: row.year || '',
      producer: row.producer || '',
      varietal: row.varietal || '',
      region: row.region || '',
      type: row.type || '',
      price: parseFloat(row.price) || 0,
      // Include any existing sensory data so AI can validate/improve
      acidity: row.acidity || '',
      tannins: row.tannins || '',
      bodyWeight: row.bodyWeight || '',
      sweetnessLevel: row.sweetnessLevel || '',
      flavorProfile: row.flavorProfile
        ? row.flavorProfile.split(',').map(f => f.trim())
        : []
    }));

    const response = await fetch(`${API_URL}/ai/parse-csv`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ wines })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || 'AI processing failed');
    }

    const data = await response.json();
    setProgress(`AI processed ${data.count} wines successfully!`);

    // Small delay so user sees success message
    await new Promise(resolve => setTimeout(resolve, 800));

    onWinesParsed(data.wines);
  };

  const processImages = async () => {
    if (images.length === 0) {
      throw new Error('No images to process');
    }

    setProgress(`Analyzing ${images.length} menu image(s) with AI vision...`);

    // Extract base64 data from data URLs
    const base64Images = images.map(img => img.dataUrl);

    const response = await fetch(`${API_URL}/ai/parse-menu`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ images: base64Images })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || 'AI vision processing failed');
    }

    const data = await response.json();
    setProgress(`AI extracted ${data.count} wines from menu!`);

    await new Promise(resolve => setTimeout(resolve, 800));

    onWinesParsed(data.wines);
  };

  const canProcess = () => {
    if (loading) return false;
    if (uploadMethod === 'csv') {
      return csvData && csvData.length > 0 && !REQUIRED_COLUMNS.some(col => !csvColumns.includes(col));
    }
    return images.length > 0;
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (loading) {
    return (
      <div className="file-upload">
        <div className="processing-indicator">
          <div className="processing-spinner"></div>
          <p>{progress}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="file-upload">
      {/* Method Tabs */}
      <div className="upload-tabs">
        <button
          className={`upload-tab ${uploadMethod === 'csv' ? 'active' : ''}`}
          onClick={() => { setUploadMethod('csv'); setError(''); }}
        >
          CSV Spreadsheet
        </button>
        <button
          className={`upload-tab ${uploadMethod === 'pdf' ? 'active' : ''}`}
          onClick={() => { setUploadMethod('pdf'); setError(''); }}
        >
          PDF Menu
        </button>
        <button
          className={`upload-tab ${uploadMethod === 'photo' ? 'active' : ''}`}
          onClick={() => { setUploadMethod('photo'); setError(''); }}
        >
          Photo of Menu
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* CSV Upload */}
      {uploadMethod === 'csv' && (
        <>
          <div
            className="drop-zone"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="drop-zone-icon">CSV</div>
            <h4>Drop your CSV file here or click to browse</h4>
            <p>Required columns: producer, varietal, type, price</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleCSVSelect}
            style={{ display: 'none' }}
          />

          {file && (
            <div className="file-preview">
              <div className="file-preview-info">
                <span className="file-name">{file.name}</span>
                <span className="file-size">({formatFileSize(file.size)})</span>
              </div>
              <button className="file-remove-btn" onClick={() => { setFile(null); setCsvData(null); setCsvColumns([]); }}>
                X
              </button>
            </div>
          )}

          {csvColumns.length > 0 && (
            <div className="csv-preview">
              <h5>Detected Columns:</h5>
              <div className="column-list">
                {csvColumns.map(col => (
                  <span
                    key={col}
                    className={`column-chip ${REQUIRED_COLUMNS.includes(col) ? 'required' : ''}`}
                  >
                    {col}
                  </span>
                ))}
                {REQUIRED_COLUMNS.filter(col => !csvColumns.includes(col)).map(col => (
                  <span key={col} className="column-chip missing">
                    {col} (missing)
                  </span>
                ))}
              </div>
              {csvData && (
                <div className="row-count">{csvData.length} wines found</div>
              )}
            </div>
          )}

          <div className="format-help">
            <p>
              CSV should have columns: <code>producer</code>, <code>varietal</code>, <code>type</code>, <code>price</code>.
              Optional: <code>year</code>, <code>region</code>. AI will auto-fill acidity, tannins, body, sweetness, and flavor profiles.
            </p>
          </div>
        </>
      )}

      {/* PDF Upload */}
      {uploadMethod === 'pdf' && (
        <>
          <div
            className="drop-zone"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="drop-zone-icon">PDF</div>
            <h4>Drop your wine menu PDF here or click to browse</h4>
            <p>AI will read the menu and extract all wines automatically</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handlePDFSelect}
            style={{ display: 'none' }}
          />

          {file && (
            <div className="file-preview">
              <div className="file-preview-info">
                <span className="file-name">{file.name}</span>
                <span className="file-size">({formatFileSize(file.size)})</span>
              </div>
              <button className="file-remove-btn" onClick={() => { setFile(null); setImages([]); }}>
                X
              </button>
            </div>
          )}

          <div className="format-help">
            <p>
              Upload your restaurant's wine menu as a PDF. AI will extract wine names, producers, prices, and
              estimate tasting profiles. Works best with clear, text-based PDFs.
            </p>
          </div>
        </>
      )}

      {/* Photo Upload */}
      {uploadMethod === 'photo' && (
        <>
          {images.length === 0 ? (
            <div
              className="drop-zone"
              onClick={() => imageInputRef.current?.click()}
            >
              <div className="drop-zone-icon">IMG</div>
              <h4>Drop photos of your wine menu or click to browse</h4>
              <p>Take clear photos with good lighting. Multiple pages supported.</p>
            </div>
          ) : (
            <div className="image-thumbnails">
              {images.map((img, i) => (
                <div key={i} className="image-thumbnail">
                  <img src={img.dataUrl} alt={img.name} />
                  <button className="remove-thumb" onClick={() => removeImage(i)}>X</button>
                </div>
              ))}
              <div className="add-more-images" onClick={() => imageInputRef.current?.click()}>
                +
              </div>
            </div>
          )}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageSelect}
            style={{ display: 'none' }}
          />

          <div className="format-help">
            <p>
              Take photos of each page of your wine menu. For best results: good lighting, flat surface,
              avoid glare. You can upload multiple photos for multi-page menus.
            </p>
          </div>
        </>
      )}

      {/* Process Button */}
      <button
        className="process-btn"
        disabled={!canProcess()}
        onClick={handleProcess}
      >
        {uploadMethod === 'csv'
          ? `Process ${csvData?.length || 0} Wines with AI`
          : `Analyze Menu with AI`
        }
      </button>
    </div>
  );
}

export default FileUpload;
