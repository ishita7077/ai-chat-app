import { type Express } from "express";
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

  // Add TTS endpoint with direct API call
  app.post("/api/tts", async (req, res) => {
    try {
      console.log('TTS request received:', req.body);
      const { text } = req.body;

      if (!text) {
        console.warn('TTS request missing text');
        return res.status(400).json({ message: "Text is required" });
      }

      console.log('Making direct API call to ElevenLabs...');

      const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM', {
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
            stability: 0.5,
            similarity_boost: 0.5
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('ElevenLabs API error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`ElevenLabs API error: ${response.status} ${errorText}`);
      }

      console.log('Audio generated successfully, sending response');
      const audioBuffer = await response.arrayBuffer();

      res.set({
        'Content-Type': 'audio/mpeg',
        'Transfer-Encoding': 'chunked'
      });

      res.send(Buffer.from(audioBuffer));
    } catch (error) {
      console.error("Error generating speech:", error);
      if (error instanceof Error) {
        console.error('Error stack:', error.stack);
      }
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