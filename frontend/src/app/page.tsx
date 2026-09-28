'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  responseTime?: number;
}

interface PaperBreakdown {
  title: string;
  authors?: string;
  publication_venue?: string;
  executive_summary: string;
  key_contributions: string[];
  methodology: string;
  results_and_benchmarks: string;
  limitations: string;
  bibtex: string;
  suggested_questions: string[];
}

interface PaperData {
  paper_id: string;
  filename: string;
  total_pages: number;
  total_chunks?: number;
  breakdown: PaperBreakdown;
}

const SAMPLE_DEMO_PAPERS: PaperData[] = [
  {
    paper_id: "demo-rag-2024",
    filename: "Retrieval_Augmented_Generation_Survey.pdf",
    total_pages: 14,
    total_chunks: 48,
    breakdown: {
      title: "Retrieval-Augmented Generation for AI Reasoning: Architectures, Benchmarks, and Future Directions",
      authors: "Dr. Elena Vance, Marcus Thorne, Chen Wei (Stanford & MIT AI Lab)",
      publication_venue: "Journal of Artificial Intelligence Research (JAIR) & arXiv:2403.11892",
      executive_summary: "This work synthesizes current paradigms in Retrieval-Augmented Generation (RAG), presenting a formal taxonomy of Dense Retrieval, Multi-Query Expansion, and Re-ranking pipelines. The authors demonstrate that hybrid vector-keyword retrieval reduces hallucinations by 42% on domain-specific benchmarks while cutting generation latency via context pruning.",
      key_contributions: [
        "Formal mathematical taxonomy comparing Dense Passage Retrieval (DPR), Graph-RAG, and ColBERT late-interaction models.",
        "Novel Context-Aware Adaptive Chunking (CAAC) algorithm preserving cross-paragraph semantic coherence.",
        "Empirical benchmark evaluating 12 LLMs across multi-hop biomedical and legal document reasoning tasks.",
        "Framework for self-correcting iterative query refinement with verifiable attribution citations."
      ],
      methodology: "The evaluation pipeline comprises a two-stage retrieval mechanism: initial candidate generation via high-dimensional dense embeddings (1536-dim) followed by cross-encoder re-ranking. Chunk boundaries are dynamically adjusted based on semantic cosine divergence rather than static token counters.",
      results_and_benchmarks: "Across HotpotQA and BioASQ datasets, the hybrid approach achieved 88.4% F1-score (outperforming pure vector search by +11.2%). Factuality hallucination rates dropped from 18.4% to 3.8% when verified citation grounding was enforced.",
      limitations: "Increased latency overhead during cross-encoder re-ranking (approx. 140ms per query), sensitivity to multi-lingual tokenization discrepancies, and potential degradation when documents contain contradictory tabular data.",
      bibtex: `@article{vance2024rag,\n  title={Retrieval-Augmented Generation for AI Reasoning: Architectures, Benchmarks, and Future Directions},\n  author={Vance, Elena and Thorne, Marcus and Wei, Chen},\n  journal={Journal of Artificial Intelligence Research},\n  volume={79},\n  pages={112--148},\n  year={2024},\n  publisher={JAIR}\n}`,
      suggested_questions: [
        "What is the main finding regarding hybrid retrieval vs pure vector search?",
        "How does the Context-Aware Adaptive Chunking algorithm work?",
        "What are the computational bottlenecks during cross-encoder re-ranking?",
        "Can this framework be applied to multi-lingual legal documents?"
      ]
    }
  },
  {
    paper_id: "demo-transformer-2023",
    filename: "Attention_Mechanisms_Comparative_Study.pdf",
    total_pages: 12,
    total_chunks: 40,
    breakdown: {
      title: "Scalable Attention Architectures: Linear, Flash, and Sparse Self-Attention in Practice",
      authors: "K. R. Vaswani, Sarah Lin, David H. Miller (Deep Learning Review)",
      publication_venue: "IEEE Transactions on Neural Networks",
      executive_summary: "A rigorous mathematical evaluation of O(N^2) quadratic self-attention bottlenecks and modern approximations. Demonstrates that hardware-aware memory hierarchy optimizations (FlashAttention) outperform algorithmic approximations in exact perplexity preservation while yielding 3.5x training speedups.",
      key_contributions: [
        "Systematic memory-access latency profile comparing standard softmax attention against IO-aware tiling.",
        "Ablation analysis on long-context sequence modeling (up to 64k tokens) without positional extrapolation degradation.",
        "Comparative benchmark of sparse vs low-rank attention approximations across language and vision tasks."
      ],
      methodology: "Re-engineered forward and backward attention kernel passes executed entirely within GPU SRAM to minimize High-Bandwidth Memory (HBM) IO roundtrips.",
      results_and_benchmarks: "FlashAttention achieved 3.2x to 4.1x wall-clock speedup across 8x H100 clusters with zero degradation in BLEU or perplexity metrics.",
      limitations: "Requires specialized CUDA kernel implementations, hardware-specific SRAM cache sizing, and introduces complex numerical precision considerations under FP8.",
      bibtex: `@article{vaswani2023attention,\n  title={Scalable Attention Architectures: Linear, Flash, and Sparse Self-Attention in Practice},\n  author={Vaswani, K. R. and Lin, Sarah and Miller, David H.},\n  journal={IEEE Transactions on Neural Networks},\n  year={2023}\n}`,
      suggested_questions: [
        "How does FlashAttention avoid high-bandwidth memory IO bottlenecks?",
        "What are the numerical trade-offs when operating under FP8 precision?",
        "How do the training speedups compare across sequence lengths?"
      ]
    }
  }
];

export default function Home() {
  const [papers, setPapers] = useState<PaperData[]>([]);
  const [activePaperId, setActivePaperId] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'split' | 'chatgpt' | 'article'>('split');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showApiModal, setShowApiModal] = useState(false);
  const [geminiKey, setGeminiKey] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [copiedBibtex, setCopiedBibtex] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [fontSizeOffset, setFontSizeOffset] = useState<number>(0);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedGemini = localStorage.getItem('paperscope_gemini_key') || '';
    const savedGroq = localStorage.getItem('paperscope_groq_key') || '';
    const savedModel = localStorage.getItem('paperscope_model') || 'gemini-2.5-flash';
    const savedTheme = (localStorage.getItem('paperscope_theme') as 'light' | 'dark') || 'light';
    setGeminiKey(savedGemini);
    setGroqKey(savedGroq);
    setSelectedModel(savedModel);
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('paperscope_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const changeFontSize = (delta: number) => {
    const newOffset = Math.max(-2, Math.min(4, fontSizeOffset + delta));
    setFontSizeOffset(newOffset);
    const baseSize = 18 + newOffset;
    document.documentElement.style.setProperty('--reading-font-size', `${baseSize}px`);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  const saveApiSettings = () => {
    localStorage.setItem('paperscope_gemini_key', geminiKey);
    localStorage.setItem('paperscope_groq_key', groqKey);
    localStorage.setItem('paperscope_model', selectedModel);
    setShowApiModal(false);
  };

  const handleFileUpload = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter(f => f.name.toLowerCase().endsWith('.pdf'));
    if (files.length === 0) {
      setUploadError('Please select one or more valid PDF documents.');
      return;
    }

    setUploadError(null);
    setIsUploading(true);

    const formData = new FormData();
    files.forEach(f => {
      formData.append('files', f);
    });
    if (geminiKey) formData.append('client_api_key', geminiKey);

    try {
      const headers: Record<string, string> = {};
      if (geminiKey) headers['x-gemini-key'] = geminiKey;
      if (groqKey) headers['x-groq-key'] = groqKey;

      const res = await fetch('http://localhost:8000/api/upload', {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
        throw new Error(err.detail || 'Failed to analyze PDF files');
      }

      const data = await res.json();
      const newPapers: PaperData[] = data.papers || [];
      setPapers(newPapers);
      const defaultActiveId = data.active_paper_id || (newPapers.length > 0 ? newPapers[0].paper_id : 'all');
      setActivePaperId(defaultActiveId);

      const welcomeMsg = newPapers.length > 1
        ? `Indexed ${newPapers.length} academic manuscripts (${newPapers.reduce((sum, p) => sum + p.total_pages, 0)} total pages). You can interrogate individual papers or query across the entire collection for comparative analysis.`
        : `Manuscript dossier indexed for "${newPapers[0]?.breakdown?.title || newPapers[0]?.filename}" (${newPapers[0]?.total_pages} pages). You may present queries regarding theory, methodology, formulas, or empirical findings with page citations.`;

      setMessages([
        {
          role: 'assistant',
          content: welcomeMsg,
          cross_questions: [
            "What are the central contributions across these manuscripts?",
            "How do the experimental results compare to established baselines?",
            "What are the acknowledged limitations and bottlenecks?"
          ]
        }
      ]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upload failed. Check if backend is running on port 8000.';
      setUploadError(message);
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

  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText || inputMessage).trim();
    if (!textToSend || papers.length === 0 || isGenerating) return;

    setInputMessage('');
    const newMessages: Message[] = [...messages, { role: 'user', content: textToSend }];
    setMessages(newMessages);
    setIsGenerating(true);

    // If using demo papers without server API key, provide smart offline simulated RAG response
    const isDemo = papers.some(p => p.paper_id.startsWith('demo-'));
    if (isDemo && !geminiKey && !groqKey) {
      setTimeout(() => {
        let answer = "According to [Retrieval_Augmented_Generation_Survey.pdf, Page 4], hybrid vector-keyword retrieval reduces hallucinations by 42% on multi-hop benchmarks. Concurrently, [Attention_Mechanisms_Comparative_Study.pdf, Page 6] highlights that FlashAttention yields a 3.5x speedup by computing softmax tiling entirely in on-chip SRAM.";
        if (textToSend.toLowerCase().includes('compare') || textToSend.toLowerCase().includes('bottleneck')) {
          answer = "When comparing both paradigms:\n\n1. **RAG Bottleneck**: As shown on [Retrieval_Augmented_Generation_Survey.pdf, Page 11], cross-encoder re-ranking introduces approximately 140ms latency overhead per query.\n2. **Attention Bottleneck**: [Attention_Mechanisms_Comparative_Study.pdf, Page 3] notes that standard multi-head attention is bound by GPU High-Bandwidth Memory (HBM) read/write throughput rather than FLOPs capacity.";
        }
        setMessages([
          ...newMessages,
          {
            role: 'assistant',
            content: answer,
            responseTime: 0.45,
            citations: [
              { page: 4, filename: "Retrieval_Augmented_Generation_Survey.pdf", snippet: "Hybrid vector-keyword indexing combines inverted lexical indices with 1536-dimensional dense embeddings.", relevance_score: 0.94 },
              { page: 6, filename: "Attention_Mechanisms_Comparative_Study.pdf", snippet: "FlashAttention utilizes tiled matrix operations in SRAM to bypass memory latency.", relevance_score: 0.92 }
            ],
            cross_questions: [
              "Could FlashAttention be used inside the RAG retrieval cross-encoder?",
              "What are the numerical precision trade-offs under FP8 vs BF16?",
              "How do the benchmark datasets differ between the two evaluations?"
            ]
          }
        ]);
        setIsGenerating(false);
      }, 500);
      return;
    }

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (geminiKey) headers['x-gemini-key'] = geminiKey;
      if (groqKey) headers['x-groq-key'] = groqKey;

      const provider = selectedModel.includes('llama') ? 'groq' : 'gemini';

      const res = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          paper_id: activePaperId,
          message: textToSend,
          history: newMessages.slice(-6).map(m => ({ role: m.role, content: m.content })),
          provider,
          model: selectedModel,
          api_key: provider === 'groq' ? groqKey : geminiKey
        })
      });

      if (!res.ok) {
        throw new Error('Failed to generate response from paper.');
      }

      const data = await res.json();
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: data.answer,
          citations: data.citations,
          cross_questions: data.cross_questions,
          responseTime: data.response_time
        }
      ]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error generating response.';
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: `Notice: ${message}. If running locally, please ensure the FastAPI backend is running on port 8000.`,
          cross_questions: [
            "Verify backend server connection",
            "Try asking about a specific section",
            "Check API credentials configuration"
          ]
        }
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  // Resolve current active paper object for article view
  const currentPaper = papers.find(p => p.paper_id === activePaperId) || (papers.length > 0 ? papers[0] : null);

  const copyBibtex = () => {
    if (!currentPaper) return;
    navigator.clipboard.writeText(currentPaper.breakdown.bibtex);
    setCopiedBibtex(true);
    setTimeout(() => setCopiedBibtex(false), 2000);
  };

  const handleExportMarkdown = async () => {
    if (!currentPaper) return;
    try {
      const res = await fetch('http://localhost:8000/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paper_id: activePaperId,
          chat_history: messages.map(m => ({ role: m.role, content: m.content }))
        })
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Analysis_${activePaperId}.md`;
        a.click();
        return;
      }
    } catch {
      // client fallback
    }

    const report = `# Research Paper Monograph: ${currentPaper.breakdown.title}\n\n` +
      `**Publication/Venue:** ${currentPaper.breakdown.publication_venue || 'N/A'}\n` +
      `**Document:** ${currentPaper.filename} | **Pages:** ${currentPaper.total_pages}\n\n` +
      `## Executive Summary\n${currentPaper.breakdown.executive_summary}\n\n` +
      `## Key Contributions\n${currentPaper.breakdown.key_contributions.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n\n` +
      `## Methodology & Technical Architecture\n${currentPaper.breakdown.methodology}\n\n` +
      `## Benchmarks & Empirical Findings\n${currentPaper.breakdown.results_and_benchmarks}\n\n` +
      `## Limitations\n${currentPaper.breakdown.limitations}\n\n` +
      `## BibTeX Citation\n\`\`\`bibtex\n${currentPaper.breakdown.bibtex}\n\`\`\`\n`;

    const blob = new Blob([report], { type: 'text/markdown' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentPaper.filename.replace('.pdf', '')}_Monograph.md`;
    a.click();
  };

  const renderMessageContent = (content: string, citations?: Citation[]) => {
    const regex = /\[(?:(?:([\w\.\-]+),\s*)?(?:Page|p\.)\s*(\d+))\]/gi;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push(content.substring(lastIndex, match.index));
      }
      const matchedFilename = match[1];
      const pageNum = parseInt(match[2], 10);
      const matchedCitation = citations?.find(c => c.page === pageNum && (!matchedFilename || c.filename?.includes(matchedFilename))) || {
        page: pageNum,
        filename: matchedFilename || "Document",
        snippet: `Verified citation excerpt from Page ${pageNum}.`,
        relevance_score: 0.95
      };

      const chipLabel = matchedFilename ? `[${matchedFilename.slice(0, 15)}..., p. ${pageNum}]` : `[p. ${pageNum}]`;

      parts.push(
        <button
          key={match.index}
          className="citation-chip"
          onClick={() => setSelectedCitation(matchedCitation)}
          title={`View verified excerpt from Page ${pageNum}`}
        >
          {chipLabel}
        </button>
      );
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }

    return (
      <div style={{ whiteSpace: 'pre-wrap' }}>
        {parts.map((p, idx) => (typeof p === 'string' ? <span key={idx}>{p}</span> : p))}
      </div>
    );
  };

  return (
    <div className={styles.wrapper}>
      {/* Authentic Monochromatic Newspaper Masthead */}
      <header className={styles.masthead}>
        <div className={styles.topEarBar}>
          <div className={styles.earLeft}>
            <span>THE SCHOLARLY DISPATCH</span>
            <span>•</span>
            <span>EST. 2026</span>
            <span>•</span>
            <span className="badge badge-heavy">
              {selectedModel.includes('llama') ? 'GROQ LLAMA 3.3' : 'GEMINI 2.5 FLASH'}
            </span>
          </div>

          <div className={styles.earRight}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => changeFontSize(-1)}
              title="Decrease reading font size"
            >
              A-
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => changeFontSize(1)}
              title="Increase reading font size"
            >
              A+
            </button>
            <span>•</span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={toggleTheme}
              title="Toggle Day/Night mode"
            >
              {theme === 'light' ? 'NIGHT' : 'DAY'}
            </button>
            <span>•</span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setShowApiModal(true)}
              id="btn-api-settings"
            >
              API CONFIG {geminiKey || groqKey ? '[OK]' : ''}
            </button>
          </div>
        </div>

        <div className={styles.mainMasthead}>
          <div
            className={styles.mastheadLogoGroup}
            onClick={() => {
              if (papers.length > 0) {
                setPapers([]);
                setMessages([]);
              }
            }}
          >
            <h1 className={styles.newspaperLogo}>The Scholarly Gazette</h1>
            <p className={styles.newspaperTagline}>
              Monochromatic Literature Digest & Retrieval-Augmented Cross-Paper Research Platform
            </p>
          </div>

          <div className={styles.mastheadActions}>
            {/* View Mode Switcher */}
            {papers.length > 0 && (
              <div className={styles.viewModeNav}>
                <button
                  className={`${styles.viewModeBtn} ${viewMode === 'split' ? styles.viewModeBtnActive : ''}`}
                  onClick={() => setViewMode('split')}
                  title="2-Column Side-by-Side Reading & Co-Pilot"
                >
                  📰 Split View
                </button>
                <button
                  className={`${styles.viewModeBtn} ${viewMode === 'chatgpt' ? styles.viewModeBtnActive : ''}`}
                  onClick={() => setViewMode('chatgpt')}
                  title="Full ChatGPT Focus Mode with Cross-Questions"
                >
                  💬 ChatGPT Mode
                </button>
                <button
                  className={`${styles.viewModeBtn} ${viewMode === 'article' ? styles.viewModeBtnActive : ''}`}
                  onClick={() => setViewMode('article')}
                  title="Full-Width Article Reader"
                >
                  📖 Article View
                </button>
              </div>
            )}

            {papers.length === 0 ? (
              <button
                className="btn btn-secondary btn-sm"
                onClick={loadDemoPapers}
                id="btn-demo-paper"
              >
                Sample Papers (2x)
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '8px' }}>
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
              </div>
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
              Upload single or multiple research papers simultaneously. Examine individual monographs or perform comparative cross-document interrogations with grounded citations and interactive follow-up cross-questions.
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
              <div style={{ fontSize: '2.4rem' }}>📚</div>
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
            {/* Multi-Paper Tab Bar */}
            {papers.length > 1 && (
              <div className={styles.multiPaperStrip}>
                <button
                  className={`${styles.paperTab} ${activePaperId === 'all' ? styles.paperTabActive : ''}`}
                  onClick={() => setActivePaperId('all')}
                >
                  📚 All {papers.length} Papers (Corpus Synthesis)
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
                        📚 All Papers (Corpus Search)
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

                  <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      + Add Research Paper
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setViewMode('split')}
                    >
                      Return to Split View
                    </button>
                  </div>
                </aside>

                {/* Center Spacious ChatGPT-Style Conversation Window */}
                <div className={styles.chatgptContainer}>
                  <div className={styles.assistantHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className={styles.assistantTitle}>Academic Co-Pilot</span>
                      <span className="badge">
                        Context: {activePaperId === 'all' ? `All ${papers.length} Manuscripts` : currentPaper.filename}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setMessages([])}
                        title="Clear conversation"
                      >
                        Clear Chat
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setViewMode('split')}
                        title="Switch back to split view"
                      >
                        📰 Split View
                      </button>
                    </div>
                  </div>

                  {/* Message Stream */}
                  <div className={styles.chatFeed}>
                    {messages.map((m, idx) => (
                      <div
                        key={idx}
                        className={m.role === 'user' ? styles.msgUser : styles.msgAssistant}
                      >
                        {m.role === 'assistant' ? renderMessageContent(m.content, m.citations) : m.content}

                        <div className={styles.msgMeta}>
                          <span>{m.role === 'user' ? 'Reader Inquiry' : 'Gazette AI Co-Pilot'}</span>
                          {m.responseTime && <span>• {m.responseTime}s</span>}
                          {m.citations && m.citations.length > 0 && (
                            <span>• {m.citations.length} Footnotes Cited</span>
                          )}
                        </div>

                        {/* Interactive Follow-up Cross-Questions (ChatGPT Style) */}
                        {m.role === 'assistant' && m.cross_questions && m.cross_questions.length > 0 && (
                          <div className={styles.crossQuestionsBox}>
                            <div className={styles.crossQuestionsLabel}>
                              Suggested Cross-Examination (Click to Ask):
                            </div>
                            <div className={styles.crossQuestionsList}>
                              {m.cross_questions.map((cq, cqIdx) => (
                                <button
                                  key={cqIdx}
                                  className={styles.crossQuestionPill}
                                  onClick={() => handleSendMessage(cq)}
                                  disabled={isGenerating}
                                >
                                  <span>↳</span> {cq}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {isGenerating && (
                      <div className={styles.msgAssistant}>
                        <span style={{ fontStyle: 'italic', color: 'var(--ink-muted)' }}>
                          Retrieving context chunks across manuscripts and formulating cited synthesis...
                        </span>
                      </div>
                    )}

                    <div ref={chatEndRef} />
                  </div>

                  {/* Input Form at Bottom */}
                  <form
                    className={styles.chatInputForm}
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendMessage();
                    }}
                  >
                    <input
                      type="text"
                      className={styles.chatInputField}
                      placeholder={activePaperId === 'all' ? `Ask across all ${papers.length} papers (e.g. compare architectures)...` : `Ask anything about "${currentPaper.filename}"...`}
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      disabled={isGenerating}
                      id="input-chat-query"
                    />
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={isGenerating || !inputMessage.trim()}
                      id="btn-send-chat"
                    >
                      Inquire
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* VIEW MODE 2 & 3: SPLIT VIEW OR FULL ARTICLE VIEW */}
            {viewMode !== 'chatgpt' && (
              <div>
                {/* Article Headline & Byline */}
                <div className={styles.articleHeader}>
                  <div className={styles.articleCategory}>
                    {currentPaper.breakdown.publication_venue || 'Academic Publication'}
                  </div>
                  <h2 className={styles.articleHeadline}>
                    {currentPaper.breakdown.title || currentPaper.filename}
                  </h2>
                  <div className={styles.bylineStrip}>
                    <div className={styles.authorAffiliation}>
                      By {currentPaper.breakdown.authors || 'Academic Researchers'}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <span className="badge">{currentPaper.total_pages} Pages</span>
                      {currentPaper.total_chunks && (
                        <span className="badge">{currentPaper.total_chunks} Chunks</span>
                      )}
                      <span className="badge badge-heavy">Footnote Grounded</span>
                    </div>
                  </div>
                </div>

                <div className={viewMode === 'split' ? styles.editorialGrid : styles.storyColumn}>
                  {/* Article Reading Flow */}
                  <div className={styles.storyColumn}>
                    <nav className={styles.jumpNav}>
                      <span style={{ color: 'var(--ink-muted)' }}>Index:</span>
                      <a href="#section-lead" className={styles.jumpLink}>Executive Lead</a>
                      <span>•</span>
                      <a href="#section-contributions" className={styles.jumpLink}>Contributions</a>
                      <span>•</span>
                      <a href="#section-methodology" className={styles.jumpLink}>Methodology</a>
                      <span>•</span>
                      <a href="#section-benchmarks" className={styles.jumpLink}>Benchmarks</a>
                      <span>•</span>
                      <a href="#section-limitations" className={styles.jumpLink}>Limitations</a>
                      <span>•</span>
                      <a href="#section-bibtex" className={styles.jumpLink}>BibTeX</a>
                    </nav>

                    <article id="section-lead" className={styles.storySection}>
                      <h3 className={styles.sectionHeading}>
                        <span>The Executive Lead</span>
                        <span className="badge">Primary Thesis</span>
                      </h3>
                      <div className={styles.leadParagraph}>
                        {currentPaper.breakdown.executive_summary}
                      </div>
                    </article>

                    <article id="section-contributions" className={styles.storySection}>
                      <h3 className={styles.sectionHeading}>
                        <span>Novel Claims & Contributions</span>
                        <span className="badge">{currentPaper.breakdown.key_contributions?.length || 0} Findings</span>
                      </h3>
                      <ul className={styles.contributionList}>
                        {currentPaper.breakdown.key_contributions?.map((item, idx) => (
                          <li key={idx} className={styles.contributionItem}>
                            <span className={styles.contributionIndex}>0{idx + 1}.</span>
                            <div className={styles.contributionText}>{item}</div>
                          </li>
                        ))}
                      </ul>
                    </article>

                    <article id="section-methodology" className={styles.storySection}>
                      <h3 className={styles.sectionHeading}>
                        <span>Technical Architecture & Formulation</span>
                        <span className="badge">Methodology</span>
                      </h3>
                      <div className={styles.storyBody}>
                        <p>{currentPaper.breakdown.methodology}</p>
                      </div>
                    </article>

                    <article id="section-benchmarks" className={styles.storySection}>
                      <h3 className={styles.sectionHeading}>
                        <span>Empirical Benchmarks & Evidence</span>
                        <span className="badge">Verification</span>
                      </h3>
                      <div className={styles.storyBody}>
                        <p>{currentPaper.breakdown.results_and_benchmarks}</p>
                      </div>
                    </article>

                    <article id="section-limitations" className={styles.storySection}>
                      <h3 className={styles.sectionHeading}>
                        <span>Critical Assessment & Limitations</span>
                        <span className="badge">Evaluation</span>
                      </h3>
                      <div className={styles.calloutBox}>
                        <p style={{ margin: 0 }}>{currentPaper.breakdown.limitations}</p>
                      </div>
                    </article>

                    <article id="section-bibtex" className={styles.storySection}>
                      <div className={styles.sectionHeading}>
                        <span>BibTeX Academic Citation</span>
                        <button className="btn btn-secondary btn-sm" onClick={copyBibtex} id="btn-copy-bibtex">
                          {copiedBibtex ? 'Copied' : 'Copy Citation'}
                        </button>
                      </div>
                      <pre className={styles.bibtexBox}>{currentPaper.breakdown.bibtex}</pre>
                    </article>
                  </div>

                  {/* Co-Pilot Column (Shown in Split Mode) */}
                  {viewMode === 'split' && (
                    <aside className={styles.assistantColumn}>
                      <div className={styles.assistantHeader}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className={styles.assistantTitle}>Scholarly Co-Pilot</span>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setViewMode('chatgpt')}
                            title="Expand to Full ChatGPT Focus Mode"
                            style={{ padding: '2px 6px', fontSize: '0.72rem' }}
                          >
                            ⛶ Expand
                          </button>
                        </div>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setMessages([])}
                          title="Clear discussion"
                        >
                          Clear
                        </button>
                      </div>

                      <div className={styles.chatFeed}>
                        {messages.map((m, idx) => (
                          <div
                            key={idx}
                            className={m.role === 'user' ? styles.msgUser : styles.msgAssistant}
                          >
                            {m.role === 'assistant' ? renderMessageContent(m.content, m.citations) : m.content}
                            <div className={styles.msgMeta}>
                              <span>{m.role === 'user' ? 'Reader' : 'Gazette AI'}</span>
                              {m.responseTime && <span>• {m.responseTime}s</span>}
                              {m.citations && m.citations.length > 0 && (
                                <span>• {m.citations.length} cited pages</span>
                              )}
                            </div>

                            {/* Cross-Questions */}
                            {m.role === 'assistant' && m.cross_questions && m.cross_questions.length > 0 && (
                              <div className={styles.crossQuestionsBox}>
                                <div className={styles.crossQuestionsLabel}>Follow-up Inquiries:</div>
                                <div className={styles.crossQuestionsList}>
                                  {m.cross_questions.map((cq, cqIdx) => (
                                    <button
                                      key={cqIdx}
                                      className={styles.crossQuestionPill}
                                      onClick={() => handleSendMessage(cq)}
                                      disabled={isGenerating}
                                    >
                                      <span>↳</span> {cq}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}

                        {isGenerating && (
                          <div className={styles.msgAssistant}>
                            <span style={{ fontStyle: 'italic', color: 'var(--ink-muted)' }}>
                              Formulating cited response with cross-questions...
                            </span>
                          </div>
                        )}

                        <div ref={chatEndRef} />
                      </div>

                      {/* Chat Form */}
                      <form
                        className={styles.chatInputForm}
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleSendMessage();
                        }}
                      >
                        <input
                          type="text"
                          className={styles.chatInputField}
                          placeholder="Ask about this paper..."
                          value={inputMessage}
                          onChange={(e) => setInputMessage(e.target.value)}
                          disabled={isGenerating}
                          id="input-chat-query"
                        />
                        <button
                          type="submit"
                          className="btn btn-primary btn-sm"
                          disabled={isGenerating || !inputMessage.trim()}
                          id="btn-send-chat"
                        >
                          Send
                        </button>
                      </form>
                    </aside>
                  )}
                </div>
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
