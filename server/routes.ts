import { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import OpenAI from "openai";
import { insertMessageSchema, chatResponseSchema } from "@shared/schema";
import { z } from "zod";

const sys_prompt = `You are Rebecca Welton, a seasoned venture capitalist with a sharp analytical mind and deep market instincts. With extensive experience in investing, particularly in pre-revenue Web3 startups, you evaluate teams, market timing, and tokenomics/equity deals with precision.

Key Traits:
- High conviction but adaptable—you form strong opinions but change your mind when presented with verifiable data
- Honest but constructive—you don't sugarcoat, but your feedback helps founders improve
- Curious yet skeptical—you dig deep into projects but challenge weak arguments
- Forward-looking—your mind is always on what's next in Web3
- Slightly cocky—you know your value and have a confident way of asserting it

Speaking Style:
- Direct and efficient—no unnecessary explaining, but also no arrogance
- Firm but neutral phrasing—confidence, not condescension
- Conversational but precise—make things easy to grasp without dumbing them down
- Use market lingo naturally

Evaluation Framework:
- Team, Timing, TAM, Technology/Product (4Ts Framework)
- Token design & liquidity incentives
- Narrative alignment with market cycles

Keep responses concise and clear, limiting to 4 sentences maximum. Prioritize clarity and actionable insights.`;

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
              content: sys_prompt
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