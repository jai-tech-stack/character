// 🚀 ULTIMATE Document Analysis Component
import React, { useState } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, Loader, X, FileCheck, Send, Sparkles } from 'lucide-react';
import { analyzeDocument } from '../api/chatApi';

const DocumentAnalysisComponent = ({ sessionId, onAnalysisComplete }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [customQuery, setCustomQuery] = useState('');
  const [showQueryInput, setShowQueryInput] = useState(false);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (file) => {
    const allowedTypes = ['application/pdf', 'application/msword', 
                         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                         'text/plain'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Please upload PDF, DOC, DOCX, or TXT files only.');
      return;
    }

    if (file.size > maxSize) {
      setError('File too large. Maximum size is 10MB.');
      return;
    }

    setSelectedFile(file);
    setError(null);
    setAnalysis(null);
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const analyzeDoc = async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const result = await analyzeDocument(selectedFile, sessionId, customQuery || null);
      setAnalysis(result);
      
      if (onAnalysisComplete) {
        onAnalysisComplete(result);
      }

    } catch (err) {
      setError(err.message || 'Failed to analyze document. Please try again.');
      console.error('Document analysis error:', err);
    } finally {
      setUploading(false);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setAnalysis(null);
    setError(null);
    setCustomQuery('');
    setShowQueryInput(false);
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Analysis copied to clipboard!');
  };

  const quickQuestions = [
    "What are the key terms and conditions?",
    "Are there any potential risks?",
    "What are my obligations under this document?",
    "Is this contract enforceable?",
    "What happens if I breach this agreement?"
  ];

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-2 mb-3">
          <FileCheck className="w-8 h-8 text-blue-600" />
          AI-Powered Document Analysis
        </h2>
        <p className="text-gray-600 text-lg">Upload legal documents for instant intelligent analysis with context-aware insights</p>
      </div>

      {/* Feature Badges */}
      <div className="mb-6 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-800 border border-blue-300">
          <Sparkles className="w-4 h-4" /> Smart AI Analysis
        </span>
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800 border border-green-300">
          ✓ Multi-Language Support
        </span>
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold bg-purple-100 text-purple-800 border border-purple-300">
          ⚡ Under 10 seconds
        </span>
      </div>

      {/* Upload Area */}
      {!selectedFile && !analysis && (
        <div
          className={`border-2 border-dashed rounded-xl p-10 text-center transition-all duration-300 ${
            dragActive 
              ? 'border-blue-500 bg-blue-50 scale-105' 
              : 'border-gray-300 hover:border-blue-400 bg-gradient-to-br from-gray-50 to-gray-100'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <Upload className="w-20 h-20 mx-auto mb-4 text-blue-500" />
          <p className="text-xl font-semibold text-gray-700 mb-2">
            Drag & drop your document here
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Supports PDF, DOC, DOCX, TXT • Maximum 10MB
          </p>
          <label className="inline-block px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl cursor-pointer hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl font-semibold">
            <input
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.txt"
              onChange={handleFileInput}
            />
            📂 Browse Files
          </label>
        </div>
      )}

      {/* Selected File Display */}
      {selectedFile && !analysis && (
        <div className="border border-gray-300 rounded-xl p-6 bg-gradient-to-br from-white to-gray-50 shadow-md">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-3 flex-1">
              <FileText className="w-10 h-10 text-blue-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-semibold text-gray-800 text-lg mb-1">{selectedFile.name}</h3>
                <p className="text-sm text-gray-600">
                  {formatFileSize(selectedFile.size)} • {selectedFile.type.split('/').pop().toUpperCase()}
                </p>
              </div>
            </div>
            <button
              onClick={clearFile}
              className="p-2 hover:bg-red-100 rounded-full transition-colors"
              disabled={uploading}
            >
              <X className="w-5 h-5 text-red-600" />
            </button>
          </div>

          {/* Custom Query Input */}
          {showQueryInput ? (
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Ask a specific question about this document:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customQuery}
                  onChange={(e) => setCustomQuery(e.target.value)}
                  placeholder="e.g., What are the termination clauses?"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={() => {
                    setShowQueryInput(false);
                    setCustomQuery('');
                  }}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-700 mb-2">Quick Questions:</p>
              <div className="flex flex-wrap gap-2">
                {quickQuestions.slice(0, 3).map((question, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setCustomQuery(question);
                      setShowQueryInput(true);
                    }}
                    className="text-xs px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-200 transition-colors"
                  >
                    {question}
                  </button>
                ))}
                <button
                  onClick={() => setShowQueryInput(true)}
                  className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg border border-gray-300 transition-colors"
                >
                  ✏️ Custom Question
                </button>
              </div>
            </div>
          )}

          {/* Analyze Button */}
          <button
            onClick={analyzeDoc}
            disabled={uploading}
            className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3 ${
              uploading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl'
            }`}
          >
            {uploading ? (
              <>
                <Loader className="w-6 h-6 animate-spin" />
                Analyzing with AI...
              </>
            ) : (
              <>
                <Sparkles className="w-6 h-6" />
                {customQuery ? 'Ask AI & Analyze' : 'Analyze Document'}
              </>
            )}
          </button>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="border-2 border-red-300 bg-red-50 rounded-xl p-5 flex items-start gap-3 shadow-md">
          <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-red-800 mb-1 text-lg">Analysis Error</h4>
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={() => setError(null)}
              className="mt-2 text-sm text-red-600 hover:text-red-800 font-semibold"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Analysis Results */}
      {analysis && (
        <div className="border-2 border-green-300 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 shadow-lg">
          <div className="flex items-start gap-3 mb-5">
            <CheckCircle className="w-8 h-8 text-green-600 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h3 className="font-bold text-green-800 text-2xl mb-2">Analysis Complete!</h3>
              <p className="text-sm text-green-700">
                {analysis.fileName} • {analysis.legalArea?.replace(/_/g, ' ').toUpperCase()} • 
                {analysis.language && ` Language: ${analysis.language.toUpperCase()} •`}
                Processing time: {(analysis.processingTime / 1000).toFixed(1)}s
              </p>
            </div>
          </div>

          {/* Analysis Metadata */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5 p-5 bg-white rounded-xl border-2 border-green-200 shadow-sm">
            <div>
              <p className="text-xs text-gray-600 mb-1 font-semibold">File Size</p>
              <p className="font-bold text-gray-800 text-lg">{formatFileSize(analysis.fileSize)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-1 font-semibold">Text Extracted</p>
              <p className="font-bold text-gray-800 text-lg">{analysis.textLength?.toLocaleString()} chars</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-1 font-semibold">Legal Area</p>
              <p className="font-bold text-gray-800 text-lg capitalize">{analysis.legalArea?.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-1 font-semibold">AI Model</p>
              <p className="font-bold text-gray-800 text-lg">GPT-4o-mini</p>
            </div>
          </div>

          {/* Analysis Content */}
          <div className="bg-white rounded-xl border-2 border-green-200 p-6 shadow-sm mb-5">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-bold text-gray-800 text-xl flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-600" />
                AI Analysis Report
              </h4>
              <button
                onClick={() => copyToClipboard(analysis.analysis)}
                className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-sm font-semibold transition-colors"
              >
                📋 Copy
              </button>
            </div>
            <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-line leading-relaxed">
              {analysis.analysis}
            </div>
          </div>

          {/* Disclaimer */}
          <div className="mb-5 p-4 bg-yellow-50 border-2 border-yellow-200 rounded-xl">
            <p className="text-sm text-yellow-900">
              <strong className="font-bold">⚠️ Important Disclaimer:</strong> {analysis.disclaimer || 'This is AI-generated analysis. Always consult a licensed attorney for legal decisions.'}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={clearFile}
              className="flex-1 py-3 px-5 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white rounded-xl font-bold transition-all shadow-md hover:shadow-lg"
            >
              📂 Analyze Another
            </button>
            <button
              onClick={() => {
                const blob = new Blob([JSON.stringify(analysis, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `analysis-${analysis.fileName}-${Date.now()}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="py-3 px-5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-bold transition-all shadow-md hover:shadow-lg"
            >
              💾 Download JSON
            </button>
          </div>
        </div>
      )}

      {/* Features Grid */}
      <div className="mt-8 p-6 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200 shadow-sm">
        <h4 className="font-bold text-gray-700 mb-4 text-lg">✨ What We Analyze:</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm text-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-green-600 font-bold">✓</span>
            <span>Employment Contracts</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-600 font-bold">✓</span>
            <span>NDAs & Confidentiality</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-600 font-bold">✓</span>
            <span>Service Agreements</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-600 font-bold">✓</span>
            <span>Lease Agreements</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-600 font-bold">✓</span>
            <span>Partnership Deeds</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-600 font-bold">✓</span>
            <span>Legal Notices</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-600 font-bold">✓</span>
            <span>Court Documents</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-600 font-bold">✓</span>
            <span>Business Contracts</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-600 font-bold">✓</span>
            <span>MOUs & LOIs</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentAnalysisComponent;