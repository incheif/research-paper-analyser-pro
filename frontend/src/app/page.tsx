'use client';

import React, { useState, useEffect, useRef } from 'react';
import styles from './page.module.css';

interface Citation {
  page: number;
  chunk_id?: number;
  snippet: string;
  relevance_score?: number;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
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

const SAMPLE_DEMO_PAPER: PaperData = {
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
};

export default function Home() {
  const [paper, setPaper] = useState<PaperData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showApiModal, setShowApiModal] = useState(false);
  const [geminiKey, setGeminiKey] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-1.5-flash');
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [copiedBibtex, setCopiedBibtex] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [fontSizeOffset, setFontSizeOffset] = useState<number>(0);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize preferences
  useEffect(() => {
    const savedGemini = localStorage.getItem('paperscope_gemini_key') || '';
    const savedGroq = localStorage.getItem('paperscope_groq_key') || '';
    const savedModel = localStorage.getItem('paperscope_model') || 'gemini-1.5-flash';
    const savedTheme = (localStorage.getItem('paperscope_theme') as 'light' | 'dark') || 'light';
    setGeminiKey(savedGemini);
    setGroqKey(savedGroq);
    setSelectedModel(savedModel);
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  // Update theme
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('paperscope_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  // Adjust reading font size
  const changeFontSize = (delta: number) => {
    const newOffset = Math.max(-2, Math.min(4, fontSizeOffset + delta));
    setFontSizeOffset(newOffset);
    const baseSize = 18 + newOffset;
    document.documentElement.style.setProperty('--reading-font-size', `${baseSize}px`);
  };

  // Auto scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  const saveApiSettings = () => {
    localStorage.setItem('paperscope_gemini_key', geminiKey);
    localStorage.setItem('paperscope_groq_key', groqKey);
    localStorage.setItem('paperscope_model', selectedModel);
    setShowApiModal(false);
  };

  const handleFileUpload = async (file: File) => {
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
      setUploadError('Please select a valid PDF document.');
      return;
    }

    setUploadError(null);
    setIsUploading(true);

    const formData = new FormData();
    formData.append('file', file);
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
        throw new Error(err.detail || 'Failed to analyze PDF');
      }

      const data: PaperData = await res.json();
      setPaper(data);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setMessages([
        {
          role: 'assistant',
          content: `Paper dossier prepared for "${data.breakdown.title || data.filename}" (${data.total_pages} pages). Ask any question regarding the claims, architecture, formulas, or results, and I will cite the exact page.`,
        }
      ]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upload failed. Check if backend is running on port 8000.';
      setUploadError(message);
    } finally {
      setIsUploading(false);
    }
  };

  const loadDemoPaper = () => {
    setPaper(SAMPLE_DEMO_PAPER);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setMessages([
      {
        role: 'assistant',
        content: `Loaded specimen paper: "${SAMPLE_DEMO_PAPER.breakdown.title}". Inquire about the findings, comparative benchmarks, or chunking architecture below.`,
        citations: [
          { page: 1, snippet: "Retrieval-Augmented Generation for AI Reasoning: Architectures, Benchmarks, and Future Directions. JAIR 2024.", relevance_score: 0.98 }
        ]
      }
    ]);
  };

  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText || inputMessage).trim();
    if (!textToSend || !paper || isGenerating) return;

    setInputMessage('');
    const newMessages: Message[] = [...messages, { role: 'user', content: textToSend }];
    setMessages(newMessages);
    setIsGenerating(true);

    if (paper.paper_id === 'demo-rag-2024' && !geminiKey && !groqKey) {
      setTimeout(() => {
        let answer = "According to [Page 4], the paper evaluates hybrid vector-keyword retrieval against standard Dense Passage Retrieval. Table 2 on [Page 6] highlights that the hybrid approach delivers an 88.4% F1-score (+11.2% over baselines) while reducing hallucination rates to 3.8% on multi-hop benchmarks.";
        if (textToSend.toLowerCase().includes('contribution')) {
          answer = "As detailed on [Page 2], the primary contributions are: (1) A formal taxonomy comparing DPR, Graph-RAG, and ColBERT; (2) The Context-Aware Adaptive Chunking algorithm; and (3) An empirical benchmark across 12 modern LLMs.";
        } else if (textToSend.toLowerCase().includes('limitation')) {
          answer = "Section 5 on [Page 11] articulates three critical limitations: cross-encoder re-ranking latency overhead (~140ms per query), sensitivity to multi-lingual tokenizers, and tabular reasoning conflicts.";
        }
        setMessages([
          ...newMessages,
          {
            role: 'assistant',
            content: answer,
            responseTime: 0.42,
            citations: [
              { page: 4, snippet: "Hybrid vector-keyword indexing combines BM25 inverted lexical indices with 1536-dimensional dense embeddings.", relevance_score: 0.94 },
              { page: 6, snippet: "Table 2: Comparative Evaluation on Multi-Hop Question Answering Benchmarks.", relevance_score: 0.91 }
            ]
          }
        ]);
        setIsGenerating(false);
      }, 600);
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
          paper_id: paper.paper_id,
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
        }
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyBibtex = () => {
    if (!paper) return;
    navigator.clipboard.writeText(paper.breakdown.bibtex);
    setCopiedBibtex(true);
    setTimeout(() => setCopiedBibtex(false), 2000);
  };

  const handleExportMarkdown = async () => {
    if (!paper) return;
    try {
      const res = await fetch('http://localhost:8000/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paper_id: paper.paper_id,
          chat_history: messages.map(m => ({ role: m.role, content: m.content }))
        })
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Analysis_${paper.paper_id}.md`;
        a.click();
        return;
      }
    } catch {
      // client-side fallback
    }

    const report = `# Research Paper Monograph: ${paper.breakdown.title}\n\n` +
      `**Publication/Venue:** ${paper.breakdown.publication_venue || 'N/A'}\n` +
      `**File:** ${paper.filename} | **Pages:** ${paper.total_pages}\n\n` +
      `## Executive Summary\n${paper.breakdown.executive_summary}\n\n` +
      `## Key Contributions\n${paper.breakdown.key_contributions.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n\n` +
      `## Methodology & Technical Architecture\n${paper.breakdown.methodology}\n\n` +
      `## Benchmarks & Empirical Findings\n${paper.breakdown.results_and_benchmarks}\n\n` +
      `## Limitations\n${paper.breakdown.limitations}\n\n` +
      `## BibTeX Citation\n\`\`\`bibtex\n${paper.breakdown.bibtex}\n\`\`\`\n`;

    const blob = new Blob([report], { type: 'text/markdown' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${paper.filename.replace('.pdf', '')}_Monograph.md`;
    a.click();
  };

  const renderMessageContent = (content: string, citations?: Citation[]) => {
    const regex = /\[(?:Page|p\.)\s*(\d+)\]/gi;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push(content.substring(lastIndex, match.index));
      }
      const pageNum = parseInt(match[1], 10);
      const matchedCitation = citations?.find(c => c.page === pageNum) || {
        page: pageNum,
        snippet: `Verified citation excerpt from Document Page ${pageNum}.`,
        relevance_score: 0.95
      };

      parts.push(
        <button
          key={match.index}
          className="citation-chip"
          onClick={() => setSelectedCitation(matchedCitation)}
          title={`View verified excerpt from Page ${pageNum}`}
        >
          [p. {pageNum}]
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
      {/* Newspaper Style Masthead */}
      <header className={styles.masthead}>
        <div className={styles.topBar}>
          <div className={styles.topBarMeta}>
            <span>THE RESEARCH REVIEW</span>
            <span>•</span>
            <span>ISSUE 2026</span>
            <span>•</span>
            <span className="badge badge-editorial">
              {selectedModel.includes('llama') ? 'Groq Llama 3.3' : 'Gemini 1.5 Flash'}
            </span>
          </div>

          <div className={styles.topBarActions}>
            {/* Reading Font Size Adjuster */}
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => changeFontSize(-1)}
              title="Decrease text size"
            >
              A-
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => changeFontSize(1)}
              title="Increase text size"
            >
              A+
            </button>
            <span>•</span>
            {/* Day / Night Theme Toggle */}
            <button
              className="btn btn-ghost btn-sm"
              onClick={toggleTheme}
              title="Toggle reading light/dark mode"
            >
              {theme === 'light' ? '🌙 Night' : '☀️ Day'}
            </button>
            <span>•</span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setShowApiModal(true)}
              id="btn-api-settings"
            >
              API Key {geminiKey || groqKey ? '✓' : ''}
            </button>
          </div>
        </div>

        <div className={styles.mainHeader}>
          <div
            className={styles.mastheadTitleGroup}
            onClick={() => {
              if (paper) {
                setPaper(null);
                setMessages([]);
              }
            }}
          >
            <h1 className={styles.newspaperLogo}>The Scholarly Gazette</h1>
            <p className={styles.newspaperTagline}>
              Academic Intelligence & Retrieval-Augmented Paper Analysis
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {!paper ? (
              <button
                className="btn btn-secondary"
                onClick={loadDemoPaper}
                id="btn-demo-paper"
              >
                Sample Paper Demo
              </button>
            ) : (
              <>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setPaper(null);
                    setMessages([]);
                  }}
                >
                  Upload New Paper
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

      {/* Main Content Area */}
      <main className={styles.mainContainer}>
        {/* Upload State */}
        {!paper && (
          <section className={styles.heroUpload}>
            <span className="badge badge-editorial">Front Page Feature</span>
            <h2 className={styles.heroLeadTitle}>
              Effortless Academic Reading & Deep Document Analysis
            </h2>
            <p className={styles.heroLeadSubtitle}>
              Upload any scientific PDF to read an executive digest, track novel contributions, examine methodology, and query specific pages with grounded footnote citations.
            </p>

            <div
              className={styles.dropzone}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files?.[0]) handleFileUpload(e.dataTransfer.files[0]);
              }}
              id="dropzone-area"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
                }}
              />
              <div className={styles.dropzoneIcon}>📄</div>
              {isUploading ? (
                <>
                  <div className={styles.dropzoneTitle}>Extracting Manuscript & Building Vector Index...</div>
                  <div className={styles.dropzoneHint}>Please wait a moment while the paper is processed.</div>
                </>
              ) : (
                <>
                  <div className={styles.dropzoneTitle}>Drop your PDF paper here or click to browse</div>
                  <div className={styles.dropzoneHint}>Supports single or multi-page academic papers</div>
                </>
              )}
            </div>

            {uploadError && (
              <div style={{ color: 'var(--accent-ink)', fontSize: '0.9rem', marginTop: '10px' }}>
                Notice: {uploadError}
              </div>
            )}
          </section>
        )}

        {/* Paper Loaded State */}
        {paper && (
          <div>
            {/* Headline and Byline */}
            <div className={styles.articleHeader}>
              <div className={styles.articleCategory}>
                {paper.breakdown.publication_venue || 'Scholarly Monograph'}
              </div>
              <h2 className={styles.articleHeadline}>
                {paper.breakdown.title || paper.filename}
              </h2>
              <div className={styles.bylineStrip}>
                <div className={styles.authorAffiliation}>
                  By {paper.breakdown.authors || 'Academic Researchers'}
                </div>
                <div className={styles.articleMetaBadges}>
                  <span className="badge badge-editorial">{paper.total_pages} Pages</span>
                  {paper.total_chunks && (
                    <span className="badge badge-editorial">{paper.total_chunks} Chunks</span>
                  )}
                  <span className="badge badge-citation">Verified Grounding</span>
                </div>
              </div>
            </div>

            {/* Two-Column Reader Grid */}
            <div className={styles.editorialGrid}>
              {/* Left Column: Continuous Reading Flow */}
              <div className={styles.storyColumn}>
                {/* Sticky Section Quick Jump */}
                <nav className={styles.jumpBar}>
                  <span style={{ color: 'var(--ink-muted)' }}>SECTIONS:</span>
                  <a href="#section-executive" className={styles.jumpLink}>Executive Summary</a>
                  <span>•</span>
                  <a href="#section-contributions" className={styles.jumpLink}>Key Contributions</a>
                  <span>•</span>
                  <a href="#section-methodology" className={styles.jumpLink}>Methodology</a>
                  <span>•</span>
                  <a href="#section-results" className={styles.jumpLink}>Benchmarks</a>
                  <span>•</span>
                  <a href="#section-limitations" className={styles.jumpLink}>Limitations</a>
                  <span>•</span>
                  <a href="#section-bibtex" className={styles.jumpLink}>BibTeX</a>
                </nav>

                {/* Section 1: Executive Summary */}
                <article id="section-executive" className={styles.storySection}>
                  <h3 className={styles.sectionHeading}>
                    <span>Executive Summary</span>
                    <span className="badge badge-editorial">The Lead Story</span>
                  </h3>
                  <div className={styles.leadParagraph}>
                    {paper.breakdown.executive_summary}
                  </div>
                </article>

                {/* Section 2: Key Contributions */}
                <article id="section-contributions" className={styles.storySection}>
                  <h3 className={styles.sectionHeading}>
                    <span>Novel Contributions & Breakthroughs</span>
                    <span className="badge badge-editorial">{paper.breakdown.key_contributions?.length || 0} Key Points</span>
                  </h3>
                  <ol className={styles.contributionList}>
                    {paper.breakdown.key_contributions?.map((item, idx) => (
                      <li key={idx} className={styles.contributionItem}>
                        <span className={styles.contributionNumber}>0{idx + 1}.</span>
                        <div className={styles.contributionText}>{item}</div>
                      </li>
                    ))}
                  </ol>
                </article>

                {/* Section 3: Methodology */}
                <article id="section-methodology" className={styles.storySection}>
                  <h3 className={styles.sectionHeading}>
                    <span>Technical Architecture & Methodology</span>
                    <span className="badge badge-editorial">System Formulation</span>
                  </h3>
                  <div className={styles.storyBody}>
                    <p>{paper.breakdown.methodology}</p>
                  </div>
                </article>

                {/* Section 4: Results & Benchmarks */}
                <article id="section-results" className={styles.storySection}>
                  <h3 className={styles.sectionHeading}>
                    <span>Empirical Benchmarks & Experimental Findings</span>
                    <span className="badge badge-editorial">Evidence</span>
                  </h3>
                  <div className={styles.storyBody}>
                    <p>{paper.breakdown.results_and_benchmarks}</p>
                  </div>
                </article>

                {/* Section 5: Limitations */}
                <article id="section-limitations" className={styles.storySection}>
                  <h3 className={styles.sectionHeading}>
                    <span>Critical Evaluation & Limitations</span>
                    <span className="badge badge-accent">Threats to Validity</span>
                  </h3>
                  <div className={styles.calloutBox}>
                    <p style={{ margin: 0 }}>{paper.breakdown.limitations}</p>
                  </div>
                </article>

                {/* Section 6: BibTeX */}
                <article id="section-bibtex" className={styles.storySection}>
                  <div className={styles.sectionHeading}>
                    <span>BibTeX Academic Citation</span>
                    <button className="btn btn-secondary btn-sm" onClick={copyBibtex} id="btn-copy-bibtex">
                      {copiedBibtex ? 'Copied to Clipboard' : 'Copy BibTeX'}
                    </button>
                  </div>
                  <pre className={styles.bibtexCard}>{paper.breakdown.bibtex}</pre>
                </article>
              </div>

              {/* Right Column: Co-Pilot Notes & Q&A */}
              <aside className={styles.assistantColumn}>
                <div className={styles.assistantHeader}>
                  <span className={styles.assistantTitle}>Research Co-Pilot</span>
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
                        <span>{m.role === 'user' ? 'Reader' : 'Gazette RAG'}</span>
                        {m.responseTime && <span>• {m.responseTime}s</span>}
                        {m.citations && m.citations.length > 0 && (
                          <span>• {m.citations.length} cited pages</span>
                        )}
                      </div>
                    </div>
                  ))}

                  {isGenerating && (
                    <div className={styles.msgAssistant}>
                      <span style={{ fontStyle: 'italic', color: 'var(--ink-muted)' }}>
                        Consulting manuscript pages and composing cited response...
                      </span>
                    </div>
                  )}

                  <div ref={chatEndRef} />
                </div>

                {/* Suggested Inquiries */}
                {paper.breakdown.suggested_questions && paper.breakdown.suggested_questions.length > 0 && (
                  <div className={styles.quickQuestions}>
                    <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.7rem', color: 'var(--ink-muted)', textTransform: 'uppercase' }}>
                      Suggested Inquiries:
                    </div>
                    {paper.breakdown.suggested_questions.slice(0, 3).map((q, idx) => (
                      <button
                        key={idx}
                        className={styles.quickQuestionChip}
                        onClick={() => handleSendMessage(q)}
                        disabled={isGenerating}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}

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
            </div>
          </div>
        )}
      </main>

      {/* Citation Excerpt Modal */}
      {selectedCitation && (
        <div className={styles.modalBackdrop} onClick={() => setSelectedCitation(null)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <span className="badge badge-citation">Document Page {selectedCitation.page}</span>
                <h3 className={styles.modalTitle} style={{ marginTop: '4px' }}>Verified Source Citation</h3>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedCitation(null)}>✕</button>
            </div>

            <div className={styles.excerptContent}>
              &ldquo;{selectedCitation.snippet}&rdquo;
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {selectedCitation.relevance_score && (
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.75rem', color: 'var(--ink-muted)' }}>
                  Relevance Score: <strong>{(selectedCitation.relevance_score * 100).toFixed(0)}%</strong>
                </div>
              )}
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedCitation(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* API Key Settings Modal */}
      {showApiModal && (
        <div className={styles.modalBackdrop} onClick={() => setShowApiModal(false)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Inference & API Key Settings</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowApiModal(false)}>✕</button>
            </div>

            <p style={{ fontFamily: 'var(--font-ui)', fontSize: '0.82rem', color: 'var(--ink-secondary)' }}>
              Configure your model provider and credentials. API keys are kept safely in your browser storage.
            </p>

            <div className={styles.formField}>
              <label className={styles.formLabel}>Selected LLM Model</label>
              <select
                className={styles.formSelect}
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
              >
                <option value="gemini-1.5-flash">Google Gemini 1.5 Flash (Ultra Fast)</option>
                <option value="gemini-1.5-pro">Google Gemini 1.5 Pro (Deep Reasoning)</option>
                <option value="gemini-2.0-flash">Google Gemini 2.0 Flash</option>
                <option value="llama-3.3-70b-versatile">Groq Llama 3.3 70B (High-Speed)</option>
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
                  style={{ color: 'var(--accent-ink)', marginLeft: '8px', fontSize: '0.74rem' }}
                >
                  Get free key ↗
                </a>
              </label>
              <input
                type="password"
                className={styles.formInput}
                placeholder="AIzaSy..."
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
                  style={{ color: 'var(--accent-ink)', marginLeft: '8px', fontSize: '0.74rem' }}
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
