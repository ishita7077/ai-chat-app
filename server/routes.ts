import { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import OpenAI from "openai";
import { insertMessageSchema, chatResponseSchema } from "@shared/schema";
import { z } from "zod";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Add available voices endpoint
const AVAILABLE_VOICES = [
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel" },
  { id: "29vD33N1CtxCmqQRPOHJ", name: "Drew" },
  { id: "D38z5RcWu1voky8WS1ja", name: "Clyde" },
  { id: "jsCqWAovK2LkecY7zXl4", name: "Adam" },
  { id: "ThT5KcBeYPX3keUQqHPh", name: "Nicole" },
  { id: "ZQe5CZNOzWyzPSCn5RYz", name: "Josh" }
];

// Add TTS endpoint with direct API call
export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/messages", async (_req, res) => {
    const messages = await storage.getMessages();
    res.json(messages);
  });

  // Add endpoint to get available voices
  app.get("/api/voices", (_req, res) => {
    res.json(AVAILABLE_VOICES);
  });

  app.post("/api/tts", async (req, res) => {
    try {
      const { text, voiceId = "ThT5KcBeYPX3keUQqHPh" } = req.body;

      if (!text) {
        return res.status(400).json({ message: "Text is required" });
      }

      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': process.env.ELEVENLABS_API_KEY!
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.1,           // Minimal stability for fastest processing
            similarity_boost: 0.1,    // Minimal similarity for fastest processing
            optimize_streaming_latency: 4,  // Maximum optimization for latency
            speaking_rate: 1.3       // Speak 30% faster than normal
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} ${errorText}`);
      }

      const audioBuffer = await response.arrayBuffer();

      res.set({
        'Content-Type': 'audio/mpeg',
        'Transfer-Encoding': 'chunked'
      });

      res.send(Buffer.from(audioBuffer));
    } catch (error) {
      console.error("Error generating speech:", error);
      res.status(500).json({ 
        message: "Failed to generate speech",
        error: error instanceof Error ? error.message : String(error)
      });
    }
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
              content: "You are a helpful AI assistant. Be concise and clear in your responses. Keep responses to a maximum of 4 sentences. Prioritize clarity and brevity.",
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

        // Parse and save the AI's response
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