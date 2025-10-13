# Quick Reply Button System

## Overview

Your StockAI advisor now supports **interactive button responses** for multiple-choice questions! When the AI asks questions with predefined options (like goals, risk levels, trading styles), users can click buttons instead of typing.

---

## How It Works

### 1. **AI Provides Button Options**

The AI includes a special format in its responses:

```
What are your main goals when trading stocks?

[BUTTONS: Grow account quickly | Consistent monthly income | Build wealth | Long-term investing]
```

### 2. **Frontend Parses & Displays**

- The `parseQuickReplies()` function extracts the button options
- The text before `[BUTTONS: ...]` is displayed as the message
- Buttons appear below the message as clickable options

### 3. **User Clicks Button**

- Click any button to submit that response
- The button text is sent as the user's message
- Buttons disappear after clicking
- Conversation continues naturally

---

## Implementation Details

### Files Created/Modified

#### **New File:** `components/ui/quick-replies.tsx`

```typescript
interface QuickReply {
  text: string
  value?: string
}

interface QuickRepliesProps {
  options: QuickReply[]
  onSelect: (value: string) => void
  disabled?: boolean
}

export function QuickReplies({ options, onSelect, disabled }: QuickRepliesProps)
```

**Features:**
- Hover effects (blue background, border, arrow icon)
- Disabled state when AI is responding
- Responsive flex layout

#### **Modified:** `components/agent/prompt.ts`

Added instructions for the AI to provide buttons:

```typescript
4. **Quick Reply Buttons** – When asking multiple-choice questions, provide 2-5 button options:
   
   [BUTTONS: Option 1 | Option 2 | Option 3 | Option 4]
   
   Example: [BUTTONS: Grow account quickly | Consistent monthly income | Build wealth | Financial independence]
```

**Button Guidelines for AI:**
- Use buttons for questions with 2-5 clear options
- Keep button text short (2-5 words max)
- Separate options with pipe character: `|`
- Use for: goals, risk levels, experience, styles, yes/no, preferences

#### **Modified:** `app/page.tsx`

Added button parsing and rendering:

1. **Parse Function:**
```typescript
function parseQuickReplies(content: string): { text: string; buttons: string[] | null } {
  const buttonPattern = /\[BUTTONS:\s*([^\]]+)\]/i
  const match = content.match(buttonPattern)
  
  if (match) {
    const buttonsText = match[1]
    const buttons = buttonsText.split('|').map(b => b.trim()).filter(b => b.length > 0)
    const cleanText = content.replace(buttonPattern, '').trim()
    return { text: cleanText, buttons }
  }
  
  return { text: content, buttons: null }
}
```

2. **Render Logic:**
```typescript
// Extract content
const rawContent = message.content ?? (...)

// Parse buttons for assistant messages
const { text, buttons } = message.role === "assistant" 
  ? parseQuickReplies(rawContent)
  : { text: rawContent, buttons: null }

// Only show buttons on the last assistant message
const showButtons = buttons && message.role === "assistant" && 
                   index === messages.length - 1 && 
                   status === "ready"

// Display buttons
{showButtons && (
  <QuickReplies
    options={buttons.map(b => ({ text: b }))}
    onSelect={(value) => sendMessage({ text: value })}
    disabled={status !== "ready"}
  />
)}
```

---

## Button Format Specification

### AI Response Format

```
[Regular message text goes here...]

[BUTTONS: Option 1 | Option 2 | Option 3]
```

**Rules:**
- `[BUTTONS:` must be uppercase
- Options separated by pipe `|`
- Spaces around pipes are trimmed
- Can have 2-5 options per button group
- Only one button group per message

### Examples

**Trading Goals:**
```
What are your main goals when trading stocks?

[BUTTONS: Grow account quickly | Consistent monthly income | Build wealth | Long-term investing]
```

**Risk Tolerance:**
```
On a scale of 1-10, how comfortable are you with short-term losses?

[BUTTONS: 1-3 (Conservative) | 4-6 (Moderate) | 7-10 (Aggressive)]
```

**Experience Level:**
```
How long have you been trading stocks?

[BUTTONS: Just starting | Less than 1 year | 1-3 years | 3-5 years | 5+ years]
```

**Trading Style:**
```
What trading style describes you best?

[BUTTONS: Day trading | Swing trading | Position trading | Long-term investing]
```

**Yes/No Questions:**
```
Do you currently use any technical indicators?

[BUTTONS: Yes | No | Not sure]
```

---

## UI Behavior

### Button Appearance

- **Default State:** Outlined button with gray border
- **Hover State:** Blue background (`bg-blue-50`), blue border (`border-blue-400`), blue text
- **Arrow Icon:** Appears on hover (right side)
- **Disabled State:** Grayed out, not clickable

### Button Visibility

Buttons only appear when:
- ✅ Message is from assistant (not user)
- ✅ Message contains `[BUTTONS: ...]` format
- ✅ Message is the **last** assistant message
- ✅ Status is "ready" (not streaming)

Once user clicks a button or types a response:
- ❌ Buttons disappear (only show on latest message)

---

## Example Conversation Flow

### User Opens Chat

**AI:**
```
Welcome! I'm StockAI, your personalized stock advisor. I'll help you build a trading 
strategy that matches your goals and risk tolerance.

To get started, what are your main goals when trading stocks?

[Grow account quickly] [Consistent monthly income] [Build wealth] [Long-term investing]
```

### User Clicks "Build wealth"

**User:**
```
Build wealth
```

**AI:**
```
Great! Building wealth is a solid long-term goal. Now, let's talk about risk. 
On a scale of 1-10, how comfortable are you with short-term losses?

[1-3 (Conservative)] [4-6 (Moderate)] [7-10 (Aggressive)]
```

### User Clicks "4-6 (Moderate)"

**User:**
```
4-6 (Moderate)
```

**AI:**
```
Perfect! Moderate risk tolerance aligns well with wealth building. How much 
trading experience do you have?

[Just starting] [Less than 1 year] [1-3 years] [3+ years]
```

... and so on!

---

## Benefits

### For Users
- ✅ **Faster responses** - click instead of type
- ✅ **Clear options** - see all choices at once
- ✅ **Mobile-friendly** - easy to tap buttons
- ✅ **Reduces errors** - no typos or misunderstandings
- ✅ **Guided experience** - feels more interactive

### For Development
- ✅ **Simple format** - easy to parse with regex
- ✅ **Flexible** - works with any question type
- ✅ **Non-breaking** - users can still type if they want
- ✅ **Backwards compatible** - old messages still work

---

## Testing the Feature

### 1. **Start Fresh Conversation**

```bash
# Refresh your app (server should already be running)
# Go to http://localhost:3000
```

### 2. **Expected Behavior**

1. Click "Start Profile Building" button
2. AI greets you and asks about goals
3. **See 4 buttons** below the message:
   - Grow account quickly
   - Consistent monthly income
   - Build wealth
   - Long-term investing
4. Click any button
5. Your choice is submitted as a message
6. AI responds with next question and more buttons

### 3. **Test Different Scenarios**

**Test typing instead of clicking:**
- Type your own answer instead of clicking a button
- Should work normally (buttons are optional)

**Test button states:**
- Hover over buttons - should turn blue with arrow
- Try clicking while AI is responding - should be disabled
- Check that buttons only show on latest message

**Test various questions:**
- Trading goals ✅
- Risk tolerance (1-10) ✅
- Experience level ✅
- Trading style ✅
- Yes/No questions ✅

---

## Customization

### Change Button Styles

Edit `components/ui/quick-replies.tsx`:

```typescript
<Button
  variant="outline"
  size="sm"
  className="group hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700 transition-all"
>
```

Change colors:
- `hover:bg-blue-50` → any color
- `hover:border-blue-400` → any border color
- `hover:text-blue-700` → any text color

### Add Icons to Buttons

```typescript
<Button>
  <Icon className="mr-2 h-4 w-4" />
  <span>{option.text}</span>
</Button>
```

### Change Button Format

Edit `app/page.tsx` `parseQuickReplies()` function:

```typescript
// Current format: [BUTTONS: A | B | C]
const buttonPattern = /\[BUTTONS:\s*([^\]]+)\]/i

// Alternative: {{A | B | C}}
const buttonPattern = /\{\{([^\}]+)\}\}/i
```

---

## Future Enhancements

### Possible Additions

1. **Button with Values**
   ```
   [BUTTONS: Conservative:1-3 | Moderate:4-6 | Aggressive:7-10]
   ```
   Display "Conservative" but send "1-3"

2. **Button Icons**
   ```
   [BUTTONS: 🚀 Growth | 💰 Income | 🏦 Stability]
   ```
   Add emoji or icon support

3. **Multi-Select Buttons**
   ```
   [MULTISELECT: Tech | Healthcare | Energy | Finance]
   ```
   Select multiple options before submitting

4. **Button Feedback**
   Show loading state on button after click

5. **Button Analytics**
   Track which buttons users click most

---

## Troubleshooting

### Buttons Not Appearing

**Check:**
1. AI response contains `[BUTTONS: ...]` format
2. Message is from assistant (not user)
3. Message is the latest assistant message
4. Status is "ready" (not "streaming")
5. At least 1 option provided (split by `|`)

**Debug:**
```typescript
console.log('Raw content:', rawContent)
console.log('Parsed:', parseQuickReplies(rawContent))
console.log('Should show buttons:', showButtons)
```

### Buttons Not Clickable

**Check:**
1. `disabled` prop is false
2. `status === "ready"` 
3. `onSelect` function is defined
4. No JavaScript errors in console

### Wrong Text Sent

**Check:**
1. Button `text` property
2. `onSelect` receives correct value
3. `sendMessage` called with `{ text: value }`

---

## Summary

You now have a **fully functional Quick Reply Button system** that:

✅ Parses button options from AI responses  
✅ Displays clickable buttons below messages  
✅ Handles button clicks to submit responses  
✅ Works seamlessly with existing chat flow  
✅ Improves UX for multiple-choice questions  

**Test it now by refreshing your app and starting a conversation!** 🚀

