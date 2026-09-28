import io
import os
import math
import re
from typing import List, Dict, Any
import numpy as np

class VectorIndex:
    def __init__(self, chunks: List[Dict[str, Any]], google_api_key: str = None):
        self.chunks = chunks
        self.google_api_key = (google_api_key or os.environ.get("GOOGLE_API_KEY", "")).strip()
        self.embeddings = []
        self.use_google = bool(self.google_api_key)
        self._build_index()

    def _build_index(self):
        if not self.chunks:
            return

        if self.use_google:
            try:
                import google.generativeai as genai
                genai.configure(api_key=self.google_api_key)
                
                texts = [c["text"] for c in self.chunks]
                all_vectors = []
                batch_size = 10
                
                embed_model = "models/gemini-embedding-001"
                for i in range(0, len(texts), batch_size):
                    batch = texts[i:i + batch_size]
                    result = genai.embed_content(
                        model=embed_model,
                        content=batch,
                        task_type="retrieval_document"
                    )
                    all_vectors.extend(result["embedding"])
                
                self.embeddings = np.array(all_vectors, dtype=np.float32)
                norms = np.linalg.norm(self.embeddings, axis=1, keepdims=True)
                norms[norms == 0] = 1e-10
                self.embeddings = self.embeddings / norms
                print(f"[VectorIndex] Embedded {len(texts)} chunks using {embed_model}")
                return
            except Exception as e:
                print(f"[VectorIndex] Google embedding failed: {e}. Falling back to BM25/TF-IDF.")
                self.use_google = False

        self._build_tfidf_index()

    def _tokenize(self, text: str) -> List[str]:
        return re.findall(r'\b[a-zA-Z0-9_\-]{2,}\b', text.lower())

    def _build_tfidf_index(self):
        self.doc_count = len(self.chunks)
        self.vocab = {}
        self.idf = {}
        self.doc_vectors = []

        doc_tfs = []
        df = {}

        for c in self.chunks:
            tokens = self._tokenize(c["text"])
            tf = {}
            for t in tokens:
                tf[t] = tf.get(t, 0) + 1
            doc_tfs.append((tokens, tf))
            for t in set(tokens):
                df[t] = df.get(t, 0) + 1

        for term, freq in df.items():
            self.idf[term] = math.log((self.doc_count + 1) / (freq + 0.5)) + 1.0

        self.vocab = {term: idx for idx, term in enumerate(self.idf.keys())}
        dim = len(self.vocab)

        vectors = np.zeros((self.doc_count, dim), dtype=np.float32)
        for i, (tokens, tf) in enumerate(doc_tfs):
            for t, count in tf.items():
                if t in self.vocab:
                    col = self.vocab[t]
                    vectors[i, col] = (count / (len(tokens) + 1e-5)) * self.idf[t]

        norms = np.linalg.norm(vectors, axis=1, keepdims=True)
        norms[norms == 0] = 1e-10
        self.doc_vectors = vectors / norms

    def query(self, query_text: str, top_k: int = 5) -> List[Dict[str, Any]]:
        if not self.chunks:
            return []

        is_ref_query = bool(re.search(r'\b(?:references?|citations?|bibliography|who wrote|authors? of|literature cited)\b', query_text, re.I))

        if self.use_google and len(self.embeddings) > 0:
            try:
                import google.generativeai as genai
                genai.configure(api_key=self.google_api_key)
                res = genai.embed_content(
                    model="models/gemini-embedding-001",
                    content=query_text,
                    task_type="retrieval_query"
                )
                q_vec = np.array(res["embedding"], dtype=np.float32)
                q_norm = np.linalg.norm(q_vec)
                if q_norm > 0:
                    q_vec = q_vec / q_norm
                
                scores = np.dot(self.embeddings, q_vec)

                adjusted_scores = scores.copy()
                if not is_ref_query:
                    for idx, chunk in enumerate(self.chunks):
                        if chunk.get("is_reference"):
                            adjusted_scores[idx] *= 0.30

                top_indices = np.argsort(adjusted_scores)[::-1][:top_k]
                
                results = []
                for idx in top_indices:
                    chunk = dict(self.chunks[idx])
                    chunk["score"] = float(scores[idx])
                    results.append(chunk)
                return results
            except Exception as e:
                print(f"[VectorIndex] Query embedding failed: {e}. Using TF-IDF.")

        tokens = self._tokenize(query_text)
        if not self.vocab or not tokens:
            return [dict(c, score=0.5) for c in self.chunks[:top_k]]

        q_vec = np.zeros(len(self.vocab), dtype=np.float32)
        for t in tokens:
            if t in self.vocab:
                col = self.vocab[t]
                q_vec[col] += self.idf.get(t, 1.0)
        
        q_norm = np.linalg.norm(q_vec)
        if q_norm > 0:
            q_vec = q_vec / q_norm

        scores = np.dot(self.doc_vectors, q_vec)

        adjusted_scores = scores.copy()
        if not is_ref_query:
            for idx, chunk in enumerate(self.chunks):
                if chunk.get("is_reference"):
                    adjusted_scores[idx] *= 0.30

        top_indices = np.argsort(adjusted_scores)[::-1][:top_k]

        results = []
        for idx in top_indices:
            chunk = dict(self.chunks[idx])
            chunk["score"] = float(scores[idx])
            results.append(chunk)

        return results
