# WealthAI Advisor

A sophisticated, production-ready AI-powered wealth management assistant that demonstrates advanced capabilities including intelligent financial planning, user profile management, market analysis, and personalized investment recommendations. Built with modern web technologies and deployed to production.

🎯 **Agent Capabilities Summary**

The WealthAI Advisor is a fully autonomous intelligent financial system that:

- **Understands Financial Context** - Analyzes user profiles and determines optimal investment strategies
- **Manages User Profiles** - Collects and maintains comprehensive financial profiles with flexible requirements
- **Provides Market Intelligence** - Real-time market updates and news analysis with web search capabilities
- **Generates Personalized Recommendations** - Tailored investment advice based on individual risk tolerance and goals
- **Tracks Progress** - Continuous profile completion monitoring and summary generation
- **Self-Optimizes** - Adapts questioning strategy based on user responses and profile completeness

📊 **Project Metrics**

- **4 Core Modules** - Chat Advisor, AI-RAG System, Market News, Financial Tools
- **RAG Implementation** - Document retrieval with source citations and streaming responses
- **Real-time Profile Management** - Dynamic user profile collection and storage
- **Web Search Integration** - Live market data and news analysis
- **Flexible Profile Requirements** - Adaptive questioning based on user responses
- **Production Deployed** - Live and accessible on Vercel
- **LocalStorage + Database Ready** - Prepared for seamless migration to Supabase

🚀 **Features**

## Core Capabilities

🤖 **Intelligent Chat Advisor**: Sophisticated AI agent that collects user profiles and provides personalized financial advice
🌐 **Market News & Analysis**: Real-time market updates with web search integration and source citations
📊 **Financial Tools**: Comprehensive suite of financial calculators and chart generators
🔍 **RAG System (NEW)**: Retrieval-Augmented Generation for document-based financial Q&A with source citations
💡 **Smart Profile Management**: Dynamic profile collection with flexible requirements and completion tracking
📚 **Source Attribution**: Expandable source citations with direct links for market data
🗄️ **Dual Storage Modes**: LocalStorage for development, Supabase-ready for production
⚡ **Real-time Updates**: Live profile completion tracking and summary generation
🎛️ **Interactive UI**: Modern, responsive interface with tabbed navigation
📊 **Profile Completion Analytics**: Comprehensive tracking of user data collection progress

## Technical Highlights

- **AI SDK Integration** - Vercel AI SDK with OpenAI GPT-4o for intelligent conversations
- **RAG Implementation** - Document retrieval with semantic search and source citations
- **Web Search Tools** - Real-time market data fetching with source attribution
- **Profile Schema Management** - Flexible JSON schema with completion percentage tracking
- **State Management** - Robust React state management with in-memory persistence
- **Streaming Responses** - Real-time AI responses with manual streaming parser
- **Responsive Design** - Modern UI with Tailwind CSS and shadcn/ui components
- **Error Handling** - Comprehensive error management and user feedback
- **Debug Tools** - Built-in debugging utilities for profile state inspection

🔒 **Security Features**

- **Input Validation** - Comprehensive validation of user inputs and profile data
- **Error Boundaries** - Graceful error handling with user-friendly messages
- **Type Safety** - Full TypeScript implementation with strict type checking
- **Data Sanitization** - Safe handling of user profile data and financial information

🏗️ **Architecture Overview**

## Component Overview

- **Chat Advisor**: Main conversational interface with profile collection and financial advice
- **AI-RAG System**: Document retrieval and Q&A with source citations and semantic search
- **Market News**: Real-time market analysis with web search capabilities
- **Financial Tools**: Calculator and chart generation utilities
- **Profile Management**: Dynamic user profile collection and storage system
- **Storage Layer**: In-memory state management with future database integration support

🚀 **Getting Started**

## Prerequisites

- Node.js 18.17 or later
- pnpm 8.0 or later
- OpenAI API Key with GPT-4o access

## Quick Start

Clone and install:
```bash
git clone https://github.com/anshuls24/v0-wealth-advisor-ai.git
cd v0-wealth-advisor-ai
pnpm install
```

Configure environment:
```bash
cp .env.example .env.local
# Add your OpenAI API key to .env.local
```

Start development server:
```bash
pnpm dev
```

Open browser: Navigate to http://localhost:3000

## First Steps

1. **Start Chatting**: Begin a conversation with the AI wealth advisor
2. **Build Your Profile**: Answer questions about your financial goals, risk tolerance, and situation
3. **Get Recommendations**: Receive personalized investment advice based on your profile
4. **Explore Market News**: Check real-time market updates and analysis
5. **Use Financial Tools**: Access calculators and chart generators

💻 **Usage Examples**

## Profile Collection

**User**: "I want to invest for retirement"
**AI**: "Great! Let's start building your financial profile. What's your primary investment goal for retirement?"

**User**: "I have moderate risk tolerance and about $50,000 to invest"
**AI**: "Perfect! I've noted your moderate risk tolerance and $50,000 investment amount. What's your time horizon for this investment?"

## Market Analysis

**User**: "What's happening with tech stocks today?"
**AI**: "Let me search for the latest tech stock information..." 
*[Searches web and provides real-time data with sources]*

## Financial Planning

**User**: "Help me plan for a house down payment"
**AI**: "I'll help you create a savings plan. What's your target down payment amount and timeline?"

🛠️ **Tech Stack**

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript (strict mode)
- **AI**: Vercel AI SDK + OpenAI GPT-4o
- **UI**: shadcn/ui components + Tailwind CSS
- **Storage**: In-memory state (development) / Database integration ready
- **Web Search**: AI SDK web search tools with source attribution
- **State Management**: React hooks with in-memory state persistence
- **Code Quality**: ESLint, Prettier, TypeScript strict mode

📦 **API Endpoints**

## POST /api/conversation
Main chat endpoint for the wealth advisor.

**Request:**
```json
{
  "messages": [
    {
      "role": "user",
      "content": "I want to start investing"
    }
  ],
  "userId": "user_123"
}
```

**Response:**
```json
{
  "response": "I'd be happy to help you start investing! Let's begin by understanding your financial goals...",
  "sources": [],
  "mode": "chat"
}
```

## POST /api/rag-chat
RAG (Retrieval-Augmented Generation) endpoint for document-based Q&A.

**Request:**
```json
{
  "messages": [
    {
      "role": "user",
      "content": "What is financial planning?"
    }
  ]
}
```

**Response:**
```json
{
  "response": "Based on the retrieved documents, financial planning is the process of creating a comprehensive strategy for managing your finances to achieve your life goals...",
  "sources": [
    {
      "id": "doc-1",
      "title": "Introduction to Financial Planning",
      "url": "https://example.com/financial-planning-guide",
      "score": 0.95
    }
  ],
  "mode": "rag"
}
```

## POST /api/market-news
Market news and analysis endpoint with web search.

**Request:**
```json
{
  "messages": [
    {
      "role": "user", 
      "content": "What's the latest on Apple stock?"
    }
  ]
}
```

**Response:**
```json
{
  "response": "Based on the latest market data, Apple stock is currently...",
  "sources": [
    {
      "url": "https://finance.yahoo.com/quote/AAPL",
      "title": "Apple Inc. (AAPL) Stock Price"
    }
  ],
  "mode": "market_analysis"
}
```

🚢 **Deployment**

## Vercel Deployment (Recommended)

Push to GitHub:
```bash
git push origin main
```

Import to Vercel:
1. Go to vercel.com
2. Import your repository
3. Add environment variables:
   - `OPENAI_API_KEY`: Your OpenAI API key

## Environment Variables

```bash
# Required
OPENAI_API_KEY=sk-...your-key-here

# Optional (for future Supabase integration)
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
```

📊 **Profile Management System**

## Profile Schema

```typescript
interface ClientProfile {
  goals: {
    short_term: string | null;
    medium_term: string | null;
    long_term: string | null;
  };
  risk: {
    tolerance: string | null;
    history: string | null;
  };
  financials: {
    income: string | null;
    assets: string | null;
    expenses: string | null;
  };
  time_horizon: string | null;
  preferences: string[];
  expectations: string[];
}
```

## Completion Tracking

- **Flexible Requirements**: Only 2 of 3 goals needed, 1 preference, 1 expectation
- **Real-time Updates**: Profile completion percentage calculated dynamically
- **Summary Generation**: Automatic profile summaries at 75% and 100% completion
- **User Verification**: Editable summaries with confirmation workflow

🔍 **RAG System (Retrieval-Augmented Generation)**

## Overview

The RAG system provides document-based Q&A capabilities, allowing users to query financial documents and receive accurate, source-cited responses. This system is completely isolated from the main chat advisor to ensure focused document retrieval without profile-building interference.

## Key Features

- **Document Retrieval**: Semantic search through financial documents with relevance scoring
- **Source Citations**: Every response includes document sources with titles, URLs, and relevance scores
- **Streaming Responses**: Real-time response generation with manual streaming parser
- **Complete Isolation**: Separate from advisor chat to prevent cross-contamination
- **Mock Implementation**: Currently uses mock financial documents for demonstration

## Behavior Update (Sep 2025)

- Simplified, conversational system prompt for RAG to reduce brittleness and generic replies
- Relaxed greeting filter: only exact greetings (e.g., "hi", "hello") return the canned onboarding line; short queries like "IRA" now pass through to retrieval
- Lower temperature to 0.1 for focused, factual answers; capped response length (`maxTokens: 500`)
- Sources are returned via the `X-Document-Sources` response header and displayed in the UI
- Tip: If you get the greeting line, try a more specific query or avoid pure greeting words

Example queries that work well now:
- "IRA"
- "Roth IRA vs Traditional IRA"
- "Portfolio diversification basics"
- "What is wealth management?"

## Architecture

```typescript
// Document Interface
interface VectorizeDocument {
  id: string;
  content: string;
  metadata?: {
    title?: string;
    source?: string;
    url?: string;
  };
  score?: number;
}

// RAG Response Format
interface RAGResponse {
  documents: VectorizeDocument[];
  query: string;
  total_results: number;
}
```

## Mock Document Collection

The system includes comprehensive financial documents covering:

- **Financial Planning**: Comprehensive strategy creation and goal setting
- **Investment Diversification**: Risk management and portfolio construction
- **Risk Tolerance**: Understanding and assessing investment risk preferences
- **Retirement Planning**: 401(k), IRA, and retirement income strategies
- **Emergency Funds**: Building financial security and emergency preparedness

## Usage Examples

**Query**: "What is wealth management?"
**Response**: Combines information from multiple documents about financial planning, investment diversification, and risk management, with full source citations.

**Query**: "How should I diversify my portfolio?"
**Response**: Retrieves and synthesizes information from investment diversification documents with specific strategies and recommendations.

## Technical Implementation

- **Endpoint**: `/api/rag-chat` - Dedicated RAG processing endpoint
- **Client**: `components/rag-chat.tsx` - Isolated chat interface with source display
- **Service**: `lib/vectorize.ts` - Mock document retrieval with keyword matching
- **Streaming**: Custom streaming parser for real-time response display
- **Debugging**: Comprehensive logging for document retrieval and AI responses

## Future Enhancements

- **Real Vectorize.io Integration**: Replace mock implementation with actual vector database
- **Document Upload**: Allow users to upload their own financial documents
- **Advanced Search**: Implement semantic similarity search with embeddings
- **Document Management**: Add, edit, and organize document collections

🗺️ **Development Roadmap**

## Recently Completed ✅

- **RAG System Implementation** - Document retrieval with source citations and streaming responses
- **Profile Management System** - Dynamic collection with flexible requirements
- **Market News Integration** - Real-time web search with source attribution
- **LocalStorage Implementation** - Client-side profile persistence
- **Debug Tools** - Comprehensive debugging utilities
- **UI/UX Improvements** - Modern, responsive interface

## Next Priority Items

- **Real Vectorize.io Integration** - Replace mock RAG with actual vector database
- **Supabase Integration** - Database storage for production
- **Profile Analytics** - Advanced completion tracking and insights
- **Enhanced Market Tools** - More sophisticated financial analysis
- **User Authentication** - Secure user accounts and data protection

## Coming Soon

- **Document Upload** - User document upload for personalized RAG
- **Portfolio Tracking** - Investment performance monitoring
- **Goal Progress** - Visual progress tracking for financial goals
- **Advanced Analytics** - Comprehensive financial health scoring
- **Mobile App** - React Native companion app

⚠️ **Known Issues & Limitations**

- **Profile Reset Bug** - Occasionally profile data resets (under investigation)
- **LocalStorage Limits** - Browser storage limitations for large profiles
- **Web Search Rate Limits** - API rate limiting for market data
- **Profile Completion UI** - Removed due to responsiveness issues (will be redesigned)

📋 **Development Commands**

```bash
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm start        # Start production server
pnpm lint         # Lint code with ESLint
pnpm lint:fix     # Auto-fix ESLint issues
pnpm format       # Format code with Prettier
pnpm format:check # Check formatting without changes
```

🧪 **Testing**

The project includes comprehensive debugging and testing utilities:

- **Profile State Debugging** - Real-time profile state inspection
- **LocalStorage Testing** - Storage functionality verification
- **API Endpoint Testing** - Chat and market news endpoint validation
- **UI Component Testing** - Interactive component verification

Run development server with debugging:
```bash
pnpm dev
```

📐 **Code Standards**

- **Functions**: Maximum 50 lines
- **Files**: Maximum 500 lines
- **TypeScript**: Strict mode enabled
- **Architecture**: Component-based with clear separation of concerns
- **Testing**: Comprehensive debugging utilities
- **Documentation**: Inline comments and README updates

🔄 **Development Workflow**

The project maintains detailed documentation:

- **README.md**: This comprehensive project overview
- **API Documentation**: Endpoint specifications and usage examples
- **Profile Schema**: User data structure and validation rules
- **Debug Tools**: Built-in debugging utilities for development

🤝 **Contributing**

1. Fork the repository
2. Create a feature branch
3. Follow TypeScript strict mode
4. Ensure all debugging tools work
5. Submit pull request

📚 **Documentation**

- **API Documentation** - Detailed endpoint specifications
- **Profile Management** - User data collection and storage
- **Market Integration** - Web search and source attribution
- **Deployment Guide** - Production setup instructions

---

**Live Demo**: [https://vercel.com/anshuls24-8311s-projects/v0-wealth-advisor-ai](https://vercel.com/anshuls24-8311s-projects/v0-wealth-advisor-ai)

**Built with**: [v0.app](https://v0.app/chat/projects/jtJfYnINkf1)

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/anshuls24-8311s-projects/v0-wealth-advisor-ai)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.app-black?style=for-the-badge)](https://v0.app/chat/projects/jtJfYnINkf1)