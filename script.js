// Pricing Rules: B/W = ₹4, Colour = ₹10
const PRICING = {
  bw: 4.0,
  color: 10.0
};

let uploadedFile = null;
let originalPdfDoc = null;
let totalPagesInDoc = 0;
let calculatedTotal = 0;
let finalPrintUrl = null;

// Set PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// DOM elements
const fileInput = document.getElementById('file-input');
const fileNameDisplay = document.getElementById('file-name-display');
const pdfCanvas = document.getElementById('pdf-canvas');
const imagePreview = document.getElementById('image-preview');
const placeholderText = document.querySelector('.placeholder-text');
const pageCountBadge = document.getElementById('page-count-badge');
const colorModeSelect = document.getElementById('color-mode');
const duplexModeSelect = document.getElementById('duplex-mode');
const copiesInput = document.getElementById('copies-count');
const pagesPerSheetSelect = document.getElementById('pages-per-sheet');
const pageRangeSelect = document.getElementById('page-range');
const customRangeInput = document.getElementById('custom-range-input');
const totalPriceDisplay = document.getElementById('total-price');
const sheetCountDisplay = document.getElementById('sheet-count');
const payBtn = document.getElementById('pay-btn');

// File Upload Handler
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  uploadedFile = file;
  finalPrintUrl = URL.createObjectURL(file);
  fileNameDisplay.textContent = file.name;
  placeholderText.style.display = 'none';

  if (file.type === 'application/pdf') {
    const arrayBuffer = await file.arrayBuffer();
    originalPdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    totalPagesInDoc = originalPdfDoc.numPages;

    await renderPreviewPage(1); // Render first page by default

    pdfCanvas.style.display = 'block';
    imagePreview.style.display = 'none';
  } else if (file.type.startsWith('image/')) {
    totalPagesInDoc = 1;
    imagePreview.src = finalPrintUrl;
    imagePreview.style.display = 'block';
    pdfCanvas.style.display = 'none';
  }

  payBtn.disabled = false;
  recalculatePrice();
});

// Helper to render preview of a specific PDF page
async function renderPreviewPage(pageNumber) {
  if (!originalPdfDoc) return;
  try {
    const page = await originalPdfDoc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 0.8 });
    pdfCanvas.width = viewport.width;
    pdfCanvas.height = viewport.height;
    const renderContext = { canvasContext: pdfCanvas.getContext('2d'), viewport: viewport };
    await page.render(renderContext).promise;
  } catch (err) {
    console.error("Error rendering preview page:", err);
  }
}

// Custom range toggle
pageRangeSelect.addEventListener('change', () => {
  const isCustom = pageRangeSelect.value === 'custom';
  customRangeInput.style.display = isCustom ? 'block' : 'none';
  recalculatePrice();
});

[colorModeSelect, duplexModeSelect, copiesInput, pagesPerSheetSelect, customRangeInput].forEach(element => {
  element.addEventListener('input', recalculatePrice);
});

// Parse and return array of 0-indexed page positions
function getActivePagesArray() {
  if (totalPagesInDoc === 0) return [];
  if (pageRangeSelect.value === 'all' || customRangeInput.value.trim() === '') {
    return Array.from({ length: totalPagesInDoc }, (_, i) => i);
  }

  let pageIndices = [];
  const parts = customRangeInput.value.split(',');
  parts.forEach(part => {
    const range = part.trim().split('-');
    if (range.length === 2) {
      const start = parseInt(range[0], 10);
      const end = parseInt(range[1], 10);
      if (start && end && start <= end) {
        for (let i = start; i <= Math.min(end, totalPagesInDoc); i++) {
          pageIndices.push(i - 1);
        }
      }
    } else if (range.length === 1) {
      const p = parseInt(range[0], 10);
      if (p && p <= totalPagesInDoc) {
        pageIndices.push(p - 1);
      }
    }
  });

  return [...new Set(pageIndices)].sort((a, b) => a - b);
}

async function recalculatePrice() {
  if (totalPagesInDoc === 0) return;

  const activePagesArray = getActivePagesArray();
  const activePagesCount = activePagesArray.length;

  // Update preview badge to display selected pages info dynamically
  if (pageRangeSelect.value === 'custom') {
    pageCountBadge.textContent = `Selected Pages: ${activePagesCount} (of ${totalPagesInDoc} total)`;
    // If user specified custom pages, preview the first page of their selection if valid
    if (activePagesArray.length > 0 && originalPdfDoc) {
      await renderPreviewPage(activePagesArray[0] + 1);
    }
  } else {
    pageCountBadge.textContent = `Total Pages: ${totalPagesInDoc}`;
  }

  const pagesPerSheet = parseInt(pagesPerSheetSelect.value, 10);
  const copies = Math.max(1, parseInt(copiesInput.value, 10) || 1);
  const isDuplex = duplexModeSelect.value === 'duplex';
  const pricePerPage = PRICING[colorModeSelect.value];

  let physicalSheets = Math.ceil(activePagesCount / pagesPerSheet);
  if (isDuplex) {
    physicalSheets = Math.ceil(physicalSheets / 2);
  }

  calculatedTotal = activePagesCount * pricePerPage * copies;

  sheetCountDisplay.textContent = `${physicalSheets * copies} sheet(s) (${activePagesCount} pages)`;
  totalPriceDisplay.textContent = `₹${calculatedTotal.toFixed(2)}`;
}

// Payment Modal Flow
const paymentModal = document.getElementById('payment-modal');
const modalAmount = document.getElementById('modal-amount');
const upiQr = document.getElementById('upi-qr');
const simulateSuccessBtn = document.getElementById('simulate-success-btn');
const closeModalBtn = document.getElementById('close-modal-btn');

payBtn.addEventListener('click', () => {
  modalAmount.textContent = `Amount: ₹${calculatedTotal.toFixed(2)}`;
  const upiUrl = `upi://pay?pa=your-upi-id@paytm&pn=BNR_Print_Kiosk&am=${calculatedTotal}&cu=INR`;
  upiQr.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiUrl)}`;
  paymentModal.style.display = 'flex';
});

closeModalBtn.addEventListener('click', () => {
  paymentModal.style.display = 'none';
});

// Payment Success & Automated PDF Slicing & Printing
simulateSuccessBtn.addEventListener('click', async () => {
  paymentModal.style.display = 'none';

  if (uploadedFile && uploadedFile.type === 'application/pdf') {
    try {
      if (!window.PDFLib) {
        await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js");
      }

      const existingPdfBytes = await uploadedFile.arrayBuffer();
      const pdfDoc = await window.PDFLib.PDFDocument.load(existingPdfBytes);
      const subPdfDoc = await window.PDFLib.PDFDocument.create();

      const selectedIndices = getActivePagesArray();
      const copiedPages = await subPdfDoc.copyPages(pdfDoc, selectedIndices);
      copiedPages.forEach((page) => subPdfDoc.addPage(page));

      const pdfBytes = await subPdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      finalPrintUrl = URL.createObjectURL(blob);
    } catch (err) {
      console.error("Error slicing PDF, printing original:", err);
    }
  }

  silentPrintDocument();
});

function loadScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Silent Print Handler
function silentPrintDocument() {
  if (!finalPrintUrl) return;

  const oldIframe = document.getElementById('print-iframe');
  if (oldIframe) oldIframe.remove();

  const iframe = document.createElement('iframe');
  iframe.id = 'print-iframe';
  iframe.style.display = 'none';
  iframe.src = finalPrintUrl;
  
  document.body.appendChild(iframe);

  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }, 500);
  };
}
<script src="/bnr-print-kiosk/script.js"></script>
