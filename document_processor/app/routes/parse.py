from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import List
from app.models.schemas import DocumentParseResponse, BatchDocumentParseResponse
from app.utils.file_utils import detect_file_type
from app.services.pdf_parser import parse_pdf_bytes
from app.services.docx_parser import parse_docx_bytes
from app.services.txt_parser import parse_txt_bytes

router = APIRouter()

def process_single_file_bytes(file_bytes: bytes, filename: str, content_type: str) -> DocumentParseResponse:
    ext, category = detect_file_type(filename, content_type)

    if not file_bytes or len(file_bytes) == 0:
        return DocumentParseResponse(
            success=False,
            fileName=filename,
            fileType=content_type or category,
            pageCount=0,
            extractionMethod="none",
            ocrUsed=False,
            textQuality="FAILED",
            characterCount=0,
            wordCount=0,
            text="",
            layoutText="",
            normalizedText="",
            candidateName=None,
            email=None,
            phone=None,
            skills=[],
            yearsOfExperience=None,
            education=[],
            pastCompanies=[],
            summary=None,
            rawTextSummary=None,
            error="Uploaded file is empty (0 bytes)."
        )

    try:
        if category == 'pdf':
            parsed = parse_pdf_bytes(file_bytes, filename)
        elif category == 'docx':
            parsed = parse_docx_bytes(file_bytes, filename)
        else:
            parsed = parse_txt_bytes(file_bytes, filename)

        layout_txt = parsed.get("layoutText", parsed.get("text", ""))
        norm_txt = parsed.get("normalizedText", parsed.get("text", ""))

        success = parsed.get("textQuality") != "FAILED" and len(norm_txt.strip()) > 0
        error_msg = None if success else "Unable to extract readable text from document. Text extraction was insufficient."
        extracted_name = parsed.get("candidateName")
        if extracted_name and extracted_name.strip().lower() in ["candidate", "unknown", "profile", "applicant"]:
            extracted_name = None

        return DocumentParseResponse(
            success=success,
            fileName=filename,
            fileType=content_type or f"application/{category}",
            pageCount=parsed.get("pageCount", 1),
            extractionMethod=parsed.get("extractionMethod", "direct"),
            ocrUsed=parsed.get("ocrUsed", False),
            textQuality=parsed.get("textQuality", "GOOD"),
            characterCount=parsed.get("characterCount", 0),
            wordCount=parsed.get("wordCount", 0),
            text=parsed.get("text", ""),
            layoutText=layout_txt,
            normalizedText=norm_txt,
            # Structured JSON entities
            candidateName=extracted_name,
            email=parsed.get("email"),
            phone=parsed.get("phone"),
            skills=parsed.get("skills", []),
            yearsOfExperience=parsed.get("yearsOfExperience"),
            education=parsed.get("education", []),
            pastCompanies=parsed.get("pastCompanies", []),
            summary=parsed.get("summary"),
            rawTextSummary=parsed.get("rawTextSummary"),
            error=error_msg
        )
    except Exception as e:
        return DocumentParseResponse(
            success=False,
            fileName=filename,
            fileType=content_type or "unknown",
            pageCount=0,
            extractionMethod="failed",
            ocrUsed=False,
            textQuality="FAILED",
            characterCount=0,
            wordCount=0,
            text="",
            layoutText="",
            normalizedText="",
            candidateName=None,
            email=None,
            phone=None,
            skills=[],
            yearsOfExperience=None,
            education=[],
            pastCompanies=[],
            summary=None,
            rawTextSummary=None,
            error=f"Document parsing error: {str(e)}"
        )

@router.post("/parse-document", response_model=DocumentParseResponse)
async def parse_document(file: UploadFile = File(...)):
    """
    Parses a single CV or JD file and extracts text + structured candidate entities.
    """
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="No file provided in request.")

    file_bytes = await file.read()
    return process_single_file_bytes(file_bytes, file.filename, file.content_type or "")

@router.post("/parse-documents", response_model=BatchDocumentParseResponse)
async def parse_documents(files: List[UploadFile] = File(...)):
    """
    Parses multiple CV / JD files in a resilient batch without failing on malformed individual files.
    """
    if not files or len(files) == 0:
        raise HTTPException(status_code=400, detail="No files provided in batch upload request.")

    results: List[DocumentParseResponse] = []

    for file in files:
        filename = file.filename or "uploaded_document"
        content_type = file.content_type or ""
        try:
            file_bytes = await file.read()
            res = process_single_file_bytes(file_bytes, filename, content_type)
            results.append(res)
        except Exception as e:
            results.append(
                DocumentParseResponse(
                    success=False,
                    fileName=filename,
                    fileType=content_type or "unknown",
                    pageCount=0,
                    extractionMethod="failed",
                    ocrUsed=False,
                    textQuality="FAILED",
                    characterCount=0,
                    wordCount=0,
                    text="",
                    layoutText="",
                    normalizedText="",
                    candidateName=None,
                    email=None,
                    phone=None,
                    skills=[],
                    yearsOfExperience=None,
                    education=[],
                    pastCompanies=[],
                    summary=None,
                    rawTextSummary=None,
                    error=f"Batch read failure: {str(e)}"
                )
            )

    successful_count = len([r for r in results if r.success])
    failed_count = len(results) - successful_count

    return BatchDocumentParseResponse(
        success=True,
        totalFiles=len(results),
        successfulCount=successful_count,
        failedCount=failed_count,
        results=results
    )

