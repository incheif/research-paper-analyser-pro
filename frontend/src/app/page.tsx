'use client';

import { useState, useRef, useEffect } from 'react';
import styles from './page.module.css';

interface Citation {
  page: number;
  chunk_id?: number;
  filename?: string;
  snippet: string;
  relevance_score?: number;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  cross_questions?: string[];
  response_time?: number;
}

interface PaperBreakdown {
  title: string;
  authors: string;
  publication_venue: string;
  executive_summary: string;
  key_contributions: string[];
  methodology: string;
  results_and_benchmarks: string;
  limitations: string;
  bibtex: string;
  suggested_questions: string[];
}

interface PageData {
  page: number;
  text: string;
  char_count?: number;
}

interface Paper {
  paper_id: string;
  filename: string;
  total_pages: number;
  total_chunks: number;
  breakdown: PaperBreakdown;
  pages_data?: PageData[];
  pdfUrl?: string;
  has_pdf?: boolean;
}

interface HighlightSelection {
  text: string;
  top: number;
  left: number;
  page?: number;
}

const SAMPLE_DEMO_PAPERS: Paper[] = [
  {
    paper_id: 'demo-rag-survey-2024',
    filename: 'Retrieval_Augmented_Generation_Survey.pdf',
    total_pages: 14,
    total_chunks: 38,
    breakdown: {
      title: 'Retrieval-Augmented Generation for AI Reasoning: Architectures, Benchmarks, and Future Directions',
      authors: 'Alexander H. Wright, Elena Rostova, Marcus Vance, et al.',
      publication_venue: 'Journal of Artificial Intelligence Research (JAIR), 2024',
      executive_summary: 'This monograph provides a rigorous comparative synthesis of Retrieval-Augmented Generation (RAG) paradigms. It demonstrates that dense vector retrieval paired with cross-encoder re-ranking reduces factual hallucination rates by 42% on multi-hop reasoning tasks while keeping token consumption bounded within acceptable latency bounds.',
      key_contributions: [
        'Formal taxonomy distinguishing Naive, Advanced, and Modular RAG architectures.',
        'Context-Aware Adaptive Chunking algorithm minimizing semantic boundary fragmentation.',
        'Extensive benchmark on 12 domain-specific question-answering evaluation datasets.',
        'Theoretical latency-accuracy Pareto frontier for re-ranking models in real-time inference.'
      ],
      methodology: 'The evaluation establishes an open benchmark testing 4 retriever families (BM25, Dense Passage Retrieval, ColBERT, and Multi-vector Embeddings) across 15,000 queries. Retrieval chunks are scored on context relevance, grounded answer fidelity, and factual consistency using standardized rubric evaluations.',
      results_and_benchmarks: 'Modular RAG achieved 84.6% accuracy on the HalluEval corpus, outperforming zero-shot foundation models (52.1%) and standard vector RAG (71.3%). Latency overhead was limited to 110ms with ColBERT pruning.',
      limitations: 'Susceptibility to document retrieval poisoning attacks; quadratic compute costs during multi-hop iterative re-querying across corpus sizes exceeding 10M tokens.',
      bibtex: `@article{wright2024rag,\n  title={Retrieval-Augmented Generation for AI Reasoning: Architectures, Benchmarks, and Future Directions},\n  author={Wright, Alexander H. and Rostova, Elena and Vance, Marcus},\n  journal={Journal of Artificial Intelligence Research},\n  volume={79},\n  pages={101--148},\n  year={2024}\n}`,
      suggested_questions: [
        'How does Context-Aware Adaptive Chunking mitigate semantic loss?',
        'What were the empirical results of Modular RAG on HalluEval?',
        'What are the primary computational bottlenecks identified during multi-hop retrieval?'
      ]
    },
    pages_data: [
      {
        page: 1,
        text: 'Retrieval-Augmented Generation for AI Reasoning: Architectures, Benchmarks, and Future Directions\n\nAlexander H. Wright, Elena Rostova, Marcus Vance\n\nAbstract: Large Language Models (LLMs) continue to demonstrate remarkable generative prowess, yet persistent vulnerabilities to hallucinations and knowledge obsolescence impede high-stakes deployment. This paper synthesizes the state-of-the-art in Retrieval-Augmented Generation (RAG).'
      },
      {
        page: 2,
        text: '1. Introduction and Architectural Taxonomy\n\nModern knowledge-grounded systems are categorized into Naive, Advanced, and Modular RAG architectures. In Naive RAG, fixed-size token chunking often fractures logical coherence. In Advanced RAG, pre-retrieval query expansion and post-retrieval re-ranking mitigate retrieval noise.'
      },
      {
        page: 3,
        text: '2. Context-Aware Adaptive Chunking\n\nWe formulate an adaptive boundary algorithm that monitors semantic cosine similarity between adjacent paragraph embeddings. Chunks are dynamically split when similarity dips below a dynamic threshold theta, reducing semantic fragmentation by 34%.'
      },
      {
        page: 4,
        text: '3. Experimental Results & Benchmarks\n\nAcross 15,000 multi-hop questions, Modular RAG achieved 84.6% accuracy on HalluEval, outperforming baseline DPR (71.3%) and BM25 (61.2%). Cross-encoder re-ranking adds 110ms latency but improves precision by 28%.'
      }
    ]
  },
  {
    paper_id: 'demo-attention-scale-2024',
    filename: 'Attention_Mechanisms_Comparative_Study.pdf',
    total_pages: 18,
    total_chunks: 52,
    breakdown: {
      title: 'Scalable Attention Architectures: Linear, Flash, and Sparse Attention in Long-Context LLMs',
      authors: 'Devon Zhao, Sofia K. Lindqvist, Tariq Al-Mansoor',
      publication_venue: 'Conference on Neural Information Processing Systems (NeurIPS), 2024',
      executive_summary: 'A comprehensive study evaluating memory-bandwidth trade-offs across attention variants up to 128k token contexts. The authors demonstrate that IO-aware tiling in FlashAttention-3 yields up to 3.5x wall-clock speedups over standard multi-head attention without quality degradation.',
      key_contributions: [
        'GPU memory hierarchy profiling of quadratic vs. sub-quadratic attention kernels.',
        'Empirical verification of FlashAttention-3 throughput on Hopper FP8 Tensor Cores.',
        'Quantified perplexity drift across sliding-window and dilated sparse attention masks.'
      ],
      methodology: 'Benchmarking on 8x NVIDIA H100 clusters evaluating sequence lengths from 2k to 128k tokens across diverse matrix operations and multi-GPU tensor-parallel configurations.',
      results_and_benchmarks: 'FlashAttention-3 sustained 640 TFLOPs/s in FP16 and over 1.1 PFLOPs/s in FP8, reducing context ingestion overhead by 68% relative to FlashAttention-2.',
      limitations: 'Hardware dependence requiring modern tensor core architecture; numerical instability in FP8 low-precision under extreme outlier activations.',
      bibtex: `@inproceedings{zhao2024scalable,\n  title={Scalable Attention Architectures: Linear, Flash, and Sparse Attention in Long-Context LLMs},\n  author={Zhao, Devon and Lindqvist, Sofia K. and Al-Mansoor, Tariq},\n  booktitle={NeurIPS},\n  year={2024}\n}`,
      suggested_questions: [
        'How does FlashAttention-3 achieve 3.5x wall-clock speedup?',
        'What are the memory bottlenecks in sequences above 64k tokens?',
        'How does numerical instability manifest in FP8 attention?'
      ]
    },
    pages_data: [
      {
        page: 1,
        text: 'Scalable Attention Architectures: Linear, Flash, and Sparse Attention in Long-Context LLMs\n\nDevon Zhao, Sofia K. Lindqvist, Tariq Al-Mansoor\n\nAbstract: Processing extensive context windows in transformer models remains fundamentally constrained by memory bandwidth. This work systematically examines hardware-aware attention mechanisms.'
      },
      {
        page: 2,
        text: '1. Hardware Memory Hierarchy Bottlenecks\n\nStandard softmax attention computes an N x N matrix that exceeds on-chip SRAM capacity, triggering repeated High-Bandwidth Memory (HBM) IO roundtrips. FlashAttention mitigates this through block-tiling and online softmax rescaling.'
      },
      {
        page: 3,
        text: '2. FP8 Tensor Core Execution\n\nBy mapping attention blocks directly to Hopper FP8 Tensor Cores, FlashAttention-3 achieves over 1.1 PFLOPs/s while maintaining sub-0.05 perplexity drift compared to FP16 baselines.'
      }
    ]
  }
];

export default function Home() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [activePaperId, setActivePaperId] = useState<string>('all');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // View Layout Modes
  const [viewMode, setViewMode] = useState<'split' | 'chatgpt' | 'article'>('split');
  // Reader Sub-Modes: Editorial Digest, Original PDF Viewer, Page-by-Page Manuscript
  const [readerMode, setReaderMode] = useState<'digest' | 'pdf' | 'manuscript'>('digest');

  // Text Highlighting & Quoting
  const [highlightSelection, setHighlightSelection] = useState<HighlightSelection | null>(null);
  const [activeQuote, setActiveQuote] = useState<string | null>(null);

  // Settings & Modals
  const [showApiModal, setShowApiModal] = useState(false);
  const [geminiKey, setGeminiKey] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const [isNightMode, setIsNightMode] = useState(false);
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  // Load API keys from localStorage
  useEffect(() => {
    const savedGemini = localStorage.getItem('gemini_api_key') || '';
    const savedGroq = localStorage.getItem('groq_api_key') || '';
    const savedModel = localStorage.getItem('selected_model') || 'gemini-2.5-flash';
    const savedNight = localStorage.getItem('newspaper_night_mode') === 'true';

    if (savedGemini) setGeminiKey(savedGemini);
    if (savedGroq) setGroqKey(savedGroq);
    if (savedModel) setSelectedModel(savedModel);
    if (savedNight) {
      setIsNightMode(true);
      document.body.classList.add('night-mode');
    }
  }, []);

  // Text selection listener for highlighting sections
  useEffect(() => {
    const handleMouseUp = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;

      const text = sel.toString().trim();
      if (text.length > 8 && text.length < 1500) {
        try {
          const range = sel.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          setHighlightSelection({
            text,
            top: Math.max(12, rect.top + window.scrollY - 46),
            left: Math.max(12, rect.left + window.scrollX + (rect.width / 2) - 130)
          });
        } catch {
          // ignore selection errors
        }
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#floating-highlight-pill')) {
        setHighlightSelection(null);
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  const toggleNightMode = () => {
    const next = !isNightMode;
    setIsNightMode(next);
    localStorage.setItem('newspaper_night_mode', String(next));
    if (next) {
      document.body.classList.add('night-mode');
    } else {
      document.body.classList.remove('night-mode');
    }
  };

  const saveApiSettings = () => {
    localStorage.setItem('gemini_api_key', geminiKey.trim());
    localStorage.setItem('groq_api_key', groqKey.trim());
    localStorage.setItem('selected_model', selectedModel);
    setShowApiModal(false);
  };

  const handleFileUpload = async (fileList: FileList) => {
    if (!fileList || fileList.length === 0) return;

    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    const localPdfMap: Record<string, string> = {};

    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      if (f.name.toLowerCase().endsWith('.pdf')) {
        formData.append('files', f);
        try {
          localPdfMap[f.name] = URL.createObjectURL(f);
        } catch {
          // ignore blob error
        }
      }
    }

    try {
      const headers: Record<string, string> = {};
      if (geminiKey.trim()) headers['x-gemini-key'] = geminiKey.trim();
      if (groqKey.trim()) headers['x-groq-key'] = groqKey.trim();

      const res = await fetch('http://localhost:8000/api/upload', {
        method: 'POST',
        headers,
        body: formData
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Upload failed.');
      }

      const data = await res.json();
      const updatedPapers: Paper[] = data.papers.map((p: any) => ({
        ...p,
        pdfUrl: localPdfMap[p.filename] || `http://localhost:8000/api/paper/${p.paper_id}/pdf`
      }));

      setPapers(updatedPapers);
      setActivePaperId(data.active_paper_id || updatedPapers[0]?.paper_id || 'all');

      setMessages([
        {
          role: 'assistant',
          content: data.has_multiple
            ? `Indexed ${updatedPapers.length} research manuscripts. You can inspect individual papers or query the unified multi-document corpus. Click "Original PDF" to view the visual layout or highlight any passage to interrogate it.`
            : `Indexed "${updatedPapers[0]?.filename}" (${updatedPapers[0]?.total_pages} pages). High-speed vector index is active. Click "Original PDF" to view the manuscript or highlight any section to ask questions.`,
          cross_questions: [
            'What is the primary architectural innovation introduced?',
            'How do the benchmark results compare to established baselines?',
            'What critical limitations are documented in the paper?'
          ]
        }
      ]);
    } catch (err: any) {
      console.warn('Upload failed, falling back to local simulation:', err);
      setUploadError(err.message || 'Failed to connect to backend engine.');
    } finally {
      setIsUploading(false);
    }
  };

  const loadDemoPapers = () => {
    setPapers(SAMPLE_DEMO_PAPERS);
    setActivePaperId('all');
    setMessages([
      {
        role: 'assistant',
        content: `Loaded specimen research corpus with 2 publications: (1) "Retrieval-Augmented Generation for AI Reasoning" and (2) "Scalable Attention Architectures". Ask questions about individual techniques or compare both works below.`,
        citations: [
          { page: 1, filename: "Retrieval_Augmented_Generation_Survey.pdf", snippet: "Retrieval-Augmented Generation for AI Reasoning: Architectures, Benchmarks, and Future Directions. JAIR 2024.", relevance_score: 0.98 }
        ],
        cross_questions: [
          "Compare the computational bottlenecks between RAG re-ranking and attention memory IO.",
          "How does Context-Aware Adaptive Chunking compare to FlashAttention tiling?",
          "Synthesize the collective breakthroughs from both papers."
        ]
      }
    ]);
  };

  const handleSendMessage = async (customText?: string, highlightData?: { text: string; page?: number }) => {
    const textToSend = (customText || inputMessage).trim();
    if (!textToSend || papers.length === 0 || isGenerating) return;

    const quotingText = highlightData?.text || activeQuote;
    setInputMessage('');
    setActiveQuote(null);

    const displayMsg = quotingText
      ? `[Quoting Section]: "${quotingText.slice(0, 160)}${quotingText.length > 160 ? '...' : ''}"\n\n${textToSend}`
      : textToSend;

    const newMessages: Message[] = [...messages, { role: 'user', content: displayMsg }];
    setMessages(newMessages);
    setIsGenerating(true);

    const isDemo = papers.some(p => p.paper_id.startsWith('demo-'));
    if (isDemo && !geminiKey && !groqKey) {
      setTimeout(() => {
        let answer = "According to [Retrieval_Augmented_Generation_Survey, Page 4], hybrid vector-keyword retrieval reduces hallucinations by 42% on multi-hop benchmarks. Concurrently, [Attention_Mechanisms_Comparative_Study, Page 6] highlights that FlashAttention yields a 3.5x speedup by computing softmax tiling entirely in on-chip SRAM.";
        if (quotingText) {
          answer = `**Analysis of Highlighted Excerpt:**\n\n> "${quotingText}"\n\nThis section articulates a core methodological transition. By grounding attention matrix computations in high-bandwidth SRAM tiling, the architecture removes memory IO roundtrips, ensuring linear scalability without empirical perplexity loss.`;
        }
        setMessages([
          ...newMessages,
          {
            role: 'assistant',
            content: answer,
            citations: [
              { page: 2, filename: "Retrieval_Augmented_Generation_Survey", snippet: "Cross-encoder re-ranking introduces approximately 110ms latency overhead but improves top-3 precision by 28% on HalluEval.", relevance_score: 0.96 }
            ],
            cross_questions: [
              "What architectural trade-offs exist between ColBERT and Dense Passage Retrieval?",
              "How does memory bandwidth bottleneck standard multi-head attention?",
              "Can FlashAttention-3 be applied to sparse attention patterns?"
            ]
          }
        ]);
        setIsGenerating(false);
      }, 700);
      return;
    }

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (geminiKey.trim()) headers['x-gemini-key'] = geminiKey.trim();
      if (groqKey.trim()) headers['x-groq-key'] = groqKey.trim();

      const res = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          paper_id: activePaperId,
          message: textToSend,
          highlighted_text: quotingText || undefined,
          highlight_page: highlightData?.page || undefined,
          provider: selectedModel.includes('llama') ? 'groq' : 'gemini',
          model: selectedModel,
          api_key: geminiKey || groqKey,
          history: messages.slice(-4).map(m => ({ role: m.role, content: m.content }))
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Chat inference failed.');
      }

      const data = await res.json();
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: data.answer,
          citations: data.citations || [],
          cross_questions: data.cross_questions || [],
          response_time: data.response_time
        }
      ]);
    } catch (err: any) {
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: `Inference Notice: ${err.message || 'Failed to generate response.'}. Verify your Gemini API key in the top bar configuration.`,
          cross_questions: [
            "Check Gemini API key validity in Settings.",
            "Retry with Gemini 2.5 Flash.",
            "Inspect backend server logs on port 8000."
          ]
        }
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  // Actions for text highlighting
  const handleAskAboutHighlight = () => {
    if (!highlightSelection) return;
    setActiveQuote(highlightSelection.text);
    setInputMessage(`Analyze this excerpt: "${highlightSelection.text.slice(0, 100)}..."`);
    setHighlightSelection(null);
    if (viewMode === 'article') setViewMode('split');
    chatInputRef.current?.focus();
  };

  const handleExplainHighlight = () => {
    if (!highlightSelection) return;
    const textToExplain = highlightSelection.text;
    setHighlightSelection(null);
    if (viewMode === 'article') setViewMode('split');
    handleSendMessage(`Explain the technical implications, methodology, and significance of this passage: "${textToExplain}"`, { text: textToExplain });
  };

  const handleExportMarkdown = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paper_id: activePaperId,
          chat_history: messages.map(m => ({ role: m.role, content: m.content }))
        })
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Analysis_${activePaperId}.md`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      alert('Export failed. Check backend connection.');
    }
  };

  const currentPaper = papers.find(p => p.paper_id === activePaperId) || papers[0];

  return (
    <div className={styles.wrapper}>
      {/* Floating Section Highlight Popover */}
      {highlightSelection && (
        <div
          id="floating-highlight-pill"
          className={styles.floatingHighlightAction}
          style={{ top: highlightSelection.top, left: highlightSelection.left }}
        >
          <button
            className={styles.highlightBtn}
            onClick={handleAskAboutHighlight}
            title="Quote this highlighted text in chat"
          >
            💬 Ask About Selection
          </button>
          <button
            className={styles.highlightBtnSecondary}
            onClick={handleExplainHighlight}
            title="Immediately explain this passage"
          >
            ⚡ Explain Passage
          </button>
          <button
            className={styles.highlightBtnClose}
            onClick={() => setHighlightSelection(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Folio / Masthead Bar */}
      <header className={styles.masthead}>
        <div className={styles.topEarBar}>
          <div className={styles.earLeft}>
            <span>THE SCHOLARLY DISPATCH</span>
            <span className={styles.earDot}>•</span>
            <span>EST. 2026</span>
            <span className={styles.earDot}>•</span>
            <span className="badge badge-heavy">{selectedModel.toUpperCase()}</span>
          </div>
          <div className={styles.earRight}>
            <button className={styles.earBtn} onClick={toggleNightMode}>
              {isNightMode ? '☀ DAY MODE' : '☾ NIGHT'}
            </button>
            <span className={styles.earDot}>•</span>
            <button className={styles.earBtn} onClick={() => setShowApiModal(true)}>
              API CONFIG
            </button>
          </div>
        </div>

        <div className={styles.centerMasthead}>
          <h1 className={styles.newspaperLogo}>THE SCHOLARLY GAZETTE</h1>
          <p className={styles.newspaperTagline}>
            Monochromatic Literature Digest & Retrieval-Augmented Cross-Paper Research Platform
          </p>
        </div>

        {/* View Switcher Navigation */}
        <div className={styles.navBar}>
          <div className={styles.viewModeNav}>
            <button
              className={`${styles.viewModeBtn} ${viewMode === 'split' ? styles.viewModeBtnActive : ''}`}
              onClick={() => setViewMode('split')}
            >
              📰 Split View
            </button>
            <button
              className={`${styles.viewModeBtn} ${viewMode === 'chatgpt' ? styles.viewModeBtnActive : ''}`}
              onClick={() => setViewMode('chatgpt')}
            >
              💬 ChatGPT Mode
            </button>
            <button
              className={`${styles.viewModeBtn} ${viewMode === 'article' ? styles.viewModeBtnActive : ''}`}
              onClick={() => setViewMode('article')}
            >
              Article View
            </button>
          </div>

          <div className={styles.actionGroup}>
            {papers.length === 0 ? (
              <button
                className="btn btn-secondary btn-sm"
                onClick={loadDemoPapers}
                id="btn-demo-paper"
              >
                Sample Papers (2x)
              </button>
            ) : (
              <>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => fileInputRef.current?.click()}
                  title="Upload additional research papers"
                >
                  + Add Papers
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleExportMarkdown}
                  id="btn-export-markdown"
                >
                  Export Report
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className={styles.mainContainer}>
        {/* Upload State (Empty) */}
        {papers.length === 0 && (
          <section className={styles.uploadHero}>
            <span className="badge">Academic Literature Corpus</span>
            <h2 className={styles.heroHeadline}>
              Multi-Paper Research Analysis & Continuous Reading
            </h2>
            <p className={styles.heroDek}>
              Upload single or multiple research papers simultaneously. Examine individual monographs or perform comparative cross-document interrogations with grounded citations, native PDF viewing, and section-level highlight inquiries.
            </p>

            <div
              className={styles.dropzone}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files) handleFileUpload(e.dataTransfer.files);
              }}
              id="dropzone-area"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files) handleFileUpload(e.target.files);
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.75 }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
              </div>
              {isUploading ? (
                <>
                  <div className={styles.dropzoneTitle}>Parsing Documents & Constructing Vector Index...</div>
                  <div className={styles.dropzoneHint}>Indexing text across uploaded PDF manuscripts.</div>
                </>
              ) : (
                <>
                  <div className={styles.dropzoneTitle}>Select or Drag & Drop Multiple PDF Papers Here</div>
                  <div className={styles.dropzoneHint}>Upload 1, 2, or more manuscripts for single or cross-paper synthesis</div>
                </>
              )}
            </div>

            {uploadError && (
              <div style={{ color: 'var(--ink-heavy)', fontSize: '0.88rem', marginTop: '10px', fontWeight: 600 }}>
                Notice: {uploadError}
              </div>
            )}
          </section>
        )}

        {/* Papers Loaded State */}
        {papers.length > 0 && currentPaper && (
          <div>
            {/* Multi-Paper Tab Strip */}
            {papers.length > 1 && (
              <div className={styles.multiPaperStrip}>
                <button
                  className={`${styles.paperTab} ${activePaperId === 'all' ? styles.paperTabActive : ''}`}
                  onClick={() => setActivePaperId('all')}
                >
                  All {papers.length} Papers (Corpus Synthesis)
                </button>
                {papers.map((p, idx) => (
                  <button
                    key={p.paper_id}
                    className={`${styles.paperTab} ${activePaperId === p.paper_id ? styles.paperTabActive : ''}`}
                    onClick={() => setActivePaperId(p.paper_id)}
                    title={p.breakdown.title}
                  >
                    📄 Paper {idx + 1}: {p.filename.slice(0, 24)}...
                  </button>
                ))}
              </div>
            )}

            {/* Hidden Input for Additional File Uploads */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files) handleFileUpload(e.target.files);
              }}
            />

            {/* VIEW MODE 1: CHATGPT FULL-SCREEN FOCUS MODE */}
            {viewMode === 'chatgpt' && (
              <div className={styles.chatgptFocusLayout}>
                {/* Left Sidebar: Paper Library */}
                <aside className={styles.chatgptSidebar}>
                  <div className={styles.sidebarTitle}>Manuscript Library ({papers.length})</div>
                  <div className={styles.paperListNav}>
                    {papers.length > 1 && (
                      <button
                        className={`${styles.paperNavItem} ${activePaperId === 'all' ? styles.paperNavItemActive : ''}`}
                        onClick={() => setActivePaperId('all')}
                      >
                        All Papers (Corpus Search)
                      </button>
                    )}
                    {papers.map((p, idx) => (
                      <button
                        key={p.paper_id}
                        className={`${styles.paperNavItem} ${activePaperId === p.paper_id ? styles.paperNavItemActive : ''}`}
                        onClick={() => setActivePaperId(p.paper_id)}
                        title={p.breakdown.title}
                      >
                        📄 {idx + 1}. {p.filename.replace('.pdf', '')} ({p.total_pages}p)
                      </button>
                    ))}
                  </div>

                  <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--rule-border)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginBottom: '8px' }}>
                      ACTIVE MODEL: <strong>{selectedModel}</strong>
                    </div>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ width: '100%' }}
                      onClick={() => setViewMode('split')}
                    >
                      Switch to Split View
                    </button>
                  </div>
                </aside>

                {/* Main Conversational Workspace */}
                <section className={styles.chatgptContainer}>
                  <div className={styles.assistantHeader}>
                    <div className={styles.assistantTitle}>
                      Academic Co-Pilot: {activePaperId === 'all' ? 'Corpus Synthesis' : currentPaper.filename}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--ink-secondary)' }}>
                      Highlight any text in reader view to ask targeted questions
                    </div>
                  </div>

                  <div className={styles.chatFeed}>
                    {messages.map((m, idx) => (
                      <div
                        key={idx}
                        className={m.role === 'user' ? styles.msgUser : styles.msgAssistant}
                      >
                        <div className={styles.msgSender}>
                          {m.role === 'user' ? 'RESEARCH INQUIRY' : 'SCHOLARLY CO-PILOT'}
                        </div>
                        <div style={{ whiteSpace: 'pre-wrap' }}>
                          {m.content}
                        </div>

                        {/* Citations */}
                        {m.citations && m.citations.length > 0 && (
                          <div className={styles.citationsBox}>
                            <div className={styles.citationsTitle}>GROUNDED SOURCE CITATIONS:</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {m.citations.map((c, cIdx) => (
                                <button
                                  key={cIdx}
                                  className={styles.citationBadge}
                                  onClick={() => setSelectedCitation(c)}
                                  title={c.snippet}
                                >
                                  {c.filename ? `${c.filename.replace('.pdf', '')}, p.${c.page}` : `Page ${c.page}`}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Interactive Cross-Questions */}
                        {m.cross_questions && m.cross_questions.length > 0 && (
                          <div className={styles.crossQuestionsBox}>
                            <div className={styles.crossQuestionsLabel}>PROBING CROSS-EXAMINATION QUESTIONS:</div>
                            <div className={styles.crossQuestionsList}>
                              {m.cross_questions.map((q, qIdx) => (
                                <button
                                  key={qIdx}
                                  className={styles.crossQuestionPill}
                                  onClick={() => handleSendMessage(q)}
                                  title="Inquire this cross-question"
                                >
                                  → {q}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    <div ref={chatMessagesEndRef} />
                  </div>

                  {/* Active Quote banner */}
                  {activeQuote && (
                    <div className={styles.activeQuoteBox}>
                      <span className={styles.activeQuoteSnippet}>
                        <strong>Targeted Section:</strong> &ldquo;{activeQuote}&rdquo;
                      </span>
                      <button className={styles.activeQuoteDismiss} onClick={() => setActiveQuote(null)}>
                        ✕ Clear
                      </button>
                    </div>
                  )}

                  {/* Prompt Box */}
                  <div className={styles.chatInputForm}>
                    <textarea
                      ref={chatInputRef}
                      className={styles.chatInputField}
                      placeholder={activeQuote ? `Inquire about highlighted passage...` : `Ask about methodology, theoretical baselines, or limitations...`}
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      rows={2}
                    />
                    <button
                      className="btn btn-primary"
                      onClick={() => handleSendMessage()}
                      disabled={isGenerating || !inputMessage.trim()}
                    >
                      {isGenerating ? 'Analyzing...' : 'Inquire'}
                    </button>
                  </div>
                </section>
              </div>
            )}

            {/* VIEW MODE 2 & 3: SPLIT VIEW OR ARTICLE VIEW */}
            {viewMode !== 'chatgpt' && (
              <div className={viewMode === 'split' ? styles.editorialGrid : styles.storyColumn}>
                {/* Left Column: Reader & Digest */}
                <article className={styles.storyColumn}>
                  {/* Headline & Metadata */}
                  <div className={styles.articleHeader}>
                    <div className={styles.articleCategory}>SCHOLARLY MONOGRAPH</div>
                    <h2 className={styles.articleHeadline}>{currentPaper.breakdown.title}</h2>
                    <div className={styles.bylineStrip}>
                      <span className={styles.authorAffiliation}>INVESTIGATORS: {currentPaper.breakdown.authors}</span>
                      <span className={styles.authorAffiliation}>VENUE: {currentPaper.breakdown.publication_venue}</span>
                    </div>
                  </div>

                  {/* Reader Sub-Navigation Tabs */}
                  <div className={styles.readerSubNav}>
                    <div className={styles.readerTabGroup}>
                      <button
                        className={`${styles.readerTab} ${readerMode === 'digest' ? styles.readerTabActive : ''}`}
                        onClick={() => setReaderMode('digest')}
                      >
                        EDITORIAL DIGEST
                      </button>
                      <button
                        className={`${styles.readerTab} ${readerMode === 'pdf' ? styles.readerTabActive : ''}`}
                        onClick={() => setReaderMode('pdf')}
                      >
                        ORIGINAL PDF
                      </button>
                      <button
                        className={`${styles.readerTab} ${readerMode === 'manuscript' ? styles.readerTabActive : ''}`}
                        onClick={() => setReaderMode('manuscript')}
                      >
                        MANUSCRIPT PAGES ({currentPaper.pages_data?.length || currentPaper.total_pages}P)
                      </button>
                    </div>

                    <div className={styles.readerHint}>
                      Highlight text to ask Co-Pilot
                    </div>
                  </div>

                  {/* SUB-VIEW 1: ORIGINAL PDF EMBEDDED VIEWER */}
                  {readerMode === 'pdf' && (
                    <div>
                      <div className={styles.pdfNotice}>
                        <span>Viewing: <strong>{currentPaper.filename}</strong></span>
                        {currentPaper.pdfUrl && (
                          <a
                            href={currentPaper.pdfUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: 'var(--ink-heavy)', textDecoration: 'underline' }}
                          >
                            Open in New Window ↗
                          </a>
                        )}
                      </div>
                      <div className={styles.pdfViewerWrapper}>
                        {currentPaper.pdfUrl ? (
                          <object
                            data={currentPaper.pdfUrl}
                            type="application/pdf"
                            className={styles.pdfIframe}
                          >
                            <p style={{ color: '#fff', padding: '20px' }}>
                              PDF viewer plugin not detected. <a href={currentPaper.pdfUrl} target="_blank" style={{ color: '#fff', textDecoration: 'underline' }}>Click here to view PDF directly</a> or switch to the Manuscript Pages tab.
                            </p>
                          </object>
                        ) : (
                          <div style={{ color: '#fff', padding: '40px', textAlign: 'center' }}>
                            PDF document stream initializing. Switch to "Manuscript Pages" to inspect full text.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* SUB-VIEW 2: PAGE-BY-PAGE MANUSCRIPT READER */}
                  {readerMode === 'manuscript' && (
                    <div className={styles.manuscriptContainer}>
                      {currentPaper.pages_data && currentPaper.pages_data.length > 0 ? (
                        currentPaper.pages_data.map((pageInfo) => (
                          <div key={pageInfo.page} className={styles.manuscriptPage}>
                            <div className={styles.manuscriptPageHeader}>
                              <span>Page {pageInfo.page} of {currentPaper.total_pages}</span>
                              <span>Select text to ask questions</span>
                            </div>
                            <div className={styles.manuscriptPageText}>
                              {pageInfo.text}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div style={{ padding: '30px', textAlign: 'center', color: 'var(--ink-muted)' }}>
                          Manuscript page text is indexed. Highlight text anywhere in the summary or view original PDF.
                        </div>
                      )}
                    </div>
                  )}

                  {/* SUB-VIEW 3: EDITORIAL DIGEST (EXECUTIVE SUMMARY & METHODOLOGY) */}
                  {readerMode === 'digest' && (
                    <>
                      {/* Executive Summary */}
                      <section className={styles.storySection}>
                        <h3 className={styles.sectionHeading}>I. Executive Synthesis</h3>
                        <p className={styles.leadParagraph}>{currentPaper.breakdown.executive_summary}</p>
                      </section>

                      {/* Key Contributions */}
                      <section className={styles.storySection}>
                        <h3 className={styles.sectionHeading}>II. Primary Methodological Innovations</h3>
                        <ul className={styles.contributionList}>
                          {currentPaper.breakdown.key_contributions.map((c, i) => (
                            <li key={i} className={styles.contributionItem}>
                              <span className={styles.contributionIndex}>0{i + 1}.</span>
                              <span className={styles.contributionText}>{c}</span>
                            </li>
                          ))}
                        </ul>
                      </section>

                      {/* Methodology */}
                      <section className={styles.storySection}>
                        <h3 className={styles.sectionHeading}>III. Theoretical Architecture & Implementation</h3>
                        <div className={styles.storyBody} style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                          {currentPaper.breakdown.methodology}
                        </div>
                      </section>

                      {/* Experimental Results */}
                      <section className={styles.storySection}>
                        <h3 className={styles.sectionHeading}>IV. Empirical Benchmarks & Findings</h3>
                        <div className={styles.storyBody} style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                          {currentPaper.breakdown.results_and_benchmarks}
                        </div>
                      </section>

                      {/* Limitations */}
                      <section className={styles.storySection}>
                        <h3 className={styles.sectionHeading}>V. Critical Limitations & Scope</h3>
                        <div className={styles.storyBody} style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                          {currentPaper.breakdown.limitations}
                        </div>
                      </section>

                      {/* BibTeX Citation */}
                      {currentPaper.breakdown.bibtex && (
                        <section className={styles.storySection}>
                          <h3 className={styles.sectionHeading}>Archival BibTeX Citation</h3>
                          <pre className={styles.bibtexBox}>{currentPaper.breakdown.bibtex}</pre>
                        </section>
                      )}
                    </>
                  )}
                </article>

                {/* Right Column: Scholarly Co-Pilot Chat (In Split View) */}
                {viewMode === 'split' && (
                  <aside className={styles.assistantColumn}>
                    <div className={styles.assistantHeader}>
                      <div>
                        <div className={styles.assistantTitle}>GROUNDED SCHOLARLY CO-PILOT</div>
                        <div className={styles.assistantSub}>RAG with Citation Excerpts</div>
                      </div>
                    </div>

                    <div className={styles.chatFeed}>
                      {messages.map((m, idx) => (
                        <div
                          key={idx}
                          className={m.role === 'user' ? styles.msgUser : styles.msgAssistant}
                        >
                          <div className={styles.msgSender}>
                            {m.role === 'user' ? 'RESEARCH INQUIRY' : 'SCHOLARLY CO-PILOT'}
                          </div>
                          <div style={{ whiteSpace: 'pre-wrap' }}>
                            {m.content}
                          </div>

                          {/* Citations */}
                          {m.citations && m.citations.length > 0 && (
                            <div className={styles.citationsBox}>
                              <div className={styles.citationsTitle}>GROUNDED SOURCES:</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {m.citations.map((c, cIdx) => (
                                  <button
                                    key={cIdx}
                                    className={styles.citationBadge}
                                    onClick={() => setSelectedCitation(c)}
                                    title={c.snippet}
                                  >
                                    {c.filename ? `${c.filename.replace('.pdf', '')}, p.${c.page}` : `Page ${c.page}`}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Interactive Cross-Questions */}
                          {m.cross_questions && m.cross_questions.length > 0 && (
                            <div className={styles.crossQuestionsBox}>
                              <div className={styles.crossQuestionsLabel}>FOLLOW-UP CROSS QUESTIONS:</div>
                              <div className={styles.crossQuestionsList}>
                                {m.cross_questions.map((q, qIdx) => (
                                  <button
                                    key={qIdx}
                                    className={styles.crossQuestionPill}
                                    onClick={() => handleSendMessage(q)}
                                    title="Click to interrogate this question"
                                  >
                                    → {q}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      <div ref={chatMessagesEndRef} />
                    </div>

                    {/* Active Quote banner */}
                    {activeQuote && (
                      <div className={styles.activeQuoteBox}>
                        <span className={styles.activeQuoteSnippet}>
                          <strong>Quoted:</strong> &ldquo;{activeQuote}&rdquo;
                        </span>
                        <button className={styles.activeQuoteDismiss} onClick={() => setActiveQuote(null)}>
                          ✕
                        </button>
                      </div>
                    )}

                    {/* Prompt Box */}
                    <div className={styles.chatInputForm}>
                      <textarea
                        ref={chatInputRef}
                        className={styles.chatInputField}
                        placeholder={activeQuote ? `Inquire about highlighted passage...` : `Ask about methodology, benchmarks, or limitations...`}
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        rows={2}
                      />
                      <button
                        className="btn btn-primary"
                        onClick={() => handleSendMessage()}
                        disabled={isGenerating || !inputMessage.trim()}
                      >
                        {isGenerating ? 'Analyzing...' : 'Inquire'}
                      </button>
                    </div>
                  </aside>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Citation Footnote Excerpt Modal */}
      {selectedCitation && (
        <div className={styles.modalBackdrop} onClick={() => setSelectedCitation(null)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <span className="badge badge-heavy">
                  {selectedCitation.filename ? `${selectedCitation.filename}, Page ${selectedCitation.page}` : `Page ${selectedCitation.page}`}
                </span>
                <h3 className={styles.modalTitle} style={{ marginTop: '4px' }}>Archival Excerpt</h3>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedCitation(null)}>✕</button>
            </div>

            <div className={styles.excerptContent}>
              &ldquo;{selectedCitation.snippet}&rdquo;
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {selectedCitation.relevance_score && (
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.74rem', textTransform: 'uppercase', color: 'var(--ink-muted)' }}>
                  Relevance: <strong>{(selectedCitation.relevance_score * 100).toFixed(0)}%</strong>
                </div>
              )}
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedCitation(null)}>
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* API Key Configuration Modal */}
      {showApiModal && (
        <div className={styles.modalBackdrop} onClick={() => setShowApiModal(false)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>API Key Configuration</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowApiModal(false)}>✕</button>
            </div>

            <p style={{ fontFamily: 'var(--font-reading)', fontSize: '0.88rem', color: 'var(--ink-secondary)' }}>
              Configure your model provider and credentials. API keys are cached locally in your browser session.
            </p>

            <div className={styles.formField}>
              <label className={styles.formLabel}>Selected LLM Engine</label>
              <select
                className={styles.formSelect}
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
              >
                <option value="gemini-2.5-flash">Google Gemini 2.5 Flash (Recommended & Fastest)</option>
                <option value="gemini-2.5-pro">Google Gemini 2.5 Pro (Deep Mathematical Reasoning)</option>
                <option value="gemini-flash-latest">Google Gemini Flash Latest</option>
                <option value="llama-3.3-70b-versatile">Groq Llama 3.3 70B (High-Speed Inference)</option>
                <option value="llama3-8b-8192">Groq Llama 3 8B</option>
              </select>
            </div>

            <div className={styles.formField}>
              <label className={styles.formLabel}>
                Google Gemini API Key
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'var(--ink-heavy)', marginLeft: '8px', fontSize: '0.74rem', textDecoration: 'underline' }}
                >
                  Get free key ↗
                </a>
              </label>
              <input
                type="password"
                className={styles.formInput}
                placeholder="AIzaSy... or AQ...."
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
              />
            </div>

            <div className={styles.formField}>
              <label className={styles.formLabel}>
                Groq API Key (Optional)
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'var(--ink-heavy)', marginLeft: '8px', fontSize: '0.74rem', textDecoration: 'underline' }}
                >
                  Get free key ↗
                </a>
              </label>
              <input
                type="password"
                className={styles.formInput}
                placeholder="gsk_..."
                value={groqKey}
                onChange={(e) => setGroqKey(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowApiModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary btn-sm" onClick={saveApiSettings}>
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
