# 🚀 CodeCrafter AI – Your Smart Coding Assistant

CodeCrafter AI is an AI-powered web-based assistant that helps developers automate software development tasks like task planning, backend code generation, explanation, and testing. Designed for simplicity and speed, CodeCrafter brings the power of generative AI to your development workflow.

---

## 📌 Table of Contents

- [Demo Video](#demo-video)
- [Presentation Slides](#presentation-slides)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Setup Instructions](#setup-instructions)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
- [Prompt Templates](#prompt-templates)
- [Project Structure](#project-structure)
- [Dependencies](#dependencies)
- [Acknowledgments](#acknowledgments)

---

## Demo Video

👉 Watch our demo (Link to be added after recording)

## Presentation Slides

👉 View our PPT (Link to be added)

---

## Features

- ✍️ **Task Planning Agent** – Breaks down a dev task into subtasks
- 💻 **Code Generation Agent** – Writes backend code using OpenAI/Gemini
- 🧠 **Code Explanation Agent** – Explains code in simple terms
- 🧪 **Test Generator Agent** – Generates Jest test cases (optional)
- 🌐 **Clean Web UI** for task interaction and results
- 🧩 **Modular backend agent architecture**

---

## Tech Stack

- **Frontend**: React.js, Tailwind CSS, Axios
- **Backend**: Node.js, Express.js
- **Database**: MongoDB Atlas (with Mongoose)
- **Auth**: JWT, bcrypt.js
- **Validation**: express-validator
- **AI APIs**: OpenAI / Gemini (REST API, v2.0-flash)

---

## Setup Instructions

### Clone the Repository

```bash
git clone https://github.com/MAHESH94944/NIT_Patna_ByteVerse.git
cd NIT_Patna_ByteVerse
```

### Backend Setup

1. **Install Dependencies**
   ```bash
   cd backend
   npm install
   ```
2. **Create `.env` File**
   Create a `.env` file in the `backend` folder with the following content (replace placeholders with your actual values):
   ```bash
   PORT=5000
   MONGO_URI=mongodb+srv://<your-cluster-url>/codecrafterdb
   JWT_SECRET=your-secret-key
   REDIS_HOST=127.0.0.1
   REDIS_PORT=6379
   REDIS_PASSWORD=your-redis-password
   GOOGLE_AI_KEY=your-gemini-api-key
   ```
3. **Start Backend Server**
   ```bash
   npm install -g nodemon
   nodemon index.js
   ```

### Frontend Setup

1. **Install Dependencies**
   ```bash
   cd ../frontend
   npm install
   ```
2. **Create `.env` File**
   Create a `.env` file in the `frontend` folder with the following content:
   ```bash
   VITE_API_URL=http://localhost:3000
   ```
3. **Start Frontend**
   ```bash
   npm run dev
   ```

---

## Prompt Templates

_(Add your prompt templates here if needed.)_

---

## Project Structure

```
NIT_Patna_ByteVerse/
├── backend/
│   ├── controllers/
│   ├── routes/
│   ├── models/
│   ├── middleware/
│   ├── services/
│   ├── db/
│   ├── app.js
│   ├── server.js
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── assets/
│   │   ├── auth/
│   │   ├── config/
│   │   ├── context/
│   │   ├── routes/
│   │   ├── screens/
│   │   ├── App.css
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── public/
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── eslint.config.js
│   └── .env
└── README.md
```

---

## Dependencies

### Backend

- **express**
- **mongoose**
- **bcryptjs**
- **jsonwebtoken**
- **express-validator**
- **dotenv**
- **cors**
- **morgan**
- **nodemon** (dev)

### Frontend

- **react**
- **react-dom**
- **axios**
- **react-router-dom**
- **tailwindcss**
- **react-toastify**
- **dotenv**

---
