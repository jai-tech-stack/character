// Real AI Mode System - chatApi.js
// This creates GENUINE AI mode differences, not fake responses

const API_BASE_URL = 'https://character-chan.onrender.com';

console.log('Loading REAL AI Mode System for FoxMandal...');

// ===== REAL AI MODE IMPLEMENTATIONS =====

class RealAIProcessor {
  constructor() {
    this.conversationHistory = new Map();
  }

  // STANDARD AI - Traditional single-turn legal consultation
  async processStandard(message, sessionId) {
    const context = this.getConversationContext(sessionId);
    
    return await this.sendToBackend({
      message,
      sessionId,
      aiMode: 'standard',
      systemPrompt: `You are Advocate Arjun from FoxMandal law firm. Provide direct legal advice based on Indian law. Keep responses concise and practical.`,
      temperature: 0.7,
      maxTokens: 200,
      processingType: 'single_turn'
    });
  }

  // AGENTIC AI - Multi-step autonomous reasoning with action planning
  async processAgentic(message, sessionId) {
    const context = this.getConversationContext(sessionId);
    
    // Step 1: Analyze the legal query
    const analysis = await this.analyzeQuery(message);
    
    // Step 2: Create action plan
    const actionPlan = await this.createActionPlan(analysis, message);
    
    // Step 3: Execute research steps
    const researchResults = await this.executeResearch(actionPlan, message);
    
    // Step 4: Synthesize final response
    return await this.synthesizeAgenticResponse(message, analysis, actionPlan, researchResults, sessionId);
  }

  // AGI - Cross-domain analysis combining legal, business, technical perspectives
  async processAGI(message, sessionId) {
    const context = this.getConversationContext(sessionId);
    
    // Analyze from multiple domains simultaneously
    const [legalAnalysis, businessAnalysis, technicalAnalysis, ethicalAnalysis] = await Promise.all([
      this.analyzeLegalDomain(message, context),
      this.analyzeBusinessDomain(message, context),
      this.analyzeTechnicalDomain(message, context),
      this.analyzeEthicalDomain(message, context)
    ]);

    return await this.synthesizeAGIResponse(message, {
      legal: legalAnalysis,
      business: businessAnalysis,
      technical: technicalAnalysis,
      ethical: ethicalAnalysis
    }, sessionId);
  }

  // ASI - Advanced probabilistic analysis with future projections
  async processASI(message, sessionId) {
    const context = this.getConversationContext(sessionId);
    
    // Generate probabilistic scenarios
    const scenarios = await this.generateScenarios(message, context);
    
    // Calculate risk assessments
    const riskAssessment = await this.calculateRisks(message, scenarios);
    
    // Create future projections
    const projections = await this.createProjections(message, scenarios, riskAssessment);
    
    return await this.synthesizeASIResponse(message, scenarios, riskAssessment, projections, sessionId);
  }

  // === AGENTIC AI HELPER METHODS ===
  
  async analyzeQuery(message) {
    return await this.sendToBackend({
      message: `Analyze this legal query and identify: 1) Legal areas involved, 2) Complexity level, 3) Required research tasks, 4) Potential challenges: "${message}"`,
      systemPrompt: `You are a legal analyst. Provide structured analysis in exactly this format:
LEGAL AREAS: [list areas]
COMPLEXITY: [high/medium/low] 
RESEARCH TASKS: [numbered list of specific tasks]
CHALLENGES: [potential issues]`,
      temperature: 0.3,
      maxTokens: 150
    });
  }

  async createActionPlan(analysis, originalMessage) {
    return await this.sendToBackend({
      message: `Based on this analysis: "${analysis}", create a step-by-step action plan for: "${originalMessage}"`,
      systemPrompt: `Create a detailed action plan. Format as:
STEP 1: [specific action]
STEP 2: [specific action] 
STEP 3: [specific action]
EXPECTED OUTCOME: [what this will achieve]`,
      temperature: 0.2,
      maxTokens: 200
    });
  }

  async executeResearch(actionPlan, originalMessage) {
    return await this.sendToBackend({
      message: `Execute this research plan: "${actionPlan}" for the query: "${originalMessage}". Provide findings for each step.`,
      systemPrompt: `You are executing legal research. For each step in the plan, provide specific findings, relevant laws, and practical insights. Be detailed and specific.`,
      temperature: 0.4,
      maxTokens: 300
    });
  }

  async synthesizeAgenticResponse(message, analysis, actionPlan, research, sessionId) {
    const finalPrompt = `
ORIGINAL QUERY: ${message}
ANALYSIS PERFORMED: ${analysis}
ACTION PLAN EXECUTED: ${actionPlan}
RESEARCH RESULTS: ${research}

As an autonomous legal agent, synthesize this information into actionable recommendations.`;

    return await this.sendToBackend({
      message: finalPrompt,
      sessionId,
      aiMode: 'agentic',
      systemPrompt: `You are an autonomous legal agent. Present your findings as:

AUTONOMOUS ANALYSIS COMPLETE:

Key Findings:
[Bullet points of discoveries]

Actions Taken:
[What research was performed]

Strategic Recommendations:
[Specific next steps]

Next Autonomous Actions:
[What you would do next independently]`,
      temperature: 0.3,
      maxTokens: 400
    });
  }

  // === AGI HELPER METHODS ===

  async analyzeLegalDomain(message, context) {
    return await this.sendToBackend({
      message: `Analyze the legal aspects of: "${message}". Focus on Indian law, regulations, compliance requirements.`,
      systemPrompt: `Analyze only the legal domain. Identify applicable laws, legal risks, compliance requirements, and procedural considerations under Indian law.`,
      temperature: 0.3,
      maxTokens: 150
    });
  }

  async analyzeBusinessDomain(message, context) {
    return await this.sendToBackend({
      message: `Analyze the business implications of: "${message}". Focus on costs, risks, opportunities, market impact.`,
      systemPrompt: `Analyze only the business domain. Consider financial implications, operational impact, market consequences, and commercial viability.`,
      temperature: 0.4,
      maxTokens: 150
    });
  }

  async analyzeTechnicalDomain(message, context) {
    return await this.sendToBackend({
      message: `Analyze the technical/procedural requirements for: "${message}". Focus on implementation steps, documentation, processes.`,
      systemPrompt: `Analyze only technical and procedural aspects. Consider implementation requirements, documentation needs, process flows, and operational procedures.`,
      temperature: 0.3,
      maxTokens: 150
    });
  }

  async analyzeEthicalDomain(message, context) {
    return await this.sendToBackend({
      message: `Analyze the ethical and social implications of: "${message}". Focus on stakeholder impact, fairness, social responsibility.`,
      systemPrompt: `Analyze only ethical and social aspects. Consider stakeholder impact, fairness, social responsibility, and broader societal implications.`,
      temperature: 0.4,
      maxTokens: 150
    });
  }

  async synthesizeAGIResponse(message, analyses, sessionId) {
    const crossDomainPrompt = `
QUERY: ${message}

LEGAL ANALYSIS: ${analyses.legal}
BUSINESS ANALYSIS: ${analyses.business}
TECHNICAL ANALYSIS: ${analyses.technical}
ETHICAL ANALYSIS: ${analyses.ethical}

Provide cross-domain integrated recommendations.`;

    return await this.sendToBackend({
      message: crossDomainPrompt,
      sessionId,
      aiMode: 'agi',
      systemPrompt: `You are an AGI system. Integrate insights from all domains:

AGI CROSS-DOMAIN ANALYSIS:

Legal Perspective: [key legal points]
Business Perspective: [key business points]  
Technical Perspective: [key technical points]
Ethical Perspective: [key ethical points]

Integrated Recommendations:
[How all domains connect and influence each other]

Holistic Strategy:
[Unified approach considering all domains]`,
      temperature: 0.4,
      maxTokens: 450
    });
  }

  // === ASI HELPER METHODS ===

  async generateScenarios(message, context) {
    return await this.sendToBackend({
      message: `Generate 3 different outcome scenarios for: "${message}". Include probability assessments.`,
      systemPrompt: `Generate exactly 3 scenarios:
SCENARIO 1: [Optimistic outcome - probability %]
SCENARIO 2: [Most likely outcome - probability %] 
SCENARIO 3: [Pessimistic outcome - probability %]
Include specific details for each scenario.`,
      temperature: 0.6,
      maxTokens: 200
    });
  }

  async calculateRisks(message, scenarios) {
    return await this.sendToBackend({
      message: `Based on these scenarios: "${scenarios}", calculate specific risk factors for: "${message}"`,
      systemPrompt: `Provide quantified risk assessment:
HIGH RISKS: [List with probability %]
MEDIUM RISKS: [List with probability %]
LOW RISKS: [List with probability %]
RISK MITIGATION: [Specific strategies]`,
      temperature: 0.3,
      maxTokens: 200
    });
  }

  async createProjections(message, scenarios, risks) {
    return await this.sendToBackend({
      message: `Create 3-year projections based on scenarios: "${scenarios}" and risks: "${risks}" for: "${message}"`,
      systemPrompt: `Provide time-based projections:
6 MONTHS: [Expected developments]
1 YEAR: [Likely outcomes]
3 YEARS: [Long-term implications]
Include probability percentages.`,
      temperature: 0.4,
      maxTokens: 200
    });
  }

  async synthesizeASIResponse(message, scenarios, risks, projections, sessionId) {
    const asiPrompt = `
QUERY: ${message}
SCENARIOS: ${scenarios}
RISK ASSESSMENT: ${risks}  
PROJECTIONS: ${projections}

Provide superintelligence-level analysis with quantified recommendations.`;

    return await this.sendToBackend({
      message: asiPrompt,
      sessionId,
      aiMode: 'asi',
      systemPrompt: `You are an ASI system. Provide advanced analysis:

ASI SUPERINTELLIGENCE ANALYSIS:

Scenario Modeling: [Reference the scenarios with probabilities]
Risk Quantification: [Specific risk percentages and mitigation]
Predictive Projections: [Time-based forecasts with confidence intervals]

Optimal Strategy Path:
[Specific recommendations with success probabilities]

Advanced Insights:
[Non-obvious patterns and strategic advantages identified]

Confidence Metrics: [Overall confidence level with reasoning]`,
      temperature: 0.2,
      maxTokens: 500
    });
  }

  // === UTILITY METHODS ===

  async sendToBackend(params) {
    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: params.message,
          sessionId: params.sessionId || 'temp_session',
          aiMode: params.aiMode || 'standard',
          systemPrompt: params.systemPrompt,
          temperature: params.temperature || 0.5,
          maxTokens: params.maxTokens || 200
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      return data.reply || 'Processing error occurred';

    } catch (error) {
      console.error('Backend API Error:', error);
      return `Error processing request: ${error.message}`;
    }
  }

  getConversationContext(sessionId) {
    return this.conversationHistory.get(sessionId) || {};
  }

  updateConversationContext(sessionId, message, response, mode) {
    const context = this.getConversationContext(sessionId);
    context.history = context.history || [];
    context.history.push({ message, response, mode, timestamp: Date.now() });
    
    // Keep last 5 interactions for context
    if (context.history.length > 5) {
      context.history = context.history.slice(-5);
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
  const session = sessionId || `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

  try {
    let response;
    
    console.log(`Processing ${aiMode} mode request...`);
    
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
    throw new Error(`Failed to process ${aiMode} request: ${error.message}`);
  }
};

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

  return Math.max(0.5, Math.min(0.95, baseConfidence));
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
  // Implementation remains the same as in your original code
  try {
    const response = await fetch(`${API_BASE_URL}/capture-lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...leadData, sessionId, aiMode })
    });
    return await response.json();
  } catch (error) {
    throw new Error('Failed to capture lead');
  }
};

export const checkHealth = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return await response.json();
  } catch (error) {
    return { status: 'error', message: error.message };
  }
};

console.log('Real AI Mode System loaded - Genuine differentiation enabled');