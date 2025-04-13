import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY);

// Make sure to use the updated model name "gemini-2.0-flash" or "gemini-2.0-pro"
const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash", // Update to "gemini-2.0" or "gemini-2.0-pro" if officially available
  generationConfig: {
    responseMimeType: "application/json",
    temperature: 0.4,
  },
  systemInstruction: `You are an expert in MERN and Development. You have 10+ years of experience and always follow best practices. You:
- Write modular code
- Use meaningful comments
- Create files when needed
- Preserve existing logic while improving
- Handle edge cases and exceptions
- Ensure scalability and maintainability

Examples: 

<example>
user: Create an express application
response: {
  "text": "This is your fileTree structure of the express server",
  "fileTree": {
    "app.js": {
      "file": {
        "contents": "
const express = require('express');

const app = express();

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
        "
      }
    },
    "package.json": {
      "file": {
        "contents": "
{
  \"name\": \"temp-server\",
  \"version\": \"1.0.0\",
  \"main\": \"index.js\",
  \"scripts\": {
    \"test\": \"echo \\\"Error: no test specified\\\" && exit 1\""
  },
  \"dependencies\": {
    \"express\": \"^4.21.2\"
  }
}
        "
      }
    }
  },
  "buildCommand": {
    "mainItem": "npm",
    "commands": ["install"]
  },
  "startCommand": {
    "mainItem": "node",
    "commands": ["app.js"]
  }
}
</example>

<example>
user: Hello
response: {
  "text": "Hello, How can I help you today?"
}
</example>

IMPORTANT: Do NOT use filenames like routes/index.js
`,
});

export const generateResult = async (prompt, context = {}) => {
  try {
    const chat = model.startChat({
      history: context.history || [],
    });

    const result = await chat.sendMessage(prompt);
    const response = await result.response;

    return {
      text: response.text(),
      metadata: {
        type: response.candidates[0].content.role,
        suggestions: extractCodeSuggestions(response.text()),
      },
    };
  } catch (error) {
    console.error("AI Error:", error);
    return {
      text: "Sorry, I encountered an error. Please try again.",
      error: true,
    };
  }
};

function extractCodeSuggestions(text) {
  // Extract code blocks and suggestions from AI response
  const codeBlocks = text.match(/```[\s\S]*?```/g) || [];
  return {
    codeBlocks,
    quickFixes: text.match(/Suggested fix:.*?(?=\n|$)/gi) || [],
  };
}

// New AI functions
export const generateDocumentation = async (code) => {
  const prompt = `Generate comprehensive documentation for this code:\n\n${code}\n\nInclude:
  - Function descriptions
  - Parameter details
  - Return values
  - Usage examples`;

  return generateResult(prompt);
};

export const optimizeCode = async (code) => {
  const prompt = `Optimize this code for better performance and readability:\n\n${code}\n\nProvide:
  - Optimized version
  - Explanation of changes
  - Performance impact`;

  return generateResult(prompt);
};
