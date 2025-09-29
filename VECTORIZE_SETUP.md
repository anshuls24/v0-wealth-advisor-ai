# Vectorize.io RAG System Setup

Your AI-RAG page is now ready! Follow these steps to configure Vectorize.io for document retrieval.

## 🚀 Quick Setup

### 1. Sign up for Vectorize.io
Visit [https://vectorize.io](https://vectorize.io) and create an account.

### 2. Create Organization and Pipeline
1. Create a new organization
2. Create a pipeline for "Document Retrieval"
3. Upload your financial documents (PDFs, text files, etc.)
4. Wait for documents to be processed and vectorized

### 3. Get Your Credentials
From your Vectorize.io dashboard, collect:
- **Access Token**: Generate with "Retrieval Access" permissions
- **Organization ID**: Found in organization settings
- **Pipeline ID**: Found in your pipeline details

### 4. Configure Environment Variables
Add these to your `.env.local` file:

```bash
# Vectorize.io Configuration
VECTORIZE_PIPELINE_ACCESS_TOKEN=your_access_token_here
VECTORIZE_ORGANIZATION_ID=your_organization_id_here
VECTORIZE_PIPELINE_ID=your_pipeline_id_here
```

## 🔧 Features Implemented

Based on the [rag-next-typescript](https://github.com/trancethehuman/rag-next-typescript) repository and using the official Vectorize.io client:

### ✅ Core Components
- **Vectorize Service** (`lib/vectorize.ts`) - Official `@vectorize-io/vectorize-client` integration
- **RAG API Endpoint** (`app/api/rag-chat/route.ts`) - Handles chat with document context
- **RAG Chat Interface** (`components/rag-chat.tsx`) - User interface with source display
- **AI-RAG Page Integration** - Fully integrated into your main application

### ✅ Official Client Integration
- **Package**: `@vectorize-io/vectorize-client` v0.4.0 installed via pnpm
- **Type Safety**: Full TypeScript support with official client types
- **Reliability**: Uses official API methods and error handling
- **Performance**: Optimized queries with built-in retry logic

### ✅ Key Features
- **Document Retrieval**: Searches your knowledge base using semantic similarity
- **Context-Aware Responses**: AI responses augmented with retrieved documents
- **Source Citations**: Shows which documents informed each response
- **Relevance Scoring**: Documents ranked by relevance with confidence scores
- **Real-time Chat**: Streaming responses with loading indicators
- **Error Handling**: Graceful fallbacks when documents can't be retrieved

## 🎯 How It Works

1. **User Query**: User asks a question in the AI-RAG tab
2. **Document Search**: System searches Vectorize.io for relevant documents
3. **Context Formation**: Retrieved documents are formatted as context
4. **AI Generation**: GPT-4o-mini generates response using document context
5. **Response Display**: Answer shown with source document citations

## 🔍 Usage Examples

Try asking questions like:
- "What are the key financial strategies mentioned in the documents?"
- "Tell me about risk management approaches"
- "What investment recommendations are provided?"
- "Summarize the main points about portfolio diversification"

## 🛠️ Customization

### Adjust Retrieval Parameters
In `app/api/rag-chat/route.ts`, modify:
```typescript
const retrievedDocuments = await vectorizeClient.retrieveDocuments(
  userQuery,
  5,    // limit: number of documents to retrieve
  0.7   // threshold: minimum relevance score (0-1)
)
```

### Modify AI Behavior
Adjust the system prompt in `app/api/rag-chat/route.ts` to change how the AI uses retrieved context.

## 🚨 Troubleshooting

### Common Issues
1. **"RAG system not configured"** - Check environment variables
2. **"Failed to retrieve documents"** - Verify Vectorize.io credentials
3. **No relevant documents found** - Upload more documents or lower threshold

### Debug Mode
Check browser console and server logs for detailed error messages and retrieval information.

## 📚 Next Steps

1. Upload your financial documents to Vectorize.io
2. Test the system with sample queries
3. Adjust retrieval parameters based on your document types
4. Customize the UI to match your brand

Your RAG system is now ready to provide intelligent, document-backed responses! 🎉
