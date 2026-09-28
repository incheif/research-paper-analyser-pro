import io
import re
from typing import List, Dict, Any
from pypdf import PdfReader

class PDFParser:
    @staticmethod
    def extract_text_by_pages(file_bytes: bytes) -> List[Dict[str, Any]]:
        reader = PdfReader(io.BytesIO(file_bytes))
        pages_data = []

        for index, page in enumerate(reader.pages):
            try:
                extracted = page.extract_text() or ""
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
        chunk_overlap: int = 150,
        filename: str = "",
        paper_id: str = ""
    ) -> List[Dict[str, Any]]:
        chunks = []
        chunk_id = 0
        total_pages = len(pages_data)
        in_references = False

        # Clean filename to avoid awkward trailing punctuation or .pdf clutter
        clean_filename = re.sub(r'\.pdf$', '', filename, flags=re.I).strip()

        for p_info in pages_data:
            page_num = p_info["page"]
            text = p_info["text"]

            if not text.strip():
                continue

            # Detect transition into References / Bibliography (typically in the latter half of the document)
            if page_num > max(2, int(total_pages * 0.45)):
                if re.search(r'(?:^|\n)\s*(?:references|bibliography|works cited|literature cited)\b', text, re.I):
                    in_references = True
                elif len(re.findall(r'(?:^|\n)\s*\[\d{1,3}\]\s+[A-Z]', text)) >= 3:
                    in_references = True

            is_ref = in_references or bool(re.search(r'^\s*(?:references|bibliography)\s*$', text, re.I | re.MULTILINE))

            paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
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
                            "text": current_chunk.strip(),
                            "filename": clean_filename,
                            "paper_id": paper_id,
                            "is_reference": is_ref,
                            "section": "References" if is_ref else "Main Text"
                        })
                    
                    if len(para) > chunk_size:
                        start = 0
                        while start < len(para):
                            end = start + chunk_size
                            chunk_id += 1
                            chunks.append({
                                "chunk_id": chunk_id,
                                "page": page_num,
                                "text": para[start:end].strip(),
                                "filename": clean_filename,
                                "paper_id": paper_id,
                                "is_reference": is_ref,
                                "section": "References" if is_ref else "Main Text"
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
                    "text": current_chunk.strip(),
                    "filename": clean_filename,
                    "paper_id": paper_id,
                    "is_reference": is_ref,
                    "section": "References" if is_ref else "Main Text"
                })

        return chunks

    @staticmethod
    def heuristic_paper_metadata(pages_data: List[Dict[str, Any]], filename: str) -> Dict[str, Any]:
        if not pages_data:
            return {"title": filename, "abstract": "No content found.", "total_pages": 0}

        first_page = pages_data[0]["text"]
        lines = [line.strip() for line in first_page.split("\n") if len(line.strip()) > 3]
        title = filename.replace(".pdf", "").replace("_", " ").title()
        if lines:
            candidate_title = lines[0]
            if len(lines) > 1 and len(lines[0]) < 60 and not re.search(r'abstract|arxiv|doi|conference', lines[0], re.I):
                candidate_title = f"{lines[0]} {lines[1]}"
            title = candidate_title[:120].strip()

        abstract = "Abstract not explicitly located in text."
        abs_match = re.search(r'(?:abstract|summary)[:\s\-\u2013\u2014]+(.*?)(?:\n\s*(?:1[\.\s]|introduction|keywords|index terms|i\.\s+introduction))', first_page, re.I | re.DOTALL)
        if abs_match:
            abstract = abs_match.group(1).strip()
            abstract = re.sub(r'\s+', ' ', abstract)[:1200]
        elif len(pages_data) > 1:
            combined = first_page + "\n" + pages_data[1]["text"]
            abs_match2 = re.search(r'(?:abstract|summary)[:\s\-\u2013\u2014]+(.*?)(?:\n\s*(?:1[\.\s]|introduction|keywords|index terms))', combined, re.I | re.DOTALL)
            if abs_match2:
                abstract = re.sub(r'\s+', ' ', abs_match2.group(1).strip())[:1200]

        return {
            "title": title,
            "abstract": abstract,
            "total_pages": len(pages_data),
            "filename": filename
        }
