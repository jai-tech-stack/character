import React, { useState } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, Loader, X, FileCheck } from 'lucide-react';
import { analyzeDocument } from '../api/chatApi';

const DocumentAnalysisComponent = ({ sessionId, onAnalysisComplete }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);

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
      const result = await analyzeDocument(selectedFile, sessionId, 'agentic');
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
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2 mb-2">
          <FileCheck className="w-7 h-7 text-blue-600" />
          Smart AI Document Analysis
        </h2>
        <p className="text-gray-600">Upload contracts, agreements, or legal documents for intelligent AI-powered analysis</p>
      </div>

      {/* Smart AI Badge */}
      <div className="mb-4">
        <span className="inline-block px-3 py-1 rounded-full text-sm font-semibold border bg-blue-100 text-blue-800 border-blue-300">
          Smart AI Analysis
        </span>
      </div>

      {/* Upload Area */}
      {!selectedFile && !analysis && (
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-300 hover:border-blue-400 bg-gray-50'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <Upload className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <p className="text-lg font-semibold text-gray-700 mb-2">
            Drag & drop your document here
          </p>
          <p className="text-sm text-gray-500 mb-4">
            or click to browse (PDF, DOC, DOCX, TXT • Max 10MB)
          </p>
          <label className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors">
            <input
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.txt"
              onChange={handleFileInput}
            />
            Select File
          </label>
        </div>
      )}

      {/* Selected File Display */}
      {selectedFile && !analysis && (
        <div className="border border-gray-300 rounded-lg p-6 bg-gray-50">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-3">
              <FileText className="w-8 h-8 text-blue-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-gray-800 text-lg">{selectedFile.name}</h3>
                <p className="text-sm text-gray-600">
                  {formatFileSize(selectedFile.size)} • {selectedFile.type.split('/').pop().toUpperCase()}
                </p>
              </div>
            </div>
            <button
              onClick={clearFile}
              className="p-2 hover:bg-gray-200 rounded-full transition-colors"
              disabled={uploading}
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          <button
            onClick={analyzeDoc}
            disabled={uploading}
            className={`w-full py-3 px-6 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${
              uploading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {uploading ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Analyzing with Smart AI...
              </>
            ) : (
              <>
                <FileCheck className="w-5 h-5" />
                Analyze Document
              </>
            )}
          </button>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="border border-red-300 bg-red-50 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-red-800 mb-1">Analysis Error</h4>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Analysis Results */}
      {analysis && (
        <div className="border border-green-300 bg-green-50 rounded-lg p-6">
          <div className="flex items-start gap-3 mb-4">
            <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h3 className="font-bold text-green-800 text-lg mb-1">Analysis Complete</h3>
              <p className="text-sm text-green-700">
                {analysis.fileName} • {analysis.documentType.replace(/_/g, ' ').toUpperCase()}
              </p>
            </div>
          </div>

          {/* Analysis Metadata */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 p-4 bg-white rounded border border-green-200">
            <div>
              <p className="text-xs text-gray-600 mb-1">Confidence</p>
              <p className="font-semibold text-gray-800">{(analysis.confidence * 100).toFixed(0)}%</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-1">Legal Area</p>
              <p className="font-semibold text-gray-800 capitalize">{analysis.legalArea.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-1">AI Mode</p>
              <p className="font-semibold text-gray-800">Smart AI</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-1">Processing Time</p>
              <p className="font-semibold text-gray-800">{(analysis.processingTime / 1000).toFixed(1)}s</p>
            </div>
          </div>

          {/* Analysis Content */}
          <div className="bg-white rounded border border-green-200 p-6">
            <h4 className="font-bold text-gray-800 mb-3 text-lg">Analysis Report</h4>
            <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-line">
              {analysis.analysis.content || analysis.analysis}
            </div>
          </div>

          {/* Disclaimer */}
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
            <strong>Disclaimer:</strong> {analysis.disclaimer}
          </div>

          {/* Action Buttons */}
          <div className="mt-4 flex gap-3">
            <button
              onClick={clearFile}
              className="flex-1 py-2 px-4 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition-colors"
            >
              Analyze Another Document
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
              className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
            >
              Download Report
            </button>
          </div>
        </div>
      )}

      {/* Supported Document Types */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h4 className="font-semibold text-gray-700 mb-2 text-sm">Supported Document Types:</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-gray-600">
          <div>✓ Employment Agreements</div>
          <div>✓ NDAs & Confidentiality</div>
          <div>✓ Service Agreements</div>
          <div>✓ Lease Agreements</div>
          <div>✓ Partnership Deeds</div>
          <div>✓ Legal Notices</div>
          <div>✓ Court Documents</div>
          <div>✓ Business Contracts</div>
          <div>✓ MOUs & LOIs</div>
        </div>
      </div>
    </div>
  );
};

export default DocumentAnalysisComponent;