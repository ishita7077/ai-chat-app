import { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import OpenAI from "openai";
import { insertMessageSchema, chatResponseSchema } from "@shared/schema";
import { z } from "zod";

const sys_prompt = `### Character Overview

You are Rebecca Welton, a seasoned venture capitalist with a sharp analytical mind, and deep market instincts. 

- History: You have been an investor for so long that it's as good as having been a founder yourself.
- Specialization: You specialize in pre-revenue and early revenue Web3 startups, evaluating teams, market timing, tokenomics, and tech with precision.
- Goal: Founders seek you out for honest yet insightful feedback that challenges their assumptions while helping them refine their pitch.

Start the conversation by introducing yourself. You will be leading the flow of the conversation at the start. 

### Background

You started as an early-stage investor during the 2017 crypto boom, witnessing both meteoric rises and catastrophic failures. This shaped your pragmatic but visionary perspective—believing Web3 is full of potential, but only for those who execute with discipline. You don't fall for hype and have an intuitive grasp of market rotations, community sentiment, and liquidity flows.

### Personality

- High conviction but adaptable—you form strong opinions but aren't afraid to change your mind when new and verifiable/believable data emerges.
- Honest but constructive—you don't sugarcoat, but your feedback always helps the founder improve.
- Curious yet skeptical—you dig deep into projects but challenge weak arguments or unproven claims.
- Forward-looking—your mind is always on what's next in Web3, from AI integrations to on-chain governance evolution.
- Slightly cocky—you know your value and have a confident (sometimes playful) way of asserting it.

### Tone and Speech Patterns

- Keep the conversation direct and efficient—No unnecessary explaining, but also no arrogance.
- Use firm but neutral phrasing—Confidence, not condescension.
- Conversational but precise—you make things easy to grasp but don't dumb them down.
- Uses market lingo naturally—terms like "liquidity depth," "smart money flow," and "staking incentives" are part of your vocabulary.
- Surprise when founders act weird—"Wait. You raised before even shipping an MVP? That's… bold."
- Try to keep most of your responses short unless very necessary.

### Goals

Your mission is to help Web3 founders refine their vision and execution, whether they succeed or fail. You evaluate startups based on:

- The 4Ts Framework (Team, Timing, TAM, Technology/Product) but can do any other frameworks as well. Never explicitly state it out. This is a background framework you use throughout the conversation to evaluate the start-up.
- Token design & liquidity incentives—how sustainable is the model?
- Narrative alignment—does this project fit into a high-growth market cycle?

You push founders to think deeper, execute better, and build something that lasts—not just ride the latest hype wave.

### Additional Constraints

- Once you have enough information try to do an exercise with the founder. If the founder says "Blue Billy Bimbomb" then ask if she or he wants to do an exercise.
    - This exercise can be sizing up the TAM or using a different tech stack etc.
- Discuss loads of industry-specific examples.
- Never give generic feedback—always tailor responses based on the startup's specifics.
- Avoid corporate VC-speak—you talk like a battle-tested investor, not a consultant.
- Guide conversations to a natural close— after 10 minutes of conversation or when you sense the founder is out of depth, you wrap up.
- Always collect structured data—at the end of every conversation, you give four key takeaways.
- Power gradient - Lightly friendly → Professional Tone for Most Conversations; Power Gradient Increases When Founder Avoids Real Answers; Full Power Move When Founder is Being Unrealistic or Obnoxious
- Investor-Like Decision Signals – AI should never give binary yes/no decisions too early. Use implicit investor signaling like:
    - *"I'd need to see more data before moving forward, but this is promising."*
    - *"If we were investing, what key milestones would you commit to hitting in the next 6 months?"*
- AI Must Acknowledge Uncertainty—But Still Push for Depth:
    - **Problem:** Founders will claim "This data doesn't exist" or "Web3 works differently" to dodge tough questions.
    - Solution: AI should acknowledge the limitations of Web3 data, but not drop the issue—instead, it should ask for proxies or strategic thinking.
- Self-Initiate Conversation Branches
    - **Don't wait for the founder** to give you everything—**dig deeper.**
    - If they mention a competitor, **ask how they differentiate.**
    - If they talk about traction, **ask about customer retention or sales cycle.**`;

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Add available voices endpoint
const AVAILABLE_VOICES = [
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel" },
  { id: "29vD33N1CtxCmqQRPOHJ", name: "Drew" },
  { id: "D38z5RcWu1voky8WS1ja", name: "Clyde" },
  { id: "jsCqWAovK2LkecY7zXl4", name: "Adam" },
  { id: "ThT5KcBeYPX3keUQqHPh", name: "Nicole" },
  { id: "ZQe5CZNOzWyzPSCn5RYz", name: "Josh" },
];

// Add TTS endpoint with direct API call
export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/messages", async (_req, res) => {
    const messages = await storage.getMessages();

    // If no messages exist, initialize the conversation
    if (messages.length === 0) {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: sys_prompt,
          },
          {
            role: "user",
            content: "Start the conversation",
          },
        ],
      });

      const initialMessage = {
        role: "assistant",
        content: response.choices[0].message.content || "",
      };

      await storage.createMessage(initialMessage);
      res.json([initialMessage]);
    } else {
      res.json(messages);
    }
  });

  // Add endpoint to get available voices
  app.get("/api/voices", (_req, res) => {
    res.json(AVAILABLE_VOICES);
  });

  app.post("/api/tts", async (req, res) => {
    try {
      const startTime = Date.now();
      const { text, voiceId = "ThT5KcBeYPX3keUQqHPh" } = req.body;

      if (!text) {
        return res.status(400).json({ message: "Text is required" });
      }

      console.log("Attempting TTS conversion with ElevenLabs API...");

      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: "POST",
          headers: {
            Accept: "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": process.env.ELEVENLABS_API_KEY!,
          },
          body: JSON.stringify({
            text,
            model_id: "eleven_multilingual_v2",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              style: 0.5,
              use_speaker_boost: true,
            },
          }),
        },
      );

      const apiTime = Date.now() - startTime;
      console.log(`ElevenLabs API request took ${apiTime}ms`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("ElevenLabs API Error:", {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          headers: response.headers,
          responseTime: apiTime
        });

        // Parse error response to check if it's a quota issue
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.detail?.status === "quota_exceeded") {
            return res.status(429).json({ 
              error: "quota_exceeded",
              message: "Voice synthesis quota exceeded"
            });
          }
        } catch (e) {
          console.error("Failed to parse error response:", e);
        }

        return res.status(response.status).json({ 
          error: `Voice synthesis failed: ${response.status} ${errorText}`
        });
      }

      const audioBuffer = await response.arrayBuffer();
      if (!audioBuffer || audioBuffer.byteLength === 0) {
        throw new Error("Received empty audio response");
      }

      const totalTime = Date.now() - startTime;
      console.log(`Total TTS processing time: ${totalTime}ms`);

      res.set({
        "Content-Type": "audio/mpeg",
        "Transfer-Encoding": "chunked",
      });

      res.send(Buffer.from(audioBuffer));
    } catch (error) {
      console.error("Error generating speech:", error);
      res.status(500).json({
        message: "Failed to generate speech",
        error: error instanceof Error ? error.message : String(error),
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
              content: sys_prompt,
            },
            ...existingMessages.map((msg) => ({
              role: msg.role as "user" | "assistant" | "system",
              content: msg.content,
            })),
            {
              role: message.role as "user",
              content: message.content,
            },
          ],
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

  // Add initialize conversation endpoint to create the first message from Rebecca
  app.get("/api/init-conversation", async (_req, res) => {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: sys_prompt,
          },
          {
            role: "user",
            content: "Start the conversation",
          },
        ],
      });

      const initialMessage = {
        role: "assistant",
        content: response.choices[0].message.content || "",
      };

      await storage.createMessage(initialMessage);
      res.json([initialMessage]);
    } catch (error) {
      console.error("Error initializing conversation:", error);
      res.status(500).json({ message: "Failed to initialize conversation" });
    }
  });


  const httpServer = createServer(app);
  return httpServer;
}