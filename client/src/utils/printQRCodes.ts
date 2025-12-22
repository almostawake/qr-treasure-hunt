import type { Hunt } from '../types'

export function printQRCodes(hunt: Hunt): void {
  // Generate QR code data
  const baseUrl = window.location.origin
  const qrCodes: Array<{
    url: string
    label: string
    clueText: string
    hintText: string
  }> = []

  const sortedClues = hunt.clues

  // Starting QR code (points to first clue) - labeled with star
  if (sortedClues.length > 0) {
    qrCodes.push({
      url: `${baseUrl}/hunt/${hunt.id}/clue/${sortedClues[0].id}`,
      label: '★',
      clueText: 'Starting QR Code',
      hintText: '',
    })
  }

  // Clue QR codes (each points to next clue) - numbered 1, 2, 3...
  for (let i = 0; i < sortedClues.length; i++) {
    const currentClue = sortedClues[i]
    const nextClueIndex = i + 1
    if (nextClueIndex < sortedClues.length) {
      qrCodes.push({
        url: `${baseUrl}/hunt/${hunt.id}/clue/${sortedClues[nextClueIndex].id}`,
        label: `${i + 1}`,
        clueText: currentClue.text || 'No clue text',
        hintText: currentClue.hint || '',
      })
    } else {
      // Final QR - points to completion page
      qrCodes.push({
        url: `${baseUrl}/hunt/${hunt.id}/complete`,
        label: `${i + 1}`,
        clueText: currentClue.text || 'No clue text',
        hintText: currentClue.hint || '',
      })
    }
  }

  // Create print window
  const printWindow = window.open('', '_blank', 'width=800,height=600')

  if (!printWindow) {
    alert('Please allow popups to use the print feature')
    return
  }

  // Create the print document with working QR codes
  const printContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Print QR Codes - ${hunt.displayName}</title>
        <style>
          @page {
            size: A4;
            margin: 15mm;
          }

          body {
            margin: 0;
            padding: 15mm;
            font-family: Arial, sans-serif;
            background: white;
          }

          /* Mobile-specific styling - applied via JS class */
          body.mobile-device {
            zoom: 0.85;
          }

          .hunt-title {
            text-align: center;
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 30px;
            color: black;
          }

          .qr-grid {
            display: grid;
            grid-template-columns: repeat(4, 39mm);
            column-gap: 8mm;
            row-gap: 12mm;
            justify-content: center;
            grid-auto-flow: row;
          }

          .qr-item {
            width: 39mm;
            text-align: center;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            justify-self: start;
          }

          .qr-content {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .clue-text {
            font-size: 10px;
            font-weight: bold;
            margin: 8px 0 4px 0;
            color: black;
            line-height: 1.2;
            word-wrap: break-word;
            hyphens: auto;
            max-width: 39mm;
          }

          .hint-text {
            font-size: 9px;
            color: #666;
            margin: 0;
            line-height: 1.2;
            word-wrap: break-word;
            font-style: italic;
            hyphens: auto;
            max-width: 39mm;
          }

          .qr-overlay {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            border: 2px solid black;
            border-radius: 50%;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            font-weight: bold;
            color: black;
          }

        </style>
      </head>
      <body>
        <script>
          // Detect mobile device and add class
          if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
            document.body.classList.add('mobile-device');
          }
        </script>
        <div class="hunt-title">${hunt.displayName}</div>
        <div class="qr-grid" id="qr-grid">
          ${qrCodes
            .map(
              (qr) => `
            <div class="qr-item">
              <div class="qr-content">
                <div style="position: relative; width: 120px; height: 120px; margin: 0 auto;">
                  <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qr.url)}&ecc=H"
                       style="width: 120px; height: 120px; border: 2px solid black; border-radius: 4px; background: white;"
                       alt="QR Code ${qr.label}" />
                  <div class="qr-overlay">${qr.label}</div>
                </div>
                <div class="clue-text">${qr.clueText.replace(/'/g, '&#39;').replace(/"/g, '&quot;')}</div>
                ${qr.hintText ? `<div class="hint-text">Hint: ${qr.hintText.replace(/'/g, '&#39;').replace(/"/g, '&quot;')}</div>` : ''}
              </div>
            </div>
          `
            )
            .join('')}
        </div>

        <script>
          // Close window after print dialog is dismissed
          window.onafterprint = function() {
            window.close();
          };

          window.onload = function() {
            // Wait for all QR code images to load before printing
            const images = document.querySelectorAll('img');
            let loadedCount = 0;
            const totalImages = images.length;

            if (totalImages === 0) {
              window.print();
              return;
            }

            function checkAllLoaded() {
              loadedCount++;
              if (loadedCount === totalImages) {
                // Small delay to ensure rendering is complete
                setTimeout(() => {
                  window.print();
                }, 100);
              }
            }

            images.forEach(img => {
              if (img.complete) {
                checkAllLoaded();
              } else {
                img.onload = checkAllLoaded;
                img.onerror = checkAllLoaded; // Still print even if an image fails
              }
            });
          };
        </script>
      </body>
    </html>
  `

  // Write content to new window
  printWindow.document.write(printContent)
  printWindow.document.close()
}
