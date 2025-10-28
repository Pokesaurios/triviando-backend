import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "API_KEY_NO_CONFIGURADA";
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export async function generateQuestions(topic: string, quantity: number): Promise<any[]> {
  const prompt = `
Eres un generador de trivias. Crea ${quantity} preguntas sobre "${topic}".

REQUISITOS:
- Distribución: ${Math.round(quantity/3)} fáciles, ${Math.round(quantity/3)} medias, ${Math.round(quantity/3)} difíciles
- 4 opciones por pregunta, 1 correcta
- Opciones incorrectas: plausibles pero claramente erróneas

FORMATO JSON:
[
  {
    "question": "Texto pregunta?",
    "options": {"A": "Texto", "B": "Texto", "C": "Texto", "D": "Texto"},
    "correctAnswer": "A|B|C|D",
    "difficulty": "easy|medium|hard",
  }
]

CRITERIOS DIFICULTAD:
• FÁCIL: 80% conocería la respuesta
• MEDIA: 50% conocería la respuesta  
• DIFÍCIL: 20% conocería la respuesta

Solo responde con el JSON.
  `;

  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  const jsonStart = text.indexOf("[");
  const jsonEnd = text.lastIndexOf("]") + 1;
  let jsonStr = text.substring(jsonStart, jsonEnd);

  try {
    const questions = JSON.parse(jsonStr);
    return questions.map((q: any) => ({
      question: q.question,
      options: [q.options.A, q.options.B, q.options.C, q.options.D],
      correctAnswer: q.options[q.correctAnswer],
      difficulty: q.difficulty,
    }));
  } catch (err) {
    throw new Error("No se pudo parsear la respuesta de Gemini. Respuesta: " + text);
  }
}