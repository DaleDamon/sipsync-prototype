import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import '../styles/QRScanner.css';

function QRScanner({ onScan, onClose }) {
  const [error, setError] = useState('');
  const [scanned, setScanned] = useState(false);
  const scannerRef = useRef(null);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner('qr-reader', {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0,
    });

    const onScanSuccess = (decodedText) => {
      // Stop scanner after successful scan
      scanner.clear();
      setScanned(true);

      // Extract restaurant ID from URL
      // URL format: http://localhost:3000/restaurant/[ID]
      const urlPattern = /restaurant\/([a-zA-Z0-9]+)/;
      const match = decodedText.match(urlPattern);

      if (match && match[1]) {
        onScan(match[1]);
      } else {
        setError('Invalid QR code. Please scan a valid SipSync QR code.');
        // Restart scanner after 2 seconds
        setTimeout(() => {
          setScanned(false);
          setError('');
          scanner.render(onScanSuccess, onScanError);
        }, 2000);
      }
    };

    const onScanError = (error) => {
      // Silently ignore scanning errors
      console.log('Scan error:', error);
    };

    scanner.render(onScanSuccess, onScanError);
    scannerRef.current = scanner;

    return () => {
      scanner.clear();
    };
  }, [onScan]);

  return (
    <div className="qr-scanner-container">
      <div className="qr-scanner-card">
        <h2>Scan Restaurant QR Code</h2>
        <p className="qr-instructions">
          Point your camera at the QR code on the restaurant table
        </p>

        {error && <div className="error-message">{error}</div>}

        {!scanned && (
          <div id="qr-reader" className="qr-reader"></div>
        )}

        {scanned && (
          <div className="scan-success">
            <p>✓ QR code scanned successfully!</p>
            <p>Redirecting to restaurant pairing tool...</p>
          </div>
        )}

        <button className="close-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

export default QRScanner;
