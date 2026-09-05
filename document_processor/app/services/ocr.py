import io
import os
import shutil
import logging
from typing import Optional

logger = logging.getLogger("document_processor.ocr")

# Configure Tesseract binary path on Windows if standard installation exists
def configure_tesseract():
    try:
        import pytesseract
        # If tesseract is already found in PATH, nothing to do
        if shutil.which("tesseract"):
            return
        
        # Check standard Windows installation paths
        common_paths = [
            r"C:\Program Files\Tesseract-OCR\tesseract.exe",
            r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
            os.path.expandvars(r"%LOCALAPPDATA%\Programs\Tesseract-OCR\tesseract.exe"),
        ]
        for p in common_paths:
            if os.path.exists(p):
                pytesseract.pytesseract.tesseract_cmd = p
                logger.info(f"Configured Tesseract binary at: {p}")
                return
    except Exception as e:
        logger.warning(f"Could not configure Tesseract path: {e}")

configure_tesseract()

def perform_ocr_on_images(images: list) -> str:
    """
    OCR abstraction layer over image lists using pytesseract.
    """
    try:
        import pytesseract
        configure_tesseract()
        text_chunks = []
        for img in images:
            txt = pytesseract.image_to_string(img, config='--oem 3 --psm 6')
            if txt and txt.strip():
                text_chunks.append(txt.strip())
        return "\n\n".join(text_chunks)
    except Exception as e:
        logger.warning(f"Tesseract OCR fallback encountered issue: {e}")
        return ""

def perform_pdf_ocr(pdf_bytes: bytes) -> str:
    """
    Converts PDF pages to images via fitz and performs OCR.
    """
    try:
        import pymupdf as fitz  # PyMuPDF
        import pytesseract
        from PIL import Image
        configure_tesseract()

        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        ocr_texts = []

        for page_index in range(len(doc)):
            page = doc[page_index]
            # Render page at 200 DPI for high-accuracy OCR
            pix = page.get_pixmap(dpi=200)
            img_data = pix.tobytes("png")
            img = Image.open(io.BytesIO(img_data))
            text = pytesseract.image_to_string(img, config='--oem 3 --psm 1')
            if not text or len(text.strip()) < 20:
                # Fallback to standard PSM mode
                text = pytesseract.image_to_string(img)

            if text and text.strip():
                ocr_texts.append(text.strip())
        
        return "\n\n".join(ocr_texts)
    except Exception as e:
        logger.warning(f"PyMuPDF page rendering for OCR warning: {e}")
        return ""
