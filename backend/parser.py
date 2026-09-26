import io
import re
from typing import List, Dict, Any
from pypdf import PdfReader

class PDFParser:
    @staticmethod
    def extract_text_by_pages(file_bytes: bytes) -> List[Dict[str, Any]]:
        """
        Extract text from PDF pages with metadata.
        Returns a list of dicts: [{"page": 1, "text": "..."}]
        """
        reader = PdfReader(io.BytesIO(file_bytes))
        pages_data = []

        for index, page in enumerate(reader.pages):
            try:
                extracted = page.extract_text() or ""
                # Normalize line breaks and multiple spaces
                clean_text = re.sub(r'[ \t]+', ' ', extracted).strip()
                pages_data.append({
                    "page": index + 1,
                    "text": clean_text,
                    "char_count": len(clean_text)
                })
            except Exception as e:
                pages_data.append({
                    "page": index + 1,
                    "text": f"[Error reading page {index + 1}: {str(e)}]",
                    "char_count": 0
                })

        return pages_data

    @staticmethod
    def create_chunks(
        pages_data: List[Dict[str, Any]], 
        chunk_size: int = 900, 
        chunk_overlap: int = 150
    ) -> List[Dict[str, Any]]:
        """
        Split page texts into overlapping chunks while preserving page numbers.
        """
        chunks = []
        chunk_id = 0

        for p_info in pages_data:
            page_num = p_info["page"]
            text = p_info["text"]

            if not text.strip():
                continue

            # Split into paragraphs or sentences first
            paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
            
            # If no double newlines, fallback to sentence or line splitting
            if len(paragraphs) <= 1:
                paragraphs = [line.strip() for line in text.split("\n") if line.strip()]

            current_chunk = ""
            for para in paragraphs:
                if len(current_chunk) + len(para) + 1 <= chunk_size:
                    current_chunk += (" " if current_chunk else "") + para
                else:
                    if current_chunk:
                        chunk_id += 1
                        chunks.append({
                            "chunk_id": chunk_id,
                            "page": page_num,
                            "text": current_chunk.strip()
                        })
                    
                    # If single paragraph exceeds chunk size, split by character window
                    if len(para) > chunk_size:
                        start = 0
                        while start < len(para):
                            end = start + chunk_size
                            chunk_id += 1
                            chunks.append({
                                "chunk_id": chunk_id,
                                "page": page_num,
                                "text": para[start:end].strip()
                            })
                            start += (chunk_size - chunk_overlap)
                        current_chunk = ""
                    else:
                        current_chunk = para

            if current_chunk:
                chunk_id += 1
                chunks.append({
                    "chunk_id": chunk_id,
                    "page": page_num,
                    "text": current_chunk.strip()
                })

        return chunks

    @staticmethod
    def heuristic_paper_metadata(pages_data: List[Dict[str, Any]], filename: str) -> Dict[str, Any]:
        """
        Quick regex/heuristic detection of Title, Abstract, and rough headings.
        """
        if not pages_data:
            return {"title": filename, "abstract": "No content found.", "total_pages": 0}

        first_page = pages_data[0]["text"]
        
        # Estimate Title from first page (first non-empty lines)
        lines = [line.strip() for line in first_page.split("\n") if len(line.strip()) > 3]
        title = filename.replace(".pdf", "").replace("_", " ").title()
        if lines:
            # Look for lines before authors or abstract
            candidate_title = lines[0]
            if len(lines) > 1 and len(lines[0]) < 60 and not re.search(r'abstract|arxiv|doi|conference', lines[0], re.I):
                candidate_title = f"{lines[0]} {lines[1]}"
            title = candidate_title[:120].strip()

        # Find abstract
        abstract = "Abstract not explicitly located in text."
        abs_match = re.search(r'(?:abstract|summary)[:\s—\-]+(.*?)(?:\n\s*(?:1[\.\s]|introduction|keywords|index terms|i\.\s+introduction))', first_page, re.I | re.DOTALL)
        if abs_match:
            abstract = abs_match.group(1).strip()
            # Clean excessive spacing
            abstract = re.sub(r'\s+', ' ', abstract)[:1200]
        elif len(pages_data) > 1:
            # Check second page if abstract spans
            combined = first_page + "\n" + pages_data[1]["text"]
            abs_match2 = re.search(r'(?:abstract|summary)[:\s—\-]+(.*?)(?:\n\s*(?:1[\.\s]|introduction|keywords|index terms))', combined, re.I | re.DOTALL)
            if abs_match2:
                abstract = re.sub(r'\s+', ' ', abs_match2.group(1).strip())[:1200]

        return {
            "title": title,
            "abstract": abstract,
            "total_pages": len(pages_data),
            "filename": filename
        }
