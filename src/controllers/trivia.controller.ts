import { Response } from "express";
import { Trivia } from "../models/trivia.model";
import { generateQuestions } from "../services/aiGenerator.service";
import { AuthRequest } from "../middleware/auth.middleware";

export const generateTrivia = async (req: AuthRequest, res: Response) => {
  try {
    const { topic, quantity } = req.body;

    if (!topic || topic.trim() === "") {
      return res.status(400).json({ message: "Debes enviar un tema válido." });
    }

    if (!quantity || quantity < 5 || quantity > 20) {
      return res.status(400).json({ message: "Cantidad de preguntas inválida (rango 5–20)." });
    }


    const questions = await generateQuestions(topic, quantity);

    const trivia = new Trivia({
      topic,
      questions,
      creator: (req.user as any)?._id || (req.user as any)?.id,
    });

    await trivia.save();

    return res.status(201).json({
      message: "Trivia generada exitosamente 🎉",
      triviaId: trivia._id,
      totalQuestions: trivia.questions.length,
      preview: trivia.questions.slice(0, 3),
    });
  } catch (error: any) {
    console.error("Error generating trivia:", error);
    return res.status(500).json({
      message: "Error al generar la trivia. Intenta nuevamente más tarde.",
      error: error.message,
    });
  }
};