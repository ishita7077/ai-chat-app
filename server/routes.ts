import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import OpenAI from "openai";
import { insertMessageSchema, chatResponseSchema } from "@shared/schema";
import { z } from "zod";
import elevenlabs from 'elevenlabs-node';

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Initialize ElevenLabs client
let voice;
try {
  voice = new elevenlabs({
    apiKey: process.env.ELEVENLABS_API_KEY
  });
  console.log('ElevenLabs client initialized successfully');
} catch (error) {
  console.error('Failed to initialize ElevenLabs client:', error);
  throw error;
}

// Rachel voice - one of the most natural-sounding voices
const VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/messages", async (_req, res) => {
    const messages = await storage.getMessages();
    res.json(messages);
  });

  app.post("/api/tts", async (req, res) => {
    try {
      console.log('TTS request received:', req.body);
      const { text } = req.body;

      if (!text) {
        console.warn('TTS request missing text');
        return res.status(400).json({ message: "Text is required" });
      }

      console.log('Generating audio with ElevenLabs...');
      // Generate audio using ElevenLabs with optimized settings for natural speech
      const audioResponse = await voice.textToSpeech(VOICE_ID, {
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.30,           // Lower stability for more natural variation
          similarity_boost: 0.80,     // Higher similarity for consistent voice
          style: 1,                  // Increased speaking style variation
          use_speaker_boost: true    // Enhanced clarity
        }
      }).catch(error => {
        console.error('ElevenLabs API error:', error);
        throw error;
      });

      if (!audioResponse) {
        throw new Error('No audio response received from ElevenLabs');
      }

      console.log('Audio generated successfully, sending response');
      // Send audio back to client
      res.set('Content-Type', 'audio/mpeg');
      const audioBuffer = Buffer.from(audioResponse);
      if (!audioBuffer.length) {
        throw new Error('Empty audio buffer received');
      }
      res.send(audioBuffer);
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