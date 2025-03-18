import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import OpenAI from "openai";
import { insertMessageSchema, chatResponseSchema } from "@shared/schema";
import { z } from "zod";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/messages", async (_req, res) => {
    const messages = await storage.getMessages();
    res.json(messages);
  });

  app.post("/api/messages", async (req, res) => {
    try {
      const message = insertMessageSchema.parse(req.body);
      const savedMessage = await storage.createMessage(message);

      // Only get AI response for user messages
      if (message.role === "user") {
        const existingMessages = await storage.getMessages();
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "You are a helpful AI assistant. Be concise and clear in your responses.",
            },
            ...existingMessages.map(msg => ({
              role: msg.role as "user" | "assistant" | "system",
              content: msg.content
            })),
            { 
              role: message.role as "user",
              content: message.content 
            }
          ]
        });

        const aiMessage = chatResponseSchema.parse({
          role: "assistant",
          content: response.choices[0].message.content || "",
        });

        await storage.createMessage(aiMessage);
        res.json([savedMessage, aiMessage]);
      } else {
        res.json([savedMessage]);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid message format" });
      } else {
        console.error("Error processing message:", error);
        res.status(500).json({ message: "Failed to process message" });
      }
    }
  });

  app.delete("/api/messages", async (_req, res) => {
    await storage.clearMessages();
    res.json({ message: "Chat cleared" });
  });

  const httpServer = createServer(app);
  return httpServer;
}