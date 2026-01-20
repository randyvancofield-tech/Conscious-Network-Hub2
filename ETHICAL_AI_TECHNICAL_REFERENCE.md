# Ethical AI Insight - Technical Reference

## Component Architecture

### Component Tree
```
Dashboard
  └── EthicalAIInsight
      ├── Daily Wisdom View
      ├── Q&A View
      └── Issue Report View
```

### File Locations
- **Component**: `/components/EthicalAIInsight.tsx` (347 lines)
- **Service Functions**: `/services/geminiService.ts` (enhanced)
- **Dashboard Integration**: `/components/Dashboard.tsx` (updated)

---

## New Service Functions in geminiService.ts

### 1. `getDailyWisdom()`

**Purpose**: Generate daily wisdom combining AI, blockchain, spirituality, and consciousness

**Function Signature**:
```typescript
export const getDailyWisdom = async () => {
  return { text, groundingChunks };
}
```

**Returns**:
- `text` (string): The daily wisdom message
- `groundingChunks` (GroundingChunk[]): Source citations

**System Prompt**:
```
"You are the Conscious Network Hub Daily Wisdom Generator. Create authentic, multidisciplinary insights that honor AI ethics, blockchain technology, spiritual development, and collective consciousness."
```

**Features**:
- Uses Google Search tool for grounded information
- Temperature: 0.8 (creative but focused)
- Model: gemini-3-flash-preview
- Fallback message if service unavailable

---

### 2. `askEthicalAI(question: string, context?: { category? })`

**Purpose**: Answer questions about platform, wellness, or general topics

**Function Signature**:
```typescript
export const askEthicalAI = async (
  question: string, 
  context?: { category?: 'platform' | 'wellness' | 'general' }
) => {
  return { text, groundingChunks };
}
```

**Parameters**:
- `question` (string): User's question
- `context.category` (optional): 'platform', 'wellness', or 'general'

**Returns**:
- `text` (string): AI response
- `groundingChunks` (GroundingChunk[]): Source citations

**Context-Specific System Prompts**:

**Platform**:
```
"You are the Conscious Network Hub Ethical AI Assistant. You provide knowledgeable, compassionate responses about:
- Higher Conscious Network LLC mission and vision
- Conscious Network Hub platform features and capabilities
- Decentralized identity and data sovereignty
- Provider and community engagement"
```

**Wellness**:
```
"You are the Conscious Network Hub Ethical AI Assistant. You provide knowledgeable, compassionate responses about:
- Mental wellness and emotional health
- Spiritual development and consciousness
- Learning pathways and course topics
- Personal growth and alignment practices"
```

**General**:
```
"You are the Conscious Network Hub Ethical AI Assistant. You provide knowledgeable, compassionate responses about:
- Platform information and wellness topics
- AI ethics and decentralization
- Blockchain and sovereignty
- Spiritual and educational insights"
```

**Features**:
- Uses Google Search tool for current information
- Temperature: 0.7 (balanced accuracy and creativity)
- Model: gemini-3-flash-preview
- Context-aware system instructions

---

### 3. `processPlatformIssue(issue)`

**Purpose**: Analyze platform issues and provide AI direction

**Function Signature**:
```typescript
export const processPlatformIssue = async (issue: {
  title: string;
  description: string;
  category: string;
  userEmail?: string;
}) => {
  return { analysis, timestamp, status };
}
```

**Parameters**:
- `title` (string): Brief issue title
- `description` (string): Detailed description
- `category` (string): Issue category
- `userEmail` (optional): User's email for follow-up

**Returns**:
- `analysis` (string): AI analysis including:
  - Issue acknowledgment
  - Severity assessment
  - Recommended steps
  - Priority level
  - Support direction
- `timestamp` (ISO string): When the issue was processed
- `status` (string): 'acknowledged' or 'logged'

**System Prompt**:
```
"You are the Conscious Network Hub Support AI. Analyze platform issues with empathy and technical understanding. Provide clear guidance for resolution while maintaining the platform's ethical standards."
```

**Analysis Includes**:
1. Acknowledgment of the issue
2. Initial severity assessment
3. Recommended resolution steps
4. Priority level: Low, Medium, High, or Critical
5. Support guidance and direction

**Features**:
- Immediate AI-powered response
- Professional support tone
- Actionable next steps
- Structured output for triage

---

## Component State Management

### EthicalAIInsight State Variables

**View Control**:
```typescript
const [viewMode, setViewMode] = useState<ViewMode>('insight');
// 'insight' | 'qa' | 'report'
```

**Daily Wisdom State**:
```typescript
const [dailyWisdom, setDailyWisdom] = useState<string>('');
const [wisdomSources, setWisdomSources] = useState<GroundingChunk[]>([]);
const [loading, setLoading] = useState(true);
```

**Q&A State**:
```typescript
const [qaMessages, setQaMessages] = useState<{
  role: 'user' | 'ai';
  content: string;
  sources?: GroundingChunk[];
}[]>([]);
const [qaInput, setQaInput] = useState('');
const [qaLoading, setQaLoading] = useState(false);
const [selectedQACategory, setSelectedQACategory] = useState<'platform' | 'wellness' | 'general'>('general');
```

**Issue Report State**:
```typescript
const [reportTitle, setReportTitle] = useState('');
const [reportDescription, setReportDescription] = useState('');
const [reportCategory, setReportCategory] = useState('bug');
const [reportLoading, setReportLoading] = useState(false);
const [reportResult, setReportResult] = useState<any>(null);
```

---

## Event Handlers

### Daily Wisdom
```typescript
useEffect(() => {
  const loadDailyWisdom = async () => {
    setLoading(true);
    const { text, groundingChunks } = await getDailyWisdom();
    setDailyWisdom(text);
    setWisdomSources(groundingChunks || []);
    setLoading(false);
  };
  loadDailyWisdom(); // Runs on component mount
}, []);
```

### Q&A Message Handling
```typescript
const handleQASubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  // Add user message to history
  // Make API call with selected category
  // Add AI response to history with sources
  // Clear input
};
```

### Issue Report Submission
```typescript
const handleReportSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  // Call processPlatformIssue with form data
  // Display result with AI analysis
  // Allow user to submit another report
};
```

---

## UI Structure

### Mode Selector Bar
```
[✨ Daily Wisdom] [💭 Ask AI] [⚠️ Report Issue]
```
- Toggle buttons
- Selected state: `bg-blue-600`
- Unselected state: `bg-white/5`

### Daily Wisdom View
```
┌─────────────────────────────────────┐
│ ✨ Ethical AI Insight      Active   │
├─────────────────────────────────────┤
│                                     │
│ [Daily wisdom message text...]      │
│                                     │
├─────────────────────────────────────┤
│ 🌐 Grounded In:                     │
│ [Source 1] [Source 2] [Source 3]    │
└─────────────────────────────────────┘
```

### Q&A View
```
┌─────────────────────────────────────┐
│ [Platform] [Wellness] [General]     │
├─────────────────────────────────────┤
│ Chat Messages Area (scrollable)     │
│                                     │
│ User:  [Question message]           │
│ AI:    [Response with sources]      │
│                                     │
├─────────────────────────────────────┤
│ [Input Field] [Send Button]         │
└─────────────────────────────────────┘
```

### Issue Report View
```
┌─────────────────────────────────────┐
│ Category: [Dropdown - Bug/Feature]  │
│ Title: [Text Input]                 │
│ Description: [Textarea]             │
│ [Submit Report Button]              │
├─────────────────────────────────────┤
│ Result (after submission):          │
│ ✓ Report Received                   │
│ [AI Analysis]                       │
│ [Submit Another Report]             │
└─────────────────────────────────────┘
```

---

## Error Handling

### Graceful Degradation
Each function has try-catch blocks:

```typescript
try {
  // API call
} catch (error: any) {
  console.error("Error:", error);
  return {
    text: "Fallback message...",
    groundingChunks: []
  };
}
```

**Fallback Messages**:
- Daily Wisdom: "The consciousness stream flows through interconnected networks..."
- Q&A: "I'm experiencing a temporary connection lag..."
- Issues: "Your issue has been received and logged..."

---

## Integration Points

### With Dashboard
```typescript
// In Dashboard.tsx
import EthicalAIInsight from './EthicalAIInsight';

// Usage
<EthicalAIInsight userEmail={user?.email} />
```

### With Types
```typescript
// From geminiService.ts
export interface GroundingChunk {
  web?: { uri: string; title: string };
  maps?: { uri: string; title: string };
}
```

---

## Performance Considerations

1. **Lazy Loading**: Wisdom generated on component mount
2. **Message Scrolling**: Auto-scroll to latest message
3. **Loading States**: Spinners show during API calls
4. **Debouncing**: Input handling with form submission
5. **Memory**: Session-based message history (cleared on unmount)

---

## Testing Recommendations

### Unit Tests
- `getDailyWisdom()` returns valid text and chunks
- `askEthicalAI()` handles all three categories correctly
- `processPlatformIssue()` returns proper analysis

### Integration Tests
- Mode switching works correctly
- Messages display properly in Q&A
- Forms validate and submit correctly
- Error states display fallback messages

### Manual Testing
- Test all three modes
- Verify source links are clickable
- Test rapid message submission
- Test form validation
- Check mobile responsiveness

---

## Environment Requirements

- Google Generative AI API key (in environment)
- `@google/genai` package installed
- React 17+ (for hooks)
- Lucide React for icons

---

## Future Enhancement Opportunities

1. **Persistence**: Store conversation history in localStorage
2. **Analytics**: Track common questions and issues
3. **Integration**: Link issues directly to support tickets
4. **Personalization**: Learn user preferences over time
5. **Audio**: Add voice input/output
6. **Multi-language**: Support multiple languages
7. **Attachments**: Allow image/file uploads with issues
8. **Real-time**: Socket connection for live updates

---

## API Key Requirements

Ensure `process.env.API_KEY` contains a valid Google Cloud API key with:
- Generative AI API enabled
- Quota sufficient for daily wisdom refresh
- Rate limits appropriate for user load
