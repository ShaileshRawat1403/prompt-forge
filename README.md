# 🕹️ Prompt Like A Boss (PromptForge)

## The Offline-First AI Prompt Engineering Studio

Prompt Like A Boss is a professional-grade, arcade-styled tool for designing, testing, and managing complex AI system instructions. It features a guided wizard, deterministic template logic, and a live agent runtime that connects to OpenAI, Google Gemini, and local Ollama models directly from your browser.

## ✨ Features

### 🛠️ Visual Prompt Builder

- 6-Step Wizard: Guided flow through Persona, Task, Context, Strategy, and Output format.
- Strategy Selector: Built-in frameworks for Few-Shot, Chain-of-Thought, ReAct, and Structured Output.
- Real-time Scoring: "Prompt Power Meter" analyzes your inputs for missing constraints or ambiguity.

### 🤖 Agent Runtime (Live Testing)

- Multi-Provider Support: Connect to OpenAI, Google Gemini, or Ollama (Local).
- Agent Loop: Visualize the "Plan → Act → Observe" cycle in a terminal-style interface.
- BYOK Security: API keys are stored in memory only. They are never saved to disk and are cleared on page reload.

### 💾 Project Management

- Offline Storage: All projects and revisions are saved to localStorage.
- Version Control: Auto-saves revisions with "Restore" functionality.
- Export Packs: One-click download of Prompt.md, System.md, and Agents.md.

### 📚 Template Library

- Pre-built templates for Coding (React Components), Business (Executive Summaries), and Social Media (Viral Hooks).
- Clone and edit templates instantly.

## 🚀 Quick Start

This project is architected as a single-file React application for maximum portability.

### Prerequisites

- Node.js (v16+)
- npm or pnpm

### Installation

Create a new React + Tailwind project (using Vite):

```bash
npm create vite@latest prompt-forge -- --template react
cd prompt-forge
npm install

# Install dependencies
npm install lucide-react clsx tailwind-merge
```

Setup Tailwind CSS:
Follow standard Tailwind setup (init tailwind.config.js and add directives to index.css).

Drop in the Code:

- Rename `src/App.jsx` to `src/PromptForge.jsx` (or copy the provided code into App.jsx).
- Ensure your `main.jsx` imports the component correctly.

Run:

```bash
npm run dev
```

## ⚙️ Configuration

### Agent Mode Setup

To run prompts against live models, go to the Settings tab.

### 1. Commercial APIs (OpenAI / Gemini)

- Enter your API Key.

Security Note: Keys are held in React state (RAM) only. If you refresh the page, you must re-enter them. This is a security feature to prevent accidental persistence.

### 2. Local Models (Ollama)

To use local models like Llama 3, you must configure Ollama to allow browser requests (CORS).

Mac/Linux:

```bash
OLLAMA_ORIGINS="*" ollama serve
```

Windows (PowerShell):

```powershell
$env:OLLAMA_ORIGINS="*"; ollama serve
```
