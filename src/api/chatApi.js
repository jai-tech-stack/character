// Fixed Real AI Mode System - chatApi.js
// Fixed to match server.js validation requirements

const API_BASE_URL = 'https://character-chan.onrender.com';

console.log('Loading REAL AI Mode System for FoxMandal...');

// ===== REAL AI MODE IMPLEMENTATIONS =====

class RealAIProcessor {
  constructor() {
    this.conversationHistory = new Map();
  }

  // STANDARD AI - Traditional single-turn legal consultation
  async processStandard(message, sessionId) {
    return await this.sendToBackend({
      message,
      sessionId,
      aiMode: 'standard',
      systemPrompt: `You are Advocate Arjun from FoxMandal law firm. Provide direct legal advice based on Indian law. Keep responses concise and practical.`,
      temperature: 0.7,
      maxTokens: 200
    });
  }

  // AGENTIC AI - Multi-step autonomous reasoning with action planning
  async processAgentic(message, sessionId) {
    try {
      // Step 1: Analyze the legal query
      const analysis = await this.analyzeQuery(message, sessionId);
      
      // Step 2: Create action plan
      const actionPlan = await this.createActionPlan(analysis, message, sessionId);
      
      // Step 3: Execute research steps
      const researchResults = await this.executeResearch(actionPlan, message, sessionId);
      
      // Step 4: Synthesize final response
      return await this.synthesizeAgenticResponse(message, analysis, actionPlan, researchResults, sessionId);
      
    } catch (error) {
      console.error('Agentic AI processing error:', error);
      // Fallback to simpler agentic response
      return await this.sendToBackend({
        message: `As an autonomous legal agent, analyze and provide step-by-step recommendations for: ${message}`,
        sessionId,
        aiMode: 'agentic',
        systemPrompt: `You are an autonomous legal agent at FoxMandal. Provide step-by-step analysis:

AUTONOMOUS ANALYSIS:
1. Legal Issue Identification
2. Research Plan
3. Key Findings  
4. Strategic Recommendations
5. Next Actions

Show your autonomous reasoning process clearly.`,
        temperature: 0.3,
        maxTokens: 350
      });
    }
  }

  // AGI - Cross-domain analysis combining legal, business, technical perspectives
  async processAGI(message, sessionId) {
    try {
      // Try comprehensive cross-domain analysis
      const analysisPrompt = `Analyze this query from multiple perspectives:

QUERY: ${message}

Provide analysis from these domains:
1. Legal Domain (Indian laws, regulations, compliance)
2. Business Domain (costs, risks, market impact)
3. Technical Domain (implementation, processes)
4. Ethical Domain (stakeholder impact, responsibility)

Then provide integrated cross-domain recommendations.`;

      return await this.sendToBackend({
        message: analysisPrompt,
        sessionId,
        aiMode: 'agi',
        systemPrompt: `You are an AGI system analyzing legal matters across multiple domains. Provide:

AGI MULTI-DOMAIN ANALYSIS:

Legal Perspective:
[Indian law analysis, regulations, compliance requirements]

Business Perspective:
[Commercial implications, costs, risks, opportunities]

Technical Perspective:
[Implementation requirements, processes, documentation]

Ethical Perspective:
[Stakeholder impact, social responsibility, fairness]

INTEGRATED RECOMMENDATIONS:
[How all domains connect and unified strategic approach]`,
        temperature: 0.4,
        maxTokens: 450
      });

    } catch (error) {
      console.error('AGI processing error:', error);
      // Fallback to simpler AGI response
      return await this.sendToBackend({
        message: `Provide comprehensive multi-domain analysis for: ${message}`,
        sessionId,
        aiMode: 'agi',
        systemPrompt: `You are an AGI system. Analyze from legal, business, technical, and ethical perspectives, then provide integrated recommendations.`,
        temperature: 0.4,
        maxTokens: 400
      });
    }
  }

  // ASI - Advanced probabilistic analysis with future projections
  async processASI(message, sessionId) {
    try {
      const asiPrompt = `Provide advanced superintelligence analysis for: ${message}

Generate:
1. Multiple probability scenarios with percentages
2. Risk assessment with quantified probabilities
3. 3-year strategic projections with confidence intervals
4. Optimal decision pathways with success rates`;

      return await this.sendToBackend({
        message: asiPrompt,
        sessionId,
        aiMode: 'asi',
        systemPrompt: `You are an ASI (Artificial Superintelligence) system. Provide advanced analysis:

ASI SUPERINTELLIGENCE ANALYSIS:

SCENARIO MODELING:
Scenario 1 (Optimistic): [details] - Probability: X%
Scenario 2 (Most Likely): [details] - Probability: Y%  
Scenario 3 (Pessimistic): [details] - Probability: Z%

RISK QUANTIFICATION:
High Risk Factors: [list with probabilities]
Medium Risk Factors: [list with probabilities]
Low Risk Factors: [list with probabilities]

PREDICTIVE PROJECTIONS:
6 Month Outlook: [specific predictions with confidence %]
1 Year Outlook: [developments with probability %]
3 Year Strategic Forecast: [long-term implications with confidence intervals]

OPTIMAL STRATEGY PATH:
[Specific recommendations with calculated success probabilities]

SUPERINTELLIGENCE INSIGHTS:
[Non-obvious patterns and strategic advantages identified]

Confidence Level: [Overall confidence % with reasoning]`,
        temperature: 0.2,
        maxTokens: 500
      });

    } catch (error) {
      console.error('ASI processing error:', error);
      // Fallback to simpler ASI response
      return await this.sendToBackend({
        message: `Provide advanced probabilistic analysis with future projections for: ${message}`,
        sessionId,
        aiMode: 'asi',
        systemPrompt: `You are an ASI system. Provide probabilistic scenarios, risk assessments, and strategic projections with confidence intervals.`,
        temperature: 0.2,
        maxTokens: 450
      });
    }
  }

  // === AGENTIC AI HELPER METHODS ===
  
  async analyzeQuery(message, sessionId) {
    return await this.sendToBackend({
      message: `Analyze this legal query and identify: 1) Legal areas involved, 2) Complexity level, 3) Required research tasks: "${message}"`,
      sessionId,
      aiMode: 'agentic',
      systemPrompt: `You are a legal analyst. Provide structured analysis:
LEGAL AREAS: [list specific areas]
COMPLEXITY: [high/medium/low with reasoning] 
RESEARCH TASKS: [numbered list of specific research tasks]`,
      temperature: 0.3,
      maxTokens: 150
    });
  }

  async createActionPlan(analysis, originalMessage, sessionId) {
    return await this.sendToBackend({
      message: `Based on analysis: "${analysis}", create step-by-step action plan for: "${originalMessage}"`,
      sessionId,
      aiMode: 'agentic',
      systemPrompt: `Create detailed action plan:
STEP 1: [specific research action]
STEP 2: [specific analysis action] 
STEP 3: [specific recommendation action]
EXPECTED OUTCOME: [what this will achieve]`,
      temperature: 0.2,
      maxTokens: 200
    });
  }

  async executeResearch(actionPlan, originalMessage, sessionId) {
    return await this.sendToBackend({
      message: `Execute research plan: "${actionPlan}" for query: "${originalMessage}"`,
      sessionId,
      aiMode: 'agentic',
      systemPrompt: `Execute the research plan. For each step, provide specific findings, relevant laws, and insights. Be detailed and practical.`,
      temperature: 0.4,
      maxTokens: 250
    });
  }

  async synthesizeAgenticResponse(message, analysis, actionPlan, research, sessionId) {
    const finalPrompt = `Synthesize autonomous legal analysis:

QUERY: ${message}
ANALYSIS: ${analysis}
ACTION PLAN: ${actionPlan}
RESEARCH RESULTS: ${research}`;

    return await this.sendToBackend({
      message: finalPrompt,
      sessionId,
      aiMode: 'agentic',
      systemPrompt: `You are an autonomous legal agent. Present findings as:

AUTONOMOUS ANALYSIS COMPLETE:

Key Legal Findings:
• [Specific discoveries from research]
• [Relevant laws and regulations identified]

Actions Executed:
• [Research performed autonomously]
• [Analysis completed independently]

Strategic Recommendations:
• [Specific next steps with reasoning]
• [Risk mitigation strategies]

Next Autonomous Actions:
• [What I would research next independently]
• [Additional analysis I would perform]

This analysis was performed autonomously using systematic legal research methodology.`,
      temperature: 0.3,
      maxTokens: 400
    });
  }

  // === UTILITY METHODS ===

  async sendToBackend(params) {
    try {
      // Ensure all required fields are present and properly formatted
      const requestBody = {
        message: params.message || '',
        sessionId: params.sessionId || this.generateSessionId(),
        aiMode: params.aiMode || 'standard',
        systemPrompt: params.systemPrompt,
        temperature: params.temperature || 0.5,
        maxTokens: params.maxTokens || 200,
        timestamp: Date.now()
      };

      // Validate required fields
      if (!requestBody.message.trim()) {
        throw new Error('Message cannot be empty');
      }

      if (requestBody.message.length > 2000) {
        requestBody.message = requestBody.message.substring(0, 2000);
      }

      console.log(`Sending ${params.aiMode} request to backend...`);

      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': requestBody.sessionId,
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Backend error (${response.status}):`, errorText);
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.reply || typeof data.reply !== 'string') {
        throw new Error('Invalid response format from backend');
      }

      return data.reply;

    } catch (error) {
      console.error('Backend API Error:', error);
      
      // Provide mode-specific fallback responses
      const fallbackResponses = {
        'asi': `ASI Processing Error: Unable to complete superintelligence analysis. The system encountered technical difficulties while processing your request. Please try a simpler query or contact support.`,
        'agi': `AGI Processing Error: Cross-domain analysis temporarily unavailable. Unable to analyze across multiple domains due to system limitations. Please try again or use Standard mode.`,
        'agentic': `Agentic Processing Error: Autonomous research system temporarily offline. Unable to execute independent analysis steps. Please try Standard mode for immediate legal consultation.`,
        'standard': `I apologize, but I'm experiencing technical difficulties. Please try again in a moment or contact our support team if the issue persists.`
      };

      return fallbackResponses[params.aiMode] || fallbackResponses['standard'];
    }
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  getConversationContext(sessionId) {
    return this.conversationHistory.get(sessionId) || {};
  }

  updateConversationContext(sessionId, message, response, mode) {
    const context = this.getConversationContext(sessionId);
    context.history = context.history || [];
    context.history.push({ message, response, mode, timestamp: Date.now() });
    
    // Keep last 3 interactions for context
    if (context.history.length > 3) {
      context.history = context.history.slice(-3);
    }
    
    this.conversationHistory.set(sessionId, context);
  }
}

// Create global processor instance
const aiProcessor = new RealAIProcessor();

// ===== MAIN API FUNCTIONS =====

export const sendMessage = async (message, sessionId = null, aiMode = 'standard') => {
  if (!message || typeof message !== 'string') {
    throw new Error('Message is required and must be a string');
  }

  const sanitizedMessage = message.trim().substring(0, 2000);
  if (!sanitizedMessage) {
    throw new Error('Message cannot be empty after sanitization');
  }

  const session = sessionId || aiProcessor.generateSessionId();

  try {
    let response;
    
    console.log(`Processing ${aiMode} mode request for: "${sanitizedMessage.substring(0, 50)}..."`);
    
    // Route to appropriate AI processor
    switch (aiMode) {
      case 'agentic':
        response = await aiProcessor.processAgentic(sanitizedMessage, session);
        break;
      case 'agi':
        response = await aiProcessor.processAGI(sanitizedMessage, session);
        break;
      case 'asi':
        response = await aiProcessor.processASI(sanitizedMessage, session);
        break;
      default:
        response = await aiProcessor.processStandard(sanitizedMessage, session);
        break;
    }

    // Update conversation history
    aiProcessor.updateConversationContext(session, sanitizedMessage, response, aiMode);

    return {
      reply: response,
      aiMode,
      sessionId: session,
      processingType: `real_${aiMode}`,
      confidence: calculateConfidence(response, aiMode)
    };

  } catch (error) {
    console.error(`${aiMode} mode error:`, error);
    
    // Return error-specific response based on mode
    const errorResponse = getErrorResponse(error.message, aiMode);
    
    return {
      reply: errorResponse,
      aiMode,
      sessionId: session,
      processingType: `error_${aiMode}`,
      confidence: 0.3
    };
  }
};

function getErrorResponse(errorMessage, mode) {
  const modeNames = {
    'asi': 'ASI Superintelligence',
    'agi': 'AGI Cross-Domain Analysis', 
    'agentic': 'Agentic Autonomous Research',
    'standard': 'Standard Legal Consultation'
  };

  return `${modeNames[mode] || 'AI Processing'} is temporarily experiencing technical difficulties. 

The error: ${errorMessage}

Please try:
1. Rephrasing your question more simply
2. Using Standard mode for immediate assistance
3. Trying again in a few moments

Our legal team at FoxMandal is committed to providing you with the best AI-powered legal assistance. We apologize for any inconvenience.`;
}

function calculateConfidence(response, mode) {
  let baseConfidence = {
    'standard': 0.75,
    'agentic': 0.80,
    'agi': 0.85,
    'asi': 0.90
  }[mode] || 0.75;

  // Adjust based on response characteristics
  if (response.includes('probability') || response.includes('%')) baseConfidence += 0.05;
  if (response.length < 100) baseConfidence -= 0.1;
  if (response.includes('analysis') || response.includes('findings')) baseConfidence += 0.05;
  if (response.includes('error') || response.includes('difficulty')) baseConfidence -= 0.3;

  return Math.max(0.3, Math.min(0.95, baseConfidence));
}

// ===== TTS FUNCTIONS (Male Voice Preference) =====

export const getTTS = async (text, aiMode = 'standard') => {
  return new Promise((resolve) => {
    if (!text || !window.speechSynthesis) {
      resolve();
      return;
    }

    try {
      window.speechSynthesis.cancel();
      
      setTimeout(() => {
        const processedText = text
          .replace(/AGI/g, 'A-G-I')
          .replace(/ASI/g, 'A-S-I')
          .replace(/AI/g, 'A-I')
          .replace(/FoxMandal/g, 'Fox Mandal')
          .substring(0, 1000);

        const utterance = new SpeechSynthesisUtterance(processedText);
        
        const setVoiceAndSpeak = () => {
          const voices = window.speechSynthesis.getVoices();
          
          // Find male voice
          const maleVoice = voices.find(voice => 
            voice.lang.startsWith('en') && (
              voice.name.toLowerCase().includes('male') ||
              voice.name.toLowerCase().includes('david') ||
              voice.name.toLowerCase().includes('daniel') ||
              !voice.name.toLowerCase().includes('female')
            )
          );
          
          if (maleVoice) {
            utterance.voice = maleVoice;
            console.log(`Selected voice: ${maleVoice.name} for ${aiMode} mode`);
          }

          // Mode-specific voice settings
          const voiceSettings = {
            'asi': { rate: 0.7, pitch: 0.6, volume: 0.9 },
            'agi': { rate: 0.8, pitch: 0.7, volume: 0.9 },
            'agentic': { rate: 0.85, pitch: 0.8, volume: 0.85 },
            'standard': { rate: 0.9, pitch: 0.85, volume: 0.8 }
          };

          const settings = voiceSettings[aiMode] || voiceSettings.standard;
          Object.assign(utterance, settings);

          utterance.onend = () => resolve();
          utterance.onerror = () => resolve();

          window.speechSynthesis.speak(utterance);
          
          // Safety timeout
          setTimeout(() => {
            window.speechSynthesis.cancel();
            resolve();
          }, Math.max(8000, processedText.length * 100));
        };

        if (window.speechSynthesis.getVoices().length === 0) {
          window.speechSynthesis.onvoiceschanged = () => {
            setVoiceAndSpeak();
            window.speechSynthesis.onvoiceschanged = null;
          };
        } else {
          setVoiceAndSpeak();
        }
        
      }, 100);
      
    } catch (error) {
      console.warn('TTS error:', error);
      resolve();
    }
  });
};

export const stopTTS = () => {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
};

// ===== OTHER FUNCTIONS =====

export const captureLead = async (leadData, sessionId, aiMode = 'standard') => {
  try {
    const response = await fetch(`${API_BASE_URL}/capture-lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        ...leadData, 
        sessionId, 
        aiMode,
        timestamp: new Date().toISOString()
      })
    });
    
    if (!response.ok) {
      throw new Error(`Lead capture failed: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Lead capture error:', error);
    throw new Error('Failed to capture lead information');
  }
};

export const checkHealth = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    const data = await response.json();
    return {
      status: response.ok ? 'healthy' : 'unhealthy',
      details: data
    };
  } catch (error) {
    return { 
      status: 'error', 
      message: error.message,
      details: { error: 'Unable to reach backend server' }
    };
  }
};

console.log('Real AI Mode System loaded with proper server validation');