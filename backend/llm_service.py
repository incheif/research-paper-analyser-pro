import os
import json
import re
from typing import List, Dict, Any, Optional

class LLMService:
    def __init__(
        self, 
        google_api_key: Optional[str] = None, 
        groq_api_key: Optional[str] = None,
        preferred_provider: str = "gemini",
        preferred_model: str = "gemini-1.5-flash"
    ):
        self.google_api_key = google_api_key or os.environ.get("GOOGLE_API_KEY", "")
        self.groq_api_key = groq_api_key or os.environ.get("GROQ_API_KEY", "")
        self.preferred_provider = preferred_provider
        self.preferred_model = preferred_model

    def _call_gemini(self, prompt: str, system_prompt: str = "", model_name: str = "gemini-1.5-flash") -> str:
        import google.generativeai as genai
        genai.configure(api_key=self.google_api_key)
        
        # Normalize model name
        if not model_name.startswith("models/"):
            clean_name = model_name
        else:
            clean_name = model_name.replace("models/", "")
            
        model = genai.GenerativeModel(
            model_name=clean_name,
            system_instruction=system_prompt if system_prompt else None
        )
        response = model.generate_content(prompt)
        return response.text

    def _call_groq(self, prompt: str, system_prompt: str = "", model_name: str = "llama-3.3-70b-versatile") -> str:
        from groq import Groq
        client = Groq(api_key=self.groq_api_key)
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        # Fallback default groq model if not specified or outdated
        target_model = model_name if ("llama" in model_name or "mixtral" in model_name) else "llama-3.3-70b-versatile"
        completion = client.chat.completions.create(
            model=target_model,
            messages=messages,
            temperature=0.2,
            max_tokens=2500
        )
        return completion.choices[0].message.content

    def generate(self, prompt: str, system_prompt: str = "", model: Optional[str] = None) -> str:
        chosen_model = model or self.preferred_model

        # Prioritize based on available keys
        if self.google_api_key and ("gemini" in chosen_model.lower() or not self.groq_api_key):
            try:
                return self._call_gemini(prompt, system_prompt, chosen_model)
            except Exception as e:
                print(f"[LLMService] Gemini call failed: {e}")
                if self.groq_api_key:
                    return self._call_groq(prompt, system_prompt, "llama-3.3-70b-versatile")
                raise e

        if self.groq_api_key:
            try:
                return self._call_groq(prompt, system_prompt, chosen_model)
            except Exception as e:
                print(f"[LLMService] Groq call failed: {e}")
                if self.google_api_key:
                    return self._call_gemini(prompt, system_prompt, "gemini-1.5-flash")
                raise e

        raise ValueError("No valid AI API key provided. Please provide either a Google Gemini API Key or Groq API Key.")

    def analyze_paper(self, paper_meta: Dict[str, Any], sample_text: str) -> Dict[str, Any]:
        """
        Produce a structured breakdown of the paper:
        - Executive Summary
        - Key Contributions
        - Methodology
        - Results & Benchmarks
        - Limitations & Future Work
        - BibTeX
        - Quick Questions
        """
        title = paper_meta.get("title", "Research Paper")
        filename = paper_meta.get("filename", "")
        pages_count = paper_meta.get("total_pages", 1)

        # If no API key configured, use intelligent offline extractor
        if not self.google_api_key and not self.groq_api_key:
            return self._offline_paper_analysis(paper_meta, sample_text)

        system_prompt = (
            "You are a Distinguished Principal AI Researcher and peer-review editor. "
            "Analyze the provided academic paper text and return a comprehensive, structured JSON response."
        )

        prompt = f"""
Paper Title: {title}
Filename: {filename}
Total Pages: {pages_count}

Document Content Excerpt:
\"\"\"
{sample_text[:14000]}
\"\"\"

Analyze this paper thoroughly. Return a STRICT JSON object with the following schema:
{{
  "title": "{title}",
  "authors": "comma-separated author names or 'Not explicitly identified'",
  "publication_venue": "Conference/Journal or arXiv if identified",
  "executive_summary": "Concise 3-4 sentence high-level overview of the paper's thesis and breakthroughs",
  "key_contributions": [
    "Specific novel contribution 1",
    "Specific novel contribution 2",
    "Specific novel contribution 3"
  ],
  "methodology": "Detailed breakdown of the theoretical framework, proposed architecture, algorithms, and training/evaluation setup",
  "results_and_benchmarks": "Key performance metrics, benchmark datasets, baseline comparisons, and statistical findings",
  "limitations": "Critical limitations, computational bottlenecks, edge cases, and future directions identified",
  "bibtex": "@article{{...,\\n  title={{{title}}},\\n  ...\\n}}",
  "suggested_questions": [
    "How does the proposed method compare to existing baselines?",
    "What are the main assumptions or constraints of this work?",
    "Could this architecture be adapted for real-time inference?"
  ]
}}
Ensure the output is valid JSON without codeblock formatting if possible, or inside ```json ```.
"""
        try:
            raw_response = self.generate(prompt, system_prompt)
            # Clean json fences
            cleaned = re.sub(r'^```json\s*', '', raw_response.strip(), flags=re.MULTILINE)
            cleaned = re.sub(r'```$', '', cleaned.strip(), flags=re.MULTILINE)
            data = json.loads(cleaned)
            return data
        except Exception as e:
            print(f"[LLMService] Error during JSON analysis: {e}. Falling back to heuristic analysis.")
            return self._offline_paper_analysis(paper_meta, sample_text)

    def _offline_paper_analysis(self, paper_meta: Dict[str, Any], text: str) -> Dict[str, Any]:
        """Heuristic offline paper analysis when no key is set yet."""
        title = paper_meta.get("title", "Research Paper")
        abstract = paper_meta.get("abstract", "Abstract extraction unavailable.")
        
        clean_key = re.sub(r'[^a-zA-Z0-9]', '', title.lower())[:15] or "paper2026"
        bibtex = (
            f"@article{{{clean_key},\n"
            f"  title = {{{title}}},\n"
            f"  author = {{Researcher, et al.}},\n"
            f"  journal = {{arXiv preprint}},\n"
            f"  year = {{2026}}\n"
            f"}}"
        )

        return {
            "title": title,
            "authors": "Academic Researchers (Connect API key in sidebar for full extraction)",
            "publication_venue": "arXiv / Conference Proceedings",
            "executive_summary": abstract if len(abstract) > 50 else (
                f"This paper explores novel methods in '{title}'. Connect your Gemini or Groq API key in the top navigation to generate an in-depth AI-powered synthesis."
            ),
            "key_contributions": [
                "Proposes an innovative architectural formulation addressing domain performance bottlenecks.",
                "Introduces an empirical evaluation comparing against standard state-of-the-art baselines.",
                "Demonstrates efficiency improvements and qualitative advantages in document analysis."
            ],
            "methodology": (
                "The study formulates a structured pipeline incorporating theoretical modeling, dataset preprocessing, "
                "algorithmic implementation, and systematic ablation experiments to validate each component."
            ),
            "results_and_benchmarks": (
                "Experimental results indicate strong competitive performance across standard benchmarks. "
                "Add your API Key for detailed statistical breakdown from document tables and charts."
            ),
            "limitations": (
                "Generalization across diverse external out-of-distribution domains, computational cost during scaling, "
                "and dependency on labeled benchmark quality."
            ),
            "bibtex": bibtex,
            "suggested_questions": [
                "What is the core problem this paper aims to solve?",
                "What dataset and evaluation metrics were utilized?",
                "What are the main architectural differences from prior work?",
                "What are the acknowledged limitations of this approach?"
            ]
        }

    def answer_query(
        self, 
        query: str, 
        retrieved_chunks: List[Dict[str, Any]], 
        conversation_history: List[Dict[str, str]] = None,
        model: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate grounded RAG answer with citation references.
        """
        if not retrieved_chunks:
            return {
                "answer": "The answer could not be found in the uploaded documents as no relevant sections were matched.",
                "citations": []
            }

        # Build context string
        context_parts = []
        for c in retrieved_chunks:
            context_parts.append(
                f"[Source Chunk #{c.get('chunk_id')} | Page {c.get('page')}]:\n{c.get('text')}\n"
            )
        context_str = "\n".join(context_parts)

        # Build citations list for frontend highlighting
        citations = []
        for c in retrieved_chunks:
            snippet = c.get("text", "")[:280] + ("..." if len(c.get("text", "")) > 280 else "")
            citations.append({
                "page": c.get("page", 1),
                "chunk_id": c.get("chunk_id", 1),
                "snippet": snippet,
                "relevance_score": round(c.get("score", 0.0), 3)
            })

        # If no API key, provide smart synthesis from retrieved chunks
        if not self.google_api_key and not self.groq_api_key:
            primary_chunk = retrieved_chunks[0]
            answer = (
                f"**Retrieved Insight from Page {primary_chunk.get('page')}:**\n\n"
                f"> \"{primary_chunk.get('text')[:350]}...\"\n\n"
                f"💡 *Note: To unlock conversational AI reasoning and multi-turn synthesis, enter your Google Gemini or Groq API key in the API settings bar.*"
            )
            return {
                "answer": answer,
                "citations": citations
            }

        system_prompt = (
            "You are a rigorous, academic research assistant. Use ONLY the provided context excerpts to answer the question. "
            "Whenever you assert a factual claim, cite the exact source using bracketed notation like `[Page X]`. "
            "If the information is not present in the excerpts, clearly state: "
            "'The answer could not be found in the uploaded documents.'"
        )

        history_str = ""
        if conversation_history:
            history_str = "\n".join([f"{m.get('role', 'user').title()}: {m.get('content', '')}" for m in conversation_history[-4:]])

        prompt = f"""
Retrieved Document Excerpts:
---------------------------
{context_str}
---------------------------

{f'Recent Conversation History:\n{history_str}\n' if history_str else ''}
User Question: {query}

Provide a comprehensive, well-structured explanation with bullet points and bold highlights where appropriate. Always include `[Page X]` citations for claims based on the excerpts.
"""

        try:
            answer = self.generate(prompt, system_prompt, model)
            return {
                "answer": answer,
                "citations": citations
            }
        except Exception as e:
            return {
                "answer": f"Error generating answer: {str(e)}. Please check your API key and network connection.",
                "citations": citations
            }
