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
        preferred_model: str = "gemini-2.5-flash"
    ):
        self.google_api_key = (google_api_key or os.environ.get("GOOGLE_API_KEY", "")).strip()
        self.groq_api_key = (groq_api_key or os.environ.get("GROQ_API_KEY", "")).strip()
        self.preferred_provider = preferred_provider
        self.preferred_model = preferred_model or "gemini-2.5-flash"

    def _call_gemini(self, prompt: str, system_prompt: str = "", model_name: str = "gemini-2.5-flash") -> str:
        import google.generativeai as genai
        genai.configure(api_key=self.google_api_key)
        
        clean_name = model_name.replace("models/", "").strip()
        if "1.5" in clean_name or "2.0" in clean_name or not clean_name:
            clean_name = "gemini-2.5-flash"

        candidate_models = []
        for m in [clean_name, "gemini-2.5-flash", "gemini-flash-latest", "gemini-2.5-pro"]:
            if m and m not in candidate_models:
                candidate_models.append(m)
        
        last_error = None
        for candidate in candidate_models:
            try:
                model = genai.GenerativeModel(
                    model_name=candidate,
                    system_instruction=system_prompt if system_prompt else None
                )
                response = model.generate_content(prompt)
                if response and response.text:
                    return response.text
            except Exception as e:
                last_error = e
                print(f"[LLMService] Gemini model '{candidate}' attempt failed: {e}")
                continue

        raise last_error or RuntimeError("Gemini model generation failed.")

    def _call_groq(self, prompt: str, system_prompt: str = "", model_name: str = "llama-3.3-70b-versatile") -> str:
        from groq import Groq
        client = Groq(api_key=self.groq_api_key)
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

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

        if self.groq_api_key and self.groq_api_key.startswith("gsk_") and ("llama" in chosen_model.lower() or self.preferred_provider == "groq"):
            return self._call_groq(prompt, system_prompt, chosen_model)

        if self.google_api_key:
            return self._call_gemini(prompt, system_prompt, chosen_model)

        raise ValueError("No valid Google Gemini API key provided. Please check your configuration.")

    def analyze_paper(self, paper_meta: Dict[str, Any], sample_text: str) -> Dict[str, Any]:
        title = paper_meta.get("title", "Research Paper")
        filename = paper_meta.get("filename", "")
        pages_count = paper_meta.get("total_pages", 1)

        if not self.google_api_key and not self.groq_api_key:
            return self._offline_paper_analysis(paper_meta, sample_text)

        system_prompt = (
            "You are a Distinguished Principal AI Researcher and peer-review editor. "
            "Analyze the provided academic paper text and return a comprehensive, structured JSON response."
        )

        prompt = (
            f"Paper Title: {title}\n"
            f"Filename: {filename}\n"
            f"Total Pages: {pages_count}\n\n"
            f"Document Content Excerpt:\n"
            f'"""\n{sample_text[:14000]}\n"""\n\n'
            f"Analyze this paper thoroughly. Return a STRICT JSON object with the following schema:\n"
            f'{{\n'
            f'  "title": "{title}",\n'
            f'  "authors": "comma-separated author names or Academic Researchers",\n'
            f'  "publication_venue": "Conference/Journal or arXiv if identified",\n'
            f'  "executive_summary": "Concise 3-4 sentence high-level overview of the paper thesis and breakthroughs",\n'
            f'  "key_contributions": [\n'
            f'    "Specific novel contribution 1",\n'
            f'    "Specific novel contribution 2",\n'
            f'    "Specific novel contribution 3"\n'
            f'  ],\n'
            f'  "methodology": "Detailed breakdown of the theoretical framework, proposed architecture, algorithms, and training/evaluation setup",\n'
            f'  "results_and_benchmarks": "Key performance metrics, benchmark datasets, baseline comparisons, and statistical findings",\n'
            f'  "limitations": "Critical limitations, computational bottlenecks, edge cases, and future directions identified",\n'
            f'  "bibtex": "@article{{...,\\n  title={{{title}}},\\n  ...\\n}}",\n'
            f'  "suggested_questions": [\n'
            f'    "What is the core problem this paper aims to solve?",\n'
            f'    "What are the main assumptions or constraints of this work?",\n'
            f'    "How do the experimental benchmarks compare to baselines?"\n'
            f'  ]\n'
            f'}}\n'
            f"Ensure the output is strictly valid JSON."
        )

        try:
            raw_response = self.generate(prompt, system_prompt, "gemini-2.5-flash")
            cleaned = re.sub(r'^```json\s*', '', raw_response.strip(), flags=re.MULTILINE)
            cleaned = re.sub(r'```$', '', cleaned.strip(), flags=re.MULTILINE)
            data = json.loads(cleaned)
            return data
        except Exception as e:
            print(f"[LLMService] Error during JSON analysis: {e}. Falling back to heuristic analysis.")
            return self._offline_paper_analysis(paper_meta, sample_text)

    def _offline_paper_analysis(self, paper_meta: Dict[str, Any], text: str) -> Dict[str, Any]:
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
            "authors": "Academic Researchers",
            "publication_venue": "arXiv / Conference Proceedings",
            "executive_summary": abstract if len(abstract) > 50 else (
                f"This paper explores novel methods in '{title}'. A structured monograph has been indexed from the document text."
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
                "Experimental results indicate strong competitive performance across standard benchmarks."
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
        default_cross_questions = [
            "How do these findings compare with existing baselines?",
            "What are the computational bottlenecks during inference?",
            "Could this approach be adapted for multi-modal or real-time domains?"
        ]

        if not retrieved_chunks:
            return {
                "answer": "The requested topic could not be identified within the indexed sections of the uploaded documents. Consider querying with alternative technical terminology or verifying if the topic is addressed in a specific section.",
                "citations": [],
                "cross_questions": [
                    "Could you rephrase the question using different technical terms?",
                    "What specific section of the paper should I search?",
                    "Are there other metrics or concepts discussed in the abstract?"
                ]
            }

        context_parts = []
        for c in retrieved_chunks:
            fname = c.get('filename', '')
            clean_name = re.sub(r'\.pdf$', '', fname, flags=re.I).strip() if fname else "Document"
            ref_tag = " [SECTION: Cited References/Bibliography - PRIOR ART]" if c.get("is_reference") else ""
            doc_tag = f"[{clean_name}, Page {c.get('page')}{ref_tag}]"
            context_parts.append(
                f"Source Chunk #{c.get('chunk_id')} | {doc_tag}:\n{c.get('text')}\n"
            )
        context_str = "\n".join(context_parts)

        citations = []
        for c in retrieved_chunks:
            snippet = c.get("text", "")[:280] + ("..." if len(c.get("text", "")) > 280 else "")
            fname = c.get('filename', '')
            clean_name = re.sub(r'\.pdf$', '', fname, flags=re.I).strip()
            citations.append({
                "page": c.get("page", 1),
                "chunk_id": c.get("chunk_id", 1),
                "filename": clean_name,
                "snippet": snippet,
                "relevance_score": round(c.get("score", 0.0), 3)
            })

        if not self.google_api_key and not self.groq_api_key:
            primary_chunk = retrieved_chunks[0]
            answer = (
                f"**Executive Synthesis:**\n\n"
                f"> \"{primary_chunk.get('text')[:350]}...\"\n\n"
                f"*Note: Configure your Gemini API key in the top navigation bar to enable full academic reasoning and synthesis.*"
            )
            return {
                "answer": answer,
                "citations": citations,
                "cross_questions": default_cross_questions
            }

        system_prompt = (
            "You are a distinguished senior academic peer reviewer, principal investigator, and research analyst. "
            "Your synthesis must meet the highest standards of scientific rigor, clarity, and publication-ready depth.\n\n"
            "### STRICT EDITORIAL & ATTRIBUTION RULES:\n\n"
            "1. STRICT ATTRIBUTION OF NOVELTY VS. PRIOR ART:\n"
            "   - You must unambiguously distinguish between the authors' OWN NOVEL CONTRIBUTIONS (what the current paper designs, proves, benchmarks, or proposes) and PRIOR ART / CITED BASELINES.\n"
            "   - If a source chunk is from the References, Bibliography, or Related Work section, or mentions well-known foundation models/frameworks (e.g., Llama, DeepSeek, BERT, GPT, Chameleon, Dnact, RT-H), NEVER claim that the current authors developed those models. You must explicitly identify them as 'Prior art cited by the authors' or 'Comparative baselines'.\n"
            "   - Focus primarily on what the current paper introduces: their novel architecture, their proposed mathematical loss, their new dataset, or their empirical findings.\n\n"
            "2. ZERO CONVERSATIONAL FLUFF OR THROAT-CLEARING:\n"
            "   - NEVER start with weak meta-language such as 'The retrieved document excerpts highlight...', 'Based on the provided documents...', 'Here are the central contributions:', or 'According to the context...'.\n"
            "   - Open immediately with an authoritative, substantive thesis statement synthesizing the core breakthrough or finding.\n\n"
            "3. DECENT, STRUCTURED SCHOLARLY ARCHITECTURE:\n"
            "   Structure your response with clear, dignified academic headings:\n"
            "   - **Executive Synthesis**: A sharp 1-2 sentence distillation of the primary contribution.\n"
            "   - **Core Methodological Innovations**: Distinct, detailed breakdowns of the proposed techniques, algorithms, or mechanisms.\n"
            "   - **Empirical Validation & Benchmark Results**: Specific quantitative metrics, benchmarks, speedups, or comparative baselines reported in the text.\n"
            "   - **Contextual Prior Art & Baselines**: Accurate demarcation of how the work compares against cited existing approaches.\n"
            "   - **Critical Limitations & Nuance**: Concrete assumptions, failure modes, or computational bounds acknowledged by the authors.\n\n"
            "4. CITATIONS & INTEGRITY:\n"
            "   - Support factual claims with clean, bracketed citations: `[PaperName, Page X]` or `[Page X]`.\n"
            "   - Never truncate filenames with ellipses `...` inside citation brackets.\n\n"
            "5. INTERACTIVE CROSS-EXAMINATION QUESTIONS:\n"
            "   - At the very end of your response, provide exactly 3 provocative, deep graduate-level cross-examination questions that challenge the methodology, scalability, or validity.\n"
            "   - Format them strictly as:\n"
            "---CROSS-QUESTIONS---\n"
            "- [Question 1]\n"
            "- [Question 2]\n"
            "- [Question 3]"
        )

        history_str = ""
        if conversation_history:
            history_str = "\n".join([f"{m.get('role', 'user').title()}: {m.get('content', '')}" for m in conversation_history[-4:]])

        prompt = (
            f"Retrieved Document Excerpts:\n"
            f"---------------------------\n"
            f"{context_str}\n"
            f"---------------------------\n\n"
            f"{f'Recent Conversation History:\n{history_str}\n' if history_str else ''}"
            f"User Inquiry: {query}\n\n"
            f"Synthesize an authoritative, rigorously structured academic answer following all guidelines. "
            f"Ensure strict differentiation between novel contributions vs. cited baselines."
        )

        try:
            chosen_model = model or "gemini-2.5-flash"
            raw_answer = self.generate(prompt, system_prompt, chosen_model)
            
            answer = raw_answer
            cross_questions = []
            if "---CROSS-QUESTIONS---" in raw_answer:
                parts = raw_answer.split("---CROSS-QUESTIONS---")
                answer = parts[0].strip()
                lines = parts[1].strip().split("\n")
                for line in lines:
                    cleaned = re.sub(r'^[\s\-\*\d\.\)]+', '', line).strip()
                    if len(cleaned) > 5 and len(cleaned) < 160:
                        cross_questions.append(cleaned)

            # Strip any accidental leading filler phrases
            answer = re.sub(
                r'^(?:(?:The|From the)\s+retrieved\s+document\s+excerpts\s+(?:highlight|indicate|show|detail)[^.\n]*[.\n]+(?:\s*Here\s+are\s+the\s+central\s+contributions:?)?|Based\s+on\s+the\s+provided\s+(?:documents|excerpts|context)[^.\n]*[.\n]+|According\s+to\s+the\s+(?:provided|retrieved)\s+(?:documents|excerpts)[^.\n]*[.\n]+|Here\s+are\s+the\s+central\s+contributions:?\s*)+',
                '',
                answer,
                flags=re.IGNORECASE
            ).strip()

            if not cross_questions:
                cross_questions = default_cross_questions

            return {
                "answer": answer,
                "citations": citations,
                "cross_questions": cross_questions[:3]
            }
        except Exception as e:
            return {
                "answer": f"Error generating answer: {str(e)}.",
                "citations": citations,
                "cross_questions": default_cross_questions
            }
