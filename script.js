// Pricing Rules based on your note:
const PRICING = {
  bw: 4.0,     // ₹4 for Black & White
  color: 10.0  // ₹10 for Colour
};

let uploadedFile = null;
let totalPagesInDoc = 0;
let calculatedTotal = 0;

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
  fileNameDisplay.textContent = file.name;
  placeholderText.style.display = 'none';

  if (file.type === 'application/pdf') {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    totalPagesInDoc = pdf.numPages;

    // Render first page preview
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 0.8 });
    pdfCanvas.width = viewport.width;
    pdfCanvas.height = viewport.height;
    const renderContext = { canvasContext: pdfCanvas.getContext('2d'), viewport: viewport };
    await page.render(renderContext).promise;

    pdfCanvas.style.display = 'block';
    imagePreview.style.display = 'none';
  } else if (file.type.startsWith('image/')) {
    totalPagesInDoc = 1;
    imagePreview.src = URL.createObjectURL(file);
    imagePreview.style.display = 'block';
    pdfCanvas.style.display = 'none';
  }

  pageCountBadge.textContent = `Total Pages: ${totalPagesInDoc}`;
  payBtn.disabled = false;
  recalculatePrice();
});

// Custom range toggle
pageRangeSelect.addEventListener('change', () => {
  customRangeInput.style.display = (pageRangeSelect.value === 'custom') ? 'block' : 'none';
  recalculatePrice();
});

// Listen to all parameter changes
[colorModeSelect, duplexModeSelect, copiesInput, pagesPerSheetSelect, customRangeInput].forEach(element => {
  element.addEventListener('input', recalculatePrice);
});

// Calculate Pricing
function recalculatePrice() {
  if (totalPagesInDoc === 0) return;

  let activePages = totalPagesInDoc;
  if (pageRangeSelect.value === 'custom' && customRangeInput.value.trim() !== '') {
    // Parse custom ranges like "1-3, 5"
    const parsed = parsePageRange(customRangeInput.value, totalPagesInDoc);
    if (parsed > 0) activePages = parsed;
  }

  const pagesPerSheet = parseInt(pagesPerSheetSelect.value, 10);
  const copies = Math.max(1, parseInt(copiesInput.value, 10) || 1);
  const isDuplex = duplexModeSelect.value === 'duplex';
  const pricePerPage = PRICING[colorModeSelect.value];

  // Number of printed sheets calculation
  let physicalSheets = Math.ceil(activePages / pagesPerSheet);
  if (isDuplex) {
    physicalSheets = Math.ceil(physicalSheets / 2);
  }

  calculatedTotal = activePages * pricePerPage * copies;

  sheetCountDisplay.textContent = `${physicalSheets * copies} sheet(s)`;
  totalPriceDisplay.textContent = `₹${calculatedTotal.toFixed(2)}`;
}

function parsePageRange(rangeStr, maxPages) {
  let count = 0;
  const parts = rangeStr.split(',');
  parts.forEach(part => {
    const range = part.trim().split('-');
    if (range.length === 2) {
      const start = parseInt(range[0], 10);
      const end = parseInt(range[1], 10);
      if (start && end && start <= end) {
        count += Math.min(end, maxPages) - Math.max(start, 1) + 1;
      }
    } else if (range.length === 1 && parseInt(range[0], 10) <= maxPages) {
      count += 1;
    }
  });
  return count > 0 ? count : maxPages;
}

// Payment Modal Flow
const paymentModal = document.getElementById('payment-modal');
const modalAmount = document.getElementById('modal-amount');
const upiQr = document.getElementById('upi-qr');
const simulateSuccessBtn = document.getElementById('simulate-success-btn');
const closeModalBtn = document.getElementById('close-modal-btn');

payBtn.addEventListener('click', () => {
  modalAmount.textContent = `Amount: ₹${calculatedTotal.toFixed(2)}`;
  
  // Real UPI link for Paytm / any UPI app
  // Replace your-upi-id@paytm with your merchant UPI VPA
  const upiUrl = `upi://pay?pa=your-upi-id@paytm&pn=BNR_Print_Kiosk&am=${calculatedTotal}&cu=INR`;
  upiQr.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiUrl)}`;

  paymentModal.style.display = 'flex';
});

closeModalBtn.addEventListener('click', () => {
  paymentModal.style.display = 'none';
});

// Trigger Print upon Payment Confirmation
simulateSuccessBtn.addEventListener('click', () => {
  paymentModal.style.display = 'none';
  alert('Payment Successful! Printing document automatically...');
  
  // Automatically trigger printer workflow
  triggerPrintWorkflow();
});

function triggerPrintWorkflow() {
  // If running on a dedicated kiosk browser, window.print() prints silently:
  window.print();
}